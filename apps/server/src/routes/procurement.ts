import { Prisma, type PrismaClient } from "@prisma/client";
import type { Request } from "express";
import { Router } from "express";
import { demoScenarioConfig } from "../config/demoScenario";
import { prisma } from "../lib/prisma";

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type ProcurementStatus = "DRAFT" | "SUPPLIER_SHIPPED" | "COLLECTION_COMPLETED";

const procurementStatusOrder: ProcurementStatus[] = ["DRAFT", "SUPPLIER_SHIPPED", "COLLECTION_COMPLETED"];

const shipmentStatusFromProcurement = "COLLECTION_COMPLETED";
const logisticsWorkOrderType = "LOGISTICS_ARRANGEMENT";

export const procurementRouter = Router();

function addDays(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeProcurementStatus(value: string | null | undefined): ProcurementStatus {
  if (value === "SUPPLIER_SHIPPED" || value === "COLLECTION_COMPLETED") {
    return value;
  }

  return "DRAFT";
}

function readAuditContext(request: Request) {
  return {
    ip: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null
  };
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function buildProgressState(status: ProcurementStatus) {
  const currentStepIndex = procurementStatusOrder.indexOf(status);

  return procurementStatusOrder.map((step, index) => {
    let state: "wait" | "process" | "finish" = "wait";

    if (index < currentStepIndex) {
      state = "finish";
    } else if (index === currentStepIndex) {
      state = "process";
    }

    if (status === "COLLECTION_COMPLETED" && index === currentStepIndex) {
      state = "finish";
    }

    return {
      key: step,
      state
    };
  });
}

function resolveRecommendedAction(status: ProcurementStatus) {
  if (status === "DRAFT") {
    return {
      nextStatus: "SUPPLIER_SHIPPED" as ProcurementStatus,
      buttonText: "推进到供应商已发货",
      description: "确认供应商已经发货，采购单进入国内集货前状态。"
    };
  }

  if (status === "SUPPLIER_SHIPPED") {
    return {
      nextStatus: "COLLECTION_COMPLETED" as ProcurementStatus,
      buttonText: "推进到国内集货完成",
      description: "确认国内集货完成，并自动联动生成国际物流记录。"
    };
  }

  return {
    nextStatus: null,
    buttonText: "已完成采购与集货联动",
    description: "当前采购单已经交接给国际物流模块，可进入下一阶段继续演示。"
  };
}

function resolveStatusMeta(status: ProcurementStatus) {
  switch (status) {
    case "SUPPLIER_SHIPPED":
      return {
        label: "供应商已发货",
        color: "processing" as const,
        summary: "供应商已发货，等待国内集货与验收。"
      };
    case "COLLECTION_COMPLETED":
      return {
        label: "国内集货完成",
        color: "success" as const,
        summary: "采购与境内集货已完成，已联动进入国际运输准备。"
      };
    case "DRAFT":
    default:
      return {
        label: "采购下单",
        color: "default" as const,
        summary: "采购单已创建，等待供应商发货。"
      };
  }
}

function canAdvanceToTarget(currentStatus: ProcurementStatus, targetStatus: ProcurementStatus) {
  const currentIndex = procurementStatusOrder.indexOf(currentStatus);
  const targetIndex = procurementStatusOrder.indexOf(targetStatus);

  return targetIndex === currentIndex + 1;
}

async function buildProcurementView(records: Array<{
  id: string;
  purchaseNo: string;
  contractId: string | null;
  supplierName: string;
  skuName: string;
  batchId: string | null;
  quantity: number;
  unit: string;
  deliveryDate: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}>) {
  const contractIds = uniqueIds(records.map((item) => item.contractId));
  const batchIds = uniqueIds(records.map((item) => item.batchId));
  const purchaseOrderIds = records.map((item) => item.id);

  const [contracts, batches, shipments, qrItems, shipmentWorkOrders] = await Promise.all([
    contractIds.length > 0
      ? prisma.contract.findMany({
          where: { id: { in: contractIds } },
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            supplierName: true,
            productName: true,
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
            destinationWarehouse: true
          }
        })
      : Promise.resolve([]),
    purchaseOrderIds.length > 0
      ? prisma.shipment.findMany({
          where: { purchaseOrderId: { in: purchaseOrderIds } },
          select: {
            id: true,
            shipmentNo: true,
            purchaseOrderId: true,
            status: true,
            shippingCompany: true,
            billOfLadingNo: true,
            containerNo: true,
            originPort: true,
            destinationPort: true,
            departureTime: true,
            estimatedArrivalTime: true,
            actualArrivalTime: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    batchIds.length > 0
      ? prisma.qrItem.findMany({
          where: { batchId: { in: batchIds } },
          select: {
            batchId: true,
            status: true
          }
        })
      : Promise.resolve([]),
    purchaseOrderIds.length > 0
      ? prisma.workOrder.findMany({
          where: {
            type: logisticsWorkOrderType
          },
          select: {
            id: true,
            workOrderNo: true,
            title: true,
            status: true,
            priority: true,
            responsibleDepartment: true,
            responsiblePerson: true,
            contractId: true,
            batchId: true,
            relatedEntityType: true,
            relatedEntityId: true,
            dueTime: true,
            startTime: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([])
  ]);

  const contractById = new Map(contracts.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const shipmentByPurchaseOrderId = new Map(shipments.map((item) => [item.purchaseOrderId ?? "", item]));
  const shipmentById = new Map(shipments.map((item) => [item.id, item]));
  const qrItemsByBatchId = new Map<string, Array<{ batchId: string; status: string }>>();

  for (const qrItem of qrItems) {
    const existing = qrItemsByBatchId.get(qrItem.batchId) ?? [];
    existing.push(qrItem);
    qrItemsByBatchId.set(qrItem.batchId, existing);
  }

  const workOrderByShipmentId = new Map(
    shipmentWorkOrders
      .filter((item) => item.relatedEntityType === "Shipment" && item.relatedEntityId)
      .map((item) => [item.relatedEntityId as string, item])
  );

  return records.map((item) => {
    const normalizedStatus = normalizeProcurementStatus(item.status);
    const contract = item.contractId ? contractById.get(item.contractId) ?? null : null;
    const batch = item.batchId ? batchById.get(item.batchId) ?? null : null;
    const shipment = shipmentByPurchaseOrderId.get(item.id) ?? null;
    const shipmentWorkOrder =
      shipment && shipmentById.has(shipment.id) ? workOrderByShipmentId.get(shipment.id) ?? null : null;
    const relatedQrItems = batch ? qrItemsByBatchId.get(batch.id) ?? [] : [];

    return {
      id: item.id,
      purchaseNo: item.purchaseNo,
      supplierName: item.supplierName,
      skuName: item.skuName,
      quantity: item.quantity,
      unit: item.unit,
      deliveryDate: item.deliveryDate?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      status: normalizedStatus,
      statusMeta: resolveStatusMeta(normalizedStatus),
      contract: contract
        ? {
            id: contract.id,
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            supplierName: contract.supplierName,
            productName: contract.productName,
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
            destinationWarehouse: batch.destinationWarehouse
          }
        : null,
      qrSummary: {
        total: relatedQrItems.length,
        pendingInbound: relatedQrItems.filter((qrItem) => qrItem.status === "PENDING_INBOUND").length,
        inStock: relatedQrItems.filter((qrItem) => qrItem.status === "IN_STOCK").length,
        outbound: relatedQrItems.filter((qrItem) => qrItem.status === "OUTBOUND").length
      },
      linkedShipment: shipment
        ? {
            id: shipment.id,
            shipmentNo: shipment.shipmentNo,
            status: shipment.status,
            shippingCompany: shipment.shippingCompany,
            billOfLadingNo: shipment.billOfLadingNo,
            containerNo: shipment.containerNo,
            originPort: shipment.originPort,
            destinationPort: shipment.destinationPort,
            departureTime: shipment.departureTime?.toISOString() ?? null,
            estimatedArrivalTime: shipment.estimatedArrivalTime?.toISOString() ?? null,
            actualArrivalTime: shipment.actualArrivalTime?.toISOString() ?? null,
            createdAt: shipment.createdAt.toISOString(),
            updatedAt: shipment.updatedAt.toISOString()
          }
        : null,
      linkedWorkOrder: shipmentWorkOrder
        ? {
            id: shipmentWorkOrder.id,
            workOrderNo: shipmentWorkOrder.workOrderNo,
            title: shipmentWorkOrder.title,
            status: shipmentWorkOrder.status,
            priority: shipmentWorkOrder.priority,
            responsibleDepartment: shipmentWorkOrder.responsibleDepartment,
            responsiblePerson: shipmentWorkOrder.responsiblePerson,
            startTime: shipmentWorkOrder.startTime?.toISOString() ?? null,
            dueTime: shipmentWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: shipmentWorkOrder.createdAt.toISOString(),
            updatedAt: shipmentWorkOrder.updatedAt.toISOString()
          }
        : null,
      progress: buildProgressState(normalizedStatus),
      recommendedAction: resolveRecommendedAction(normalizedStatus)
    };
  });
}

procurementRouter.get("/orders", async (_request, response) => {
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      purchaseNo: true,
      contractId: true,
      supplierName: true,
      skuName: true,
      batchId: true,
      quantity: true,
      unit: true,
      deliveryDate: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const orders = await buildProcurementView(purchaseOrders);

  response.json({
    summary: {
      totalOrders: orders.length,
      draftOrders: orders.filter((item) => item.status === "DRAFT").length,
      supplierShippedOrders: orders.filter((item) => item.status === "SUPPLIER_SHIPPED").length,
      collectionCompletedOrders: orders.filter((item) => item.status === "COLLECTION_COMPLETED").length,
      linkedShipments: orders.filter((item) => item.linkedShipment).length
    },
    orders
  });
});

procurementRouter.get("/orders/:id", async (request, response) => {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      purchaseNo: true,
      contractId: true,
      supplierName: true,
      skuName: true,
      batchId: true,
      quantity: true,
      unit: true,
      deliveryDate: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!purchaseOrder) {
    response.status(404).json({ message: "Purchase order not found." });
    return;
  }

  const [view] = await buildProcurementView([purchaseOrder]);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      action: {
        in: ["PROCUREMENT_STATUS_UPDATE", "PROCUREMENT_HANDOFF_LOGISTICS"]
      }
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      action: true,
      username: true,
      createdAt: true,
      afterJson: true
    }
  });

  response.json({
    ...view,
    moduleNarrative: {
      role:
        "采购与境内集货模块负责把正式合同拆成可执行采购单，并把供应商发货、国内集货、扫码验收前的状态衔接到国际物流模块。",
      boundary:
        "第一版只做真实采购单列表、详情与状态推进，不做复杂审批，也不直接改变库存。库存仍然只能由二维码扫码入库 / 出库驱动。"
    },
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary:
        item.action === "PROCUREMENT_HANDOFF_LOGISTICS"
          ? "国内集货完成，已自动联动国际物流记录与运输安排工单。"
          : "采购状态已推进。"
    }))
  });
});

procurementRouter.post("/orders/:id/progress", async (request, response) => {
  const targetStatus = String((request.body as { targetStatus?: unknown } | undefined)?.targetStatus ?? "");

  if (targetStatus !== "SUPPLIER_SHIPPED" && targetStatus !== "COLLECTION_COMPLETED") {
    response.status(400).json({ message: "Unsupported targetStatus." });
    return;
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: request.params.id },
    select: {
      id: true,
      purchaseNo: true,
      contractId: true,
      supplierName: true,
      skuName: true,
      batchId: true,
      quantity: true,
      unit: true,
      deliveryDate: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!purchaseOrder) {
    response.status(404).json({ message: "Purchase order not found." });
    return;
  }

  const currentStatus = normalizeProcurementStatus(purchaseOrder.status);
  const normalizedTargetStatus = targetStatus as ProcurementStatus;

  if (!canAdvanceToTarget(currentStatus, normalizedTargetStatus)) {
    response.status(409).json({
      message:
        currentStatus === normalizedTargetStatus
          ? "当前采购单已经处于该状态。"
          : "采购状态只能按顺序推进，不能跳步或回退。"
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await getAuditActor(tx);
    const activeDemoConfig = await tx.demoConfig.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        origin: true,
        destinationWarehouse: true
      }
    });

    const batch = purchaseOrder.batchId
      ? await tx.batch.findUnique({
          where: { id: purchaseOrder.batchId },
          select: {
            id: true,
            batchNo: true,
            destinationWarehouse: true
          }
        })
      : null;

    const previousSnapshot = {
      status: currentStatus
    };

    const updatedPurchaseOrder = await tx.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data: {
        status: normalizedTargetStatus
      },
      select: {
        id: true,
        purchaseNo: true,
        contractId: true,
        supplierName: true,
        skuName: true,
        batchId: true,
        quantity: true,
        unit: true,
        deliveryDate: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await writeAuditLog(
      tx,
      actor,
      request,
      "PROCUREMENT_STATUS_UPDATE",
      "PurchaseOrder",
      updatedPurchaseOrder.id,
      previousSnapshot,
      {
        status: normalizedTargetStatus,
        purchaseNo: updatedPurchaseOrder.purchaseNo
      }
    );

    let shipmentSummary: null | {
      id: string;
      shipmentNo: string;
      status: string;
    } = null;
    let workOrderSummary: null | {
      id: string;
      workOrderNo: string;
      status: string;
    } = null;

    if (normalizedTargetStatus === "COLLECTION_COMPLETED") {
      const existingShipment = await tx.shipment.findFirst({
        where: { purchaseOrderId: updatedPurchaseOrder.id },
        select: {
          id: true,
          shipmentNo: true,
          status: true
        }
      });

      const shipment =
        existingShipment ??
        (await tx.shipment.create({
          data: {
            shipmentNo: `SHP-${updatedPurchaseOrder.purchaseNo.replace(/^PO-/, "")}`,
            contractId: updatedPurchaseOrder.contractId,
            batchId: updatedPurchaseOrder.batchId,
            purchaseOrderId: updatedPurchaseOrder.id,
            shippingCompany: "Demo Shipping Line",
            billOfLadingNo: `BL-${updatedPurchaseOrder.purchaseNo.replace(/^PO-/, "")}`,
            containerNo: `CONT-${updatedPurchaseOrder.purchaseNo.replace(/^PO-/, "")}`,
            originPort: `${activeDemoConfig?.origin ?? demoScenarioConfig.origin} 集货中心`,
            destinationPort:
              batch?.destinationWarehouse ??
              activeDemoConfig?.destinationWarehouse ??
              demoScenarioConfig.destinationWarehouse,
            estimatedArrivalTime: addDays(new Date(), 18),
            status: shipmentStatusFromProcurement
          },
          select: {
            id: true,
            shipmentNo: true,
            status: true
          }
        }));

      shipmentSummary = shipment;

      const shipmentNodeCount = await tx.shipmentNode.count({
        where: {
          shipmentId: shipment.id,
          nodeName: "国内集货完成"
        }
      });

      if (shipmentNodeCount === 0) {
        await tx.shipmentNode.create({
          data: {
            shipmentId: shipment.id,
            nodeName: "国内集货完成",
            nodeStatus: "DONE",
            nodeTime: new Date(),
            remark: "由采购与集货模块自动推进生成"
          }
        });
      }

      const existingWorkOrder = await tx.workOrder.findFirst({
        where: {
          type: logisticsWorkOrderType,
          relatedEntityType: "Shipment",
          relatedEntityId: shipment.id
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      });

      const workOrder =
        existingWorkOrder ??
        (await tx.workOrder.create({
          data: {
            workOrderNo: `WO-LOG-${updatedPurchaseOrder.purchaseNo.replace(/^PO-/, "")}`,
            type: logisticsWorkOrderType,
            title: "国际运输安排工单",
            content: `采购单 ${updatedPurchaseOrder.purchaseNo} 已完成国内集货，请安排国际运输并推进到已装柜 / 已离港。`,
            responsibleDepartment: "物流部",
            responsiblePerson: "Demo Logistics Owner",
            status: "PENDING",
            priority: "NORMAL",
            startTime: new Date(),
            dueTime: addDays(new Date(), 2),
            contractId: updatedPurchaseOrder.contractId,
            batchId: updatedPurchaseOrder.batchId,
            relatedEntityType: "Shipment",
            relatedEntityId: shipment.id,
            completionCondition: "生成运输记录并推进到国际物流节点"
          },
          select: {
            id: true,
            workOrderNo: true,
            status: true
          }
        }));

      workOrderSummary = workOrder;

      await writeAuditLog(
        tx,
        actor,
        request,
        "PROCUREMENT_HANDOFF_LOGISTICS",
        "PurchaseOrder",
        updatedPurchaseOrder.id,
        {
          shipment: existingShipment ?? null
        },
        {
          purchaseStatus: normalizedTargetStatus,
          shipment,
          workOrder
        }
      );
    }

    return {
      updatedPurchaseOrder,
      shipment: shipmentSummary,
      workOrder: workOrderSummary
    };
  });

  const [view] = await buildProcurementView([result.updatedPurchaseOrder]);

  response.json({
    progressed: true,
    order: view,
    logisticsLinked: Boolean(result.shipment),
    shipment: result.shipment,
    workOrder: result.workOrder
  });
});
