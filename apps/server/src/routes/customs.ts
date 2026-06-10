import { Prisma, type PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../lib/prisma";

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type CustomsStatus = "PENDING" | "COMPLETED";
type CustomsTagColor = "default" | "success";

type CustomsRecord = {
  id: string;
  clearanceNo: string;
  contractId: string | null;
  batchId: string | null;
  shipmentId: string | null;
  responsibleCompany: string | null;
  responsiblePerson: string | null;
  packingListDocumentId: string | null;
  invoiceDocumentId: string | null;
  billOfLadingDocumentId: string | null;
  certificateDocumentId: string | null;
  aiCheckResult: Prisma.JsonValue | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const customsWorkOrderType = "CUSTOMS_CLEARANCE";
const landTransportWorkOrderType = "OVERSEAS_LAND_TRANSPORT";
const warehousePreReceiveWorkOrderType = "WAREHOUSE_PRE_RECEIVE";

export const customsRouter = Router();

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function readAuditContext(request: Request) {
  return {
    ip: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null
  };
}

function readJsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function getAuditActor(client: Prisma.TransactionClient | PrismaClient): Promise<AuditActor> {
  const demoOwner = await client.user.findUnique({
    where: { username: "demo-owner" },
    select: {
      id: true,
      username: true
    }
  });

  return {
    userId: demoOwner?.id ?? null,
    username: demoOwner?.username ?? "demo-owner"
  };
}

async function writeAuditLog(
  client: Prisma.TransactionClient,
  actor: AuditActor,
  request: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeJson?: unknown,
  afterJson?: unknown
) {
  const context = readAuditContext(request);

  await client.auditLog.create({
    data: {
      userId: actor.userId,
      username: actor.username,
      action,
      entityType,
      entityId,
      beforeJson: toAuditJson(beforeJson),
      afterJson: toAuditJson(afterJson),
      ip: context.ip,
      userAgent: context.userAgent
    }
  });
}

function normalizeCustomsStatus(value: string | null | undefined): CustomsStatus {
  if (value === "COMPLETED") {
    return "COMPLETED";
  }

  return "PENDING";
}

function resolveStatusMeta(status: CustomsStatus) {
  if (status === "COMPLETED") {
    return {
      label: "已完成清关",
      color: "success" as CustomsTagColor,
      summary: "清关已完成，系统已联动生成境外陆运任务与仓库预收货单，等待后续仓储接单。"
    };
  }

  return {
    label: "待清关",
    color: "default" as CustomsTagColor,
    summary: "当前清关草稿已进入待处理状态，可先查看单据一致性结果，再人工确认推进清关完成。"
  };
}

function resolveRecommendedAction(status: CustomsStatus) {
  if (status === "PENDING") {
    return {
      canComplete: true,
      buttonText: "模拟清关完成",
      description: "确认后会把清关状态更新为已完成，并自动生成境外陆运任务与仓库预收货单 / 工单。"
    };
  }

  return {
    canComplete: false,
    buttonText: "已完成当前清关推进",
    description: "当前清关记录已经进入后续仓储承接阶段，可去仓储管理模块继续演示预收货与扫码收货。"
  };
}

function buildAiCheckResult(aiCheckResult: Prisma.JsonValue | null | undefined) {
  const payload = readJsonObject(aiCheckResult);
  const packingListQuantity = readOptionalString(payload.packingListQuantity);
  const invoiceQuantity = readOptionalString(payload.invoiceQuantity);
  const billOfLadingContainerNo = readOptionalString(payload.billOfLadingContainerNo);
  const aiConclusion =
    readOptionalString(payload.aiConclusion) ??
    (packingListQuantity && invoiceQuantity && packingListQuantity === invoiceQuantity
      ? "单据数量一致，可进入清关流程。"
      : "单据数量存在差异，请人工复核。");

  return {
    packingListQuantity,
    invoiceQuantity,
    billOfLadingContainerNo,
    aiConclusion
  };
}

async function loadCustomsOr404(customsId: string, response: Response) {
  const customs = await prisma.customsClearance.findUnique({
    where: { id: customsId },
    select: {
      id: true,
      clearanceNo: true,
      contractId: true,
      batchId: true,
      shipmentId: true,
      responsibleCompany: true,
      responsiblePerson: true,
      packingListDocumentId: true,
      invoiceDocumentId: true,
      billOfLadingDocumentId: true,
      certificateDocumentId: true,
      aiCheckResult: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!customs) {
    response.status(404).json({ message: "Customs clearance not found." });
    return null;
  }

  return customs;
}

async function buildCustomsView(records: CustomsRecord[]) {
  const contractIds = uniqueIds(records.map((item) => item.contractId));
  const batchIds = uniqueIds(records.map((item) => item.batchId));
  const shipmentIds = uniqueIds(records.map((item) => item.shipmentId));
  const documentIds = uniqueIds(
    records.flatMap((item) => [
      item.packingListDocumentId,
      item.invoiceDocumentId,
      item.billOfLadingDocumentId,
      item.certificateDocumentId
    ])
  );

  const [contracts, batches, shipments, documents, workOrders, preReceiveOrders] = await Promise.all([
    contractIds.length > 0
      ? prisma.contract.findMany({
          where: { id: { in: contractIds } },
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            destinationWarehouse: true,
            amount: true,
            currency: true
          }
        })
      : Promise.resolve([]),
    batchIds.length > 0
      ? prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: {
            id: true,
            batchNo: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true,
            warehouseId: true
          }
        })
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: {
            id: true,
            shipmentNo: true,
            shippingCompany: true,
            billOfLadingNo: true,
            containerNo: true,
            originPort: true,
            destinationPort: true,
            departureTime: true,
            estimatedArrivalTime: true,
            actualArrivalTime: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    documentIds.length > 0
      ? prisma.document.findMany({
          where: { id: { in: documentIds } },
          select: {
            id: true,
            documentType: true,
            originalName: true,
            status: true,
            aiStatus: true,
            businessCreated: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    records.length > 0
      ? prisma.workOrder.findMany({
          where: {
            OR: [
              {
                type: customsWorkOrderType,
                relatedEntityType: "CustomsClearance",
                relatedEntityId: { in: records.map((item) => item.id) }
              },
              {
                type: landTransportWorkOrderType,
                relatedEntityType: "CustomsClearance",
                relatedEntityId: { in: records.map((item) => item.id) }
              },
              {
                type: warehousePreReceiveWorkOrderType
              }
            ]
          },
          select: {
            id: true,
            workOrderNo: true,
            type: true,
            title: true,
            status: true,
            priority: true,
            responsibleDepartment: true,
            responsiblePerson: true,
            startTime: true,
            dueTime: true,
            relatedEntityType: true,
            relatedEntityId: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    batchIds.length > 0 || contractIds.length > 0
      ? prisma.preReceiveOrder.findMany({
          where: {
            OR: [
              ...(batchIds.length > 0 ? [{ batchId: { in: batchIds } }] : []),
              ...(contractIds.length > 0 ? [{ contractId: { in: contractIds } }] : [])
            ]
          },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            preReceiveNo: true,
            contractId: true,
            batchId: true,
            warehouseId: true,
            expectedArrivalTime: true,
            skuName: true,
            quantity: true,
            unit: true,
            suggestedLocation: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([])
  ]);

  const contractById = new Map(contracts.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const shipmentById = new Map(shipments.map((item) => [item.id, item]));
  const documentById = new Map(documents.map((item) => [item.id, item]));
  const customsWorkOrderByCustomsId = new Map(
    workOrders
      .filter((item) => item.type === customsWorkOrderType && item.relatedEntityId)
      .map((item) => [item.relatedEntityId as string, item])
  );
  const landTransportWorkOrderByCustomsId = new Map(
    workOrders
      .filter((item) => item.type === landTransportWorkOrderType && item.relatedEntityId)
      .map((item) => [item.relatedEntityId as string, item])
  );
  const warehouseWorkOrderByPreReceiveId = new Map(
    workOrders
      .filter((item) => item.type === warehousePreReceiveWorkOrderType && item.relatedEntityType === "PreReceiveOrder")
      .map((item) => [item.relatedEntityId ?? "", item])
  );
  const preReceiveByBusinessKey = new Map<
    string,
    (typeof preReceiveOrders)[number]
  >();

  for (const item of preReceiveOrders) {
    const businessKey = `${item.contractId ?? ""}|${item.batchId ?? ""}`;
    if (!preReceiveByBusinessKey.has(businessKey)) {
      preReceiveByBusinessKey.set(businessKey, item);
    }
  }

  return records.map((record) => {
    const normalizedStatus = normalizeCustomsStatus(record.status);
    const contract = record.contractId ? contractById.get(record.contractId) ?? null : null;
    const batch = record.batchId ? batchById.get(record.batchId) ?? null : null;
    const shipment = record.shipmentId ? shipmentById.get(record.shipmentId) ?? null : null;
    const aiCheckResult = buildAiCheckResult(record.aiCheckResult);
    const preReceive =
      preReceiveByBusinessKey.get(`${record.contractId ?? ""}|${record.batchId ?? ""}`) ?? null;
    const customsWorkOrder = customsWorkOrderByCustomsId.get(record.id) ?? null;
    const landTransportWorkOrder = landTransportWorkOrderByCustomsId.get(record.id) ?? null;
    const warehousePreReceiveWorkOrder =
      preReceive ? warehouseWorkOrderByPreReceiveId.get(preReceive.id) ?? null : null;

    const mapDocument = (documentId: string | null | undefined) => {
      if (!documentId) {
        return null;
      }

      const document = documentById.get(documentId);
      if (!document) {
        return null;
      }

      return {
        id: document.id,
        documentType: document.documentType,
        originalName: document.originalName,
        status: document.status,
        aiStatus: document.aiStatus,
        businessCreated: document.businessCreated,
        createdAt: document.createdAt.toISOString(),
        updatedAt: document.updatedAt.toISOString()
      };
    };

    return {
      id: record.id,
      clearanceNo: record.clearanceNo,
      status: normalizedStatus,
      statusMeta: resolveStatusMeta(normalizedStatus),
      responsibleCompany: record.responsibleCompany,
      responsiblePerson: record.responsiblePerson,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      contract: contract
        ? {
            id: contract.id,
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            supplierName: contract.supplierName,
            productName: contract.productName,
            totalQuantity: contract.totalQuantity,
            unit: contract.unit,
            destinationWarehouse: contract.destinationWarehouse,
            amount: contract.amount,
            currency: contract.currency
          }
        : null,
      batch: batch
        ? {
            id: batch.id,
            batchNo: batch.batchNo,
            productName: batch.productName,
            totalQuantity: batch.totalQuantity,
            unit: batch.unit,
            status: batch.status,
            destinationWarehouse: batch.destinationWarehouse,
            warehouseId: batch.warehouseId
          }
        : null,
      shipment: shipment
        ? {
            id: shipment.id,
            shipmentNo: shipment.shipmentNo,
            shippingCompany: shipment.shippingCompany,
            billOfLadingNo: shipment.billOfLadingNo,
            containerNo: shipment.containerNo,
            originPort: shipment.originPort,
            destinationPort: shipment.destinationPort,
            departureTime: shipment.departureTime?.toISOString() ?? null,
            estimatedArrivalTime: shipment.estimatedArrivalTime?.toISOString() ?? null,
            actualArrivalTime: shipment.actualArrivalTime?.toISOString() ?? null,
            status: shipment.status
          }
        : null,
      documents: {
        packingList: mapDocument(record.packingListDocumentId),
        invoice: mapDocument(record.invoiceDocumentId),
        billOfLading: mapDocument(record.billOfLadingDocumentId),
        certificate: mapDocument(record.certificateDocumentId)
      },
      aiCheckResult,
      linkedCustomsWorkOrder: customsWorkOrder
        ? {
            id: customsWorkOrder.id,
            workOrderNo: customsWorkOrder.workOrderNo,
            title: customsWorkOrder.title,
            status: customsWorkOrder.status,
            priority: customsWorkOrder.priority,
            responsibleDepartment: customsWorkOrder.responsibleDepartment,
            responsiblePerson: customsWorkOrder.responsiblePerson,
            startTime: customsWorkOrder.startTime?.toISOString() ?? null,
            dueTime: customsWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: customsWorkOrder.createdAt.toISOString(),
            updatedAt: customsWorkOrder.updatedAt.toISOString()
          }
        : null,
      linkedLandTransportWorkOrder: landTransportWorkOrder
        ? {
            id: landTransportWorkOrder.id,
            workOrderNo: landTransportWorkOrder.workOrderNo,
            title: landTransportWorkOrder.title,
            status: landTransportWorkOrder.status,
            priority: landTransportWorkOrder.priority,
            responsibleDepartment: landTransportWorkOrder.responsibleDepartment,
            responsiblePerson: landTransportWorkOrder.responsiblePerson,
            startTime: landTransportWorkOrder.startTime?.toISOString() ?? null,
            dueTime: landTransportWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: landTransportWorkOrder.createdAt.toISOString(),
            updatedAt: landTransportWorkOrder.updatedAt.toISOString()
          }
        : null,
      linkedPreReceiveOrder: preReceive
        ? {
            id: preReceive.id,
            preReceiveNo: preReceive.preReceiveNo,
            expectedArrivalTime: preReceive.expectedArrivalTime?.toISOString() ?? null,
            skuName: preReceive.skuName,
            quantity: preReceive.quantity,
            unit: preReceive.unit,
            suggestedLocation: preReceive.suggestedLocation,
            status: preReceive.status,
            createdAt: preReceive.createdAt.toISOString(),
            updatedAt: preReceive.updatedAt.toISOString()
          }
        : null,
      linkedWarehousePreReceiveWorkOrder: warehousePreReceiveWorkOrder
        ? {
            id: warehousePreReceiveWorkOrder.id,
            workOrderNo: warehousePreReceiveWorkOrder.workOrderNo,
            title: warehousePreReceiveWorkOrder.title,
            status: warehousePreReceiveWorkOrder.status,
            priority: warehousePreReceiveWorkOrder.priority,
            responsibleDepartment: warehousePreReceiveWorkOrder.responsibleDepartment,
            responsiblePerson: warehousePreReceiveWorkOrder.responsiblePerson,
            startTime: warehousePreReceiveWorkOrder.startTime?.toISOString() ?? null,
            dueTime: warehousePreReceiveWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: warehousePreReceiveWorkOrder.createdAt.toISOString(),
            updatedAt: warehousePreReceiveWorkOrder.updatedAt.toISOString()
          }
        : null,
      recommendedAction: resolveRecommendedAction(normalizedStatus)
    };
  });
}

customsRouter.get("/clearances", async (_request, response) => {
  const clearances = await prisma.customsClearance.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      clearanceNo: true,
      contractId: true,
      batchId: true,
      shipmentId: true,
      responsibleCompany: true,
      responsiblePerson: true,
      packingListDocumentId: true,
      invoiceDocumentId: true,
      billOfLadingDocumentId: true,
      certificateDocumentId: true,
      aiCheckResult: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const customsClearances = await buildCustomsView(clearances);

  response.json({
    summary: {
      totalClearances: customsClearances.length,
      pendingClearances: customsClearances.filter((item) => item.status === "PENDING").length,
      completedClearances: customsClearances.filter((item) => item.status === "COMPLETED").length,
      linkedPreReceiveOrders: customsClearances.filter((item) => item.linkedPreReceiveOrder).length
    },
    clearances: customsClearances
  });
});

customsRouter.get("/clearances/:id", async (request, response) => {
  const customs = await loadCustomsOr404(request.params.id, response);

  if (!customs) {
    return;
  }

  const [view] = await buildCustomsView([customs]);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "CustomsClearance",
      entityId: customs.id,
      action: {
        in: ["CUSTOMS_STATUS_UPDATE", "CUSTOMS_TRIGGER_PRE_RECEIVE"]
      }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      username: true,
      createdAt: true
    }
  });

  response.json({
    ...view,
    moduleNarrative: {
      role:
        "报关清关模块负责承接到港后的正式清关动作，展示清关草稿、责任主体、单据一致性检查结果，并把业务上下文继续交给境外陆运与仓库预收货。",
      boundary:
        "第一版只做真实清关记录、AI 单据一致性展示与模拟清关完成，不接真实海关接口，也不直接影响库存。库存仍然只能由二维码扫码入库 / 出库驱动。"
    },
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary:
        item.action === "CUSTOMS_TRIGGER_PRE_RECEIVE"
          ? "清关完成后，已自动联动生成境外陆运任务与仓库预收货单 / 工单。"
          : "清关状态已推进。"
    }))
  });
});

customsRouter.post("/clearances/:id/complete", async (request, response) => {
  const customs = await loadCustomsOr404(request.params.id, response);

  if (!customs) {
    return;
  }

  if (normalizeCustomsStatus(customs.status) === "COMPLETED") {
    response.status(409).json({ message: "当前清关已完成，无需重复推进。" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await getAuditActor(tx);
    const now = new Date();
    const [contract, batch, shipment, customsWorkOrder] = await Promise.all([
      customs.contractId
        ? tx.contract.findUnique({
            where: { id: customs.contractId },
            select: {
              id: true,
              contractNo: true,
              productName: true,
              totalQuantity: true,
              unit: true,
              destinationWarehouse: true
            }
          })
        : Promise.resolve(null),
      customs.batchId
        ? tx.batch.findUnique({
            where: { id: customs.batchId },
            select: {
              id: true,
              batchNo: true,
              productName: true,
              totalQuantity: true,
              unit: true,
              destinationWarehouse: true,
              warehouseId: true
            }
          })
        : Promise.resolve(null),
      customs.shipmentId
        ? tx.shipment.findUnique({
            where: { id: customs.shipmentId },
            select: {
              id: true,
              shipmentNo: true,
              destinationPort: true,
              actualArrivalTime: true
            }
          })
        : Promise.resolve(null),
      tx.workOrder.findFirst({
        where: {
          type: customsWorkOrderType,
          relatedEntityType: "CustomsClearance",
          relatedEntityId: customs.id
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      })
    ]);

    const warehouse =
      (batch?.warehouseId
        ? await tx.warehouse.findUnique({
            where: { id: batch.warehouseId },
            select: { id: true, name: true }
          })
        : null) ??
      (contract?.destinationWarehouse
        ? await tx.warehouse.findFirst({
            where: { name: contract.destinationWarehouse },
            select: { id: true, name: true }
          })
        : null);

    const preferredLocation = warehouse
      ? await tx.warehouseLocation.findFirst({
          where: {
            warehouseId: warehouse.id,
            status: "ACTIVE"
          },
          orderBy: { locationCode: "asc" },
          select: {
            id: true,
            locationCode: true
          }
        })
      : null;

    const updatedCustoms = await tx.customsClearance.update({
      where: { id: customs.id },
      data: {
        status: "COMPLETED"
      },
      select: {
        id: true,
        clearanceNo: true,
        status: true
      }
    });

    if (customsWorkOrder && customsWorkOrder.status !== "COMPLETED") {
      await tx.workOrder.update({
        where: { id: customsWorkOrder.id },
        data: {
          status: "COMPLETED"
        }
      });
    }

    const existingPreReceive =
      (await tx.preReceiveOrder.findFirst({
        where: {
          contractId: customs.contractId,
          batchId: customs.batchId
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          preReceiveNo: true,
          status: true
        }
      })) ??
      null;

    const quantity = batch?.totalQuantity ?? contract?.totalQuantity ?? 0;
    const unit = batch?.unit ?? contract?.unit ?? "箱";
    const productName = batch?.productName ?? contract?.productName ?? "待确认货物";
    const expectedArrivalTime = shipment?.actualArrivalTime ? addDays(shipment.actualArrivalTime, 1) : addDays(now, 1);

    const preReceiveOrder =
      existingPreReceive ??
      (await tx.preReceiveOrder.create({
        data: {
          preReceiveNo: `PR-${customs.clearanceNo.replace(/^CUS-/, "")}`,
          contractId: customs.contractId,
          batchId: customs.batchId,
          warehouseId: warehouse?.id ?? null,
          expectedArrivalTime,
          skuName: productName,
          quantity,
          unit,
          suggestedLocation: preferredLocation?.locationCode ?? null,
          status: "PENDING"
        },
        select: {
          id: true,
          preReceiveNo: true,
          status: true
        }
      }));

    const existingLandTransportWorkOrder =
      (await tx.workOrder.findFirst({
        where: {
          type: landTransportWorkOrderType,
          relatedEntityType: "CustomsClearance",
          relatedEntityId: customs.id
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      })) ??
      null;

    const landTransportWorkOrder =
      existingLandTransportWorkOrder ??
      (await tx.workOrder.create({
        data: {
          workOrderNo: `WO-LAND-${customs.clearanceNo.replace(/^CUS-/, "")}`,
          type: landTransportWorkOrderType,
          title: "境外陆运任务",
          content: `清关 ${customs.clearanceNo} 已完成，请安排货物从目的港转运至目标仓库 ${warehouse?.name ?? contract?.destinationWarehouse ?? "待确认仓库"}。`,
          responsibleDepartment: "物流部",
          responsiblePerson: "Demo Overseas Logistics Owner",
          status: "PENDING",
          priority: "HIGH",
          startTime: now,
          dueTime: addDays(now, 1),
          contractId: customs.contractId,
          batchId: customs.batchId,
          relatedEntityType: "CustomsClearance",
          relatedEntityId: customs.id,
          completionCondition: "货物已从目的港转运至目标仓库，进入仓库预收货。"
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      }));

    const existingWarehousePreReceiveWorkOrder =
      (await tx.workOrder.findFirst({
        where: {
          type: warehousePreReceiveWorkOrderType,
          relatedEntityType: "PreReceiveOrder",
          relatedEntityId: preReceiveOrder.id
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      })) ??
      null;

    const warehousePreReceiveWorkOrder =
      existingWarehousePreReceiveWorkOrder ??
      (await tx.workOrder.create({
        data: {
          workOrderNo: `WO-WH-${customs.clearanceNo.replace(/^CUS-/, "")}`,
          type: warehousePreReceiveWorkOrderType,
          title: "仓库预收货工单",
          content: `清关 ${customs.clearanceNo} 已完成，请仓库根据预收货单 ${preReceiveOrder.preReceiveNo} 准备收货与扫码验收。`,
          responsibleDepartment: "仓库部",
          responsiblePerson: "Demo Warehouse Owner",
          status: "PENDING",
          priority: "NORMAL",
          startTime: now,
          dueTime: addDays(now, 2),
          contractId: customs.contractId,
          batchId: customs.batchId,
          documentId: customs.packingListDocumentId,
          relatedEntityType: "PreReceiveOrder",
          relatedEntityId: preReceiveOrder.id,
          completionCondition: "完成预收货并进入扫码收货验收。"
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      }));

    await writeAuditLog(
      tx,
      actor,
      request,
      "CUSTOMS_STATUS_UPDATE",
      "CustomsClearance",
      customs.id,
      { status: customs.status, clearanceNo: customs.clearanceNo },
      { status: "COMPLETED", clearanceNo: customs.clearanceNo }
    );

    await writeAuditLog(
      tx,
      actor,
      request,
      "CUSTOMS_TRIGGER_PRE_RECEIVE",
      "CustomsClearance",
      customs.id,
      { preReceiveOrder: existingPreReceive, landTransportWorkOrder: existingLandTransportWorkOrder },
      { preReceiveOrder, landTransportWorkOrder, warehousePreReceiveWorkOrder }
    );

    return {
      updatedCustoms,
      preReceiveOrder,
      landTransportWorkOrder,
      warehousePreReceiveWorkOrder
    };
  });

  const refreshedCustoms = await loadCustomsOr404(request.params.id, response);

  if (!refreshedCustoms) {
    return;
  }

  const [view] = await buildCustomsView([refreshedCustoms]);

  response.json({
    completed: true,
    clearance: view,
    preReceiveOrder: result.preReceiveOrder,
    landTransportWorkOrder: result.landTransportWorkOrder,
    warehousePreReceiveWorkOrder: result.warehousePreReceiveWorkOrder
  });
});
