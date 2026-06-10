import { DocumentStatus, DocumentType, Prisma, type PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../lib/prisma";

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type LogisticsStage = "COLLECTION_COMPLETED" | "DEPARTED" | "ARRIVED_DESTINATION" | "WAREHOUSE_DELIVERED";
type LogisticsProgressTarget = "DEPARTED" | "ARRIVED_DESTINATION";
type LogisticsTone = "default" | "processing" | "success" | "warning";

type ShipmentRecord = {
  id: string;
  shipmentNo: string;
  contractId: string | null;
  batchId: string | null;
  purchaseOrderId: string | null;
  shippingCompany: string | null;
  billOfLadingNo: string | null;
  containerNo: string | null;
  originPort: string | null;
  destinationPort: string | null;
  departureTime: Date | null;
  estimatedArrivalTime: Date | null;
  actualArrivalTime: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const logisticsWorkOrderType = "LOGISTICS_ARRANGEMENT";
const customsWorkOrderType = "CUSTOMS_CLEARANCE";
const milestoneDefinitions = [
  { key: "COLLECTION_COMPLETED", label: "国内集货完成" },
  { key: "CONTAINER_LOADED", label: "已装柜" },
  { key: "DEPARTED", label: "已离港" },
  { key: "IN_TRANSIT", label: "海运中" },
  { key: "ARRIVED_DESTINATION", label: "到达目的港" },
  { key: "PENDING_CUSTOMS", label: "待清关" }
] as const;

export const logisticsRouter = Router();

function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

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

function readJsonObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function buildQuantityLabel(quantity: number | null | undefined, unit: string | null | undefined) {
  if (typeof quantity !== "number" || !unit) {
    return null;
  }

  return `${quantity}${unit}`;
}

function normalizeShipmentStage(
  shipment: Pick<ShipmentRecord, "status">,
  nodeNames: Set<string>,
  customsStatus?: string | null
): LogisticsStage {
  if (shipment.status === "WAREHOUSE_DELIVERED") {
    return "WAREHOUSE_DELIVERED";
  }

  if (
    nodeNames.has("待清关") ||
    nodeNames.has("到达目的港") ||
    shipment.status === "PENDING_CUSTOMS" ||
    shipment.status === "ARRIVED_DESTINATION" ||
    customsStatus === "PENDING" ||
    customsStatus === "COMPLETED"
  ) {
    return "ARRIVED_DESTINATION";
  }

  if (
    nodeNames.has("海运中") ||
    nodeNames.has("已离港") ||
    shipment.status === "DEPARTED" ||
    shipment.status === "IN_TRANSIT"
  ) {
    return "DEPARTED";
  }

  return "COLLECTION_COMPLETED";
}

function resolveStatusMeta(stage: LogisticsStage) {
  switch (stage) {
    case "WAREHOUSE_DELIVERED":
      return {
        label: "已交接仓储",
        color: "success" as const,
        summary: "国际物流链路已完成，货物已交接到后续仓储与销售环节。"
      };
    case "ARRIVED_DESTINATION":
      return {
        label: "到港待清关",
        color: "warning" as const,
        summary: "货物已到达目的港，系统已联动生成清关草稿与清关工单。"
      };
    case "DEPARTED":
      return {
        label: "海运中",
        color: "processing" as const,
        summary: "货物已离港并进入海运中，可继续推进到到达目的港。"
      };
    case "COLLECTION_COMPLETED":
    default:
      return {
        label: "待离港",
        color: "default" as const,
        summary: "采购与国内集货已完成，等待装柜与离港。"
      };
  }
}

function resolveRecommendedAction(stage: LogisticsStage) {
  if (stage === "COLLECTION_COMPLETED") {
    return {
      nextStatus: "DEPARTED" as LogisticsProgressTarget,
      buttonText: "模拟已离港",
      description: "推进运输节点到“已装柜 / 已离港 / 海运中”，进入真实运输演示。"
    };
  }

  if (stage === "DEPARTED") {
    return {
      nextStatus: "ARRIVED_DESTINATION" as LogisticsProgressTarget,
      buttonText: "模拟到达目的港",
      description: "推进运输节点到“到达目的港 / 待清关”，并自动联动清关草稿与清关工单。"
    };
  }

  return {
    nextStatus: null,
    buttonText: "已完成当前物流推进",
    description: "当前运输记录已经交接到清关或更后续阶段，可进入报关清关模块继续演示。"
  };
}

function buildMilestoneView(
  nodes: Array<{
    nodeName: string;
    nodeTime: Date | null;
    remark: string | null;
  }>,
  stage: LogisticsStage
) {
  const nodeByName = new Map(nodes.map((item) => [item.nodeName, item]));
  const stageRank: Record<LogisticsStage, number> = {
    COLLECTION_COMPLETED: 0,
    DEPARTED: 3,
    ARRIVED_DESTINATION: 5,
    WAREHOUSE_DELIVERED: 5
  };
  const currentRank = stageRank[stage];
  const stageProcessLabel =
    stage === "COLLECTION_COMPLETED"
      ? "已装柜"
      : stage === "DEPARTED"
        ? "海运中"
        : stage === "ARRIVED_DESTINATION" || stage === "WAREHOUSE_DELIVERED"
          ? "待清关"
          : null;

  return milestoneDefinitions.map((definition, index) => {
    const existing = nodeByName.get(definition.label) ?? null;
    const isFinished = Boolean(existing);
    const isProcess = !existing && stageProcessLabel === definition.label;
    const isReachable = index <= currentRank;
    const tone: LogisticsTone = isFinished ? "success" : isProcess ? "processing" : isReachable ? "warning" : "default";

    return {
      key: definition.key,
      label: definition.label,
      tone,
      completed: isFinished,
      time: existing?.nodeTime?.toISOString() ?? null,
      remark: existing?.remark ?? null
    };
  });
}

function buildAiCheckResult(input: {
  packingListQuantity: string | null;
  invoiceQuantity: string | null;
  billOfLadingContainerNo: string | null;
}) {
  const quantitiesMatch =
    input.packingListQuantity &&
    input.invoiceQuantity &&
    input.packingListQuantity === input.invoiceQuantity;

  return {
    packingListQuantity: input.packingListQuantity,
    invoiceQuantity: input.invoiceQuantity,
    billOfLadingContainerNo: input.billOfLadingContainerNo,
    aiConclusion: quantitiesMatch ? "单据数量一致，可进入清关流程。" : "单据数量存在差异，请人工复核。"
  } satisfies Record<string, string | null>;
}

async function buildLogisticsView(records: ShipmentRecord[]) {
  const shipmentIds = records.map((item) => item.id);
  const contractIds = uniqueIds(records.map((item) => item.contractId));
  const batchIds = uniqueIds(records.map((item) => item.batchId));
  const purchaseOrderIds = uniqueIds(records.map((item) => item.purchaseOrderId));

  const [contracts, batches, purchaseOrders, qrItems, nodes, customsClearances, logisticsWorkOrders] = await Promise.all([
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
            totalQuantity: true,
            unit: true,
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
      ? prisma.purchaseOrder.findMany({
          where: { id: { in: purchaseOrderIds } },
          select: {
            id: true,
            purchaseNo: true,
            supplierName: true,
            skuName: true,
            quantity: true,
            unit: true,
            status: true,
            deliveryDate: true
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
    shipmentIds.length > 0
      ? prisma.shipmentNode.findMany({
          where: { shipmentId: { in: shipmentIds } },
          orderBy: [{ nodeTime: "asc" }, { createdAt: "asc" }],
          select: {
            shipmentId: true,
            nodeName: true,
            nodeTime: true,
            remark: true
          }
        })
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? prisma.customsClearance.findMany({
          where: { shipmentId: { in: shipmentIds } },
          select: {
            id: true,
            shipmentId: true,
            clearanceNo: true,
            responsibleCompany: true,
            responsiblePerson: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    shipmentIds.length > 0
      ? prisma.workOrder.findMany({
          where: {
            type: logisticsWorkOrderType,
            relatedEntityType: "Shipment",
            relatedEntityId: { in: shipmentIds }
          },
          select: {
            id: true,
            workOrderNo: true,
            title: true,
            status: true,
            priority: true,
            responsibleDepartment: true,
            responsiblePerson: true,
            startTime: true,
            dueTime: true,
            relatedEntityId: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([])
  ]);

  const customsIds = customsClearances.map((item) => item.id);
  const customsWorkOrders =
    customsIds.length > 0
      ? await prisma.workOrder.findMany({
          where: {
            type: customsWorkOrderType,
            relatedEntityType: "CustomsClearance",
            relatedEntityId: { in: customsIds }
          },
          select: {
            id: true,
            workOrderNo: true,
            title: true,
            status: true,
            priority: true,
            responsibleDepartment: true,
            responsiblePerson: true,
            startTime: true,
            dueTime: true,
            relatedEntityId: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : [];

  const contractById = new Map(contracts.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const purchaseOrderById = new Map(purchaseOrders.map((item) => [item.id, item]));
  const logisticsWorkOrderByShipmentId = new Map(logisticsWorkOrders.map((item) => [item.relatedEntityId ?? "", item]));
  const customsByShipmentId = new Map(customsClearances.map((item) => [item.shipmentId ?? "", item]));
  const customsWorkOrderByCustomsId = new Map(customsWorkOrders.map((item) => [item.relatedEntityId ?? "", item]));

  const qrItemsByBatchId = new Map<string, Array<{ batchId: string; status: string }>>();
  for (const qrItem of qrItems) {
    const current = qrItemsByBatchId.get(qrItem.batchId) ?? [];
    current.push(qrItem);
    qrItemsByBatchId.set(qrItem.batchId, current);
  }

  const nodesByShipmentId = new Map<string, Array<{ nodeName: string; nodeTime: Date | null; remark: string | null }>>();
  for (const node of nodes) {
    const current = nodesByShipmentId.get(node.shipmentId) ?? [];
    current.push({
      nodeName: node.nodeName,
      nodeTime: node.nodeTime,
      remark: node.remark
    });
    nodesByShipmentId.set(node.shipmentId, current);
  }

  return records.map((shipment) => {
    const contract = shipment.contractId ? contractById.get(shipment.contractId) ?? null : null;
    const batch = shipment.batchId ? batchById.get(shipment.batchId) ?? null : null;
    const purchaseOrder = shipment.purchaseOrderId ? purchaseOrderById.get(shipment.purchaseOrderId) ?? null : null;
    const shipmentNodes = nodesByShipmentId.get(shipment.id) ?? [];
    const customs = customsByShipmentId.get(shipment.id) ?? null;
    const logisticsWorkOrder = logisticsWorkOrderByShipmentId.get(shipment.id) ?? null;
    const customsWorkOrder = customs ? customsWorkOrderByCustomsId.get(customs.id) ?? null : null;
    const relatedQrItems = batch ? qrItemsByBatchId.get(batch.id) ?? [] : [];
    const stage = normalizeShipmentStage(
      shipment,
      new Set(shipmentNodes.map((item) => item.nodeName)),
      customs?.status ?? null
    );

    return {
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
      createdAt: shipment.createdAt.toISOString(),
      updatedAt: shipment.updatedAt.toISOString(),
      stage,
      statusMeta: resolveStatusMeta(stage),
      contract: contract
        ? {
            id: contract.id,
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            supplierName: contract.supplierName,
            productName: contract.productName,
            destinationWarehouse: contract.destinationWarehouse,
            totalQuantity: contract.totalQuantity,
            unit: contract.unit,
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
      purchaseOrder: purchaseOrder
        ? {
            id: purchaseOrder.id,
            purchaseNo: purchaseOrder.purchaseNo,
            supplierName: purchaseOrder.supplierName,
            skuName: purchaseOrder.skuName,
            quantity: purchaseOrder.quantity,
            unit: purchaseOrder.unit,
            status: purchaseOrder.status,
            deliveryDate: purchaseOrder.deliveryDate?.toISOString() ?? null
          }
        : null,
      qrSummary: {
        total: relatedQrItems.length,
        pendingInbound: relatedQrItems.filter((item) => item.status === "PENDING_INBOUND").length,
        inStock: relatedQrItems.filter((item) => item.status === "IN_STOCK").length,
        outbound: relatedQrItems.filter((item) => item.status === "OUTBOUND").length
      },
      timeline: buildMilestoneView(shipmentNodes, stage),
      linkedLogisticsWorkOrder: logisticsWorkOrder
        ? {
            id: logisticsWorkOrder.id,
            workOrderNo: logisticsWorkOrder.workOrderNo,
            title: logisticsWorkOrder.title,
            status: logisticsWorkOrder.status,
            priority: logisticsWorkOrder.priority,
            responsibleDepartment: logisticsWorkOrder.responsibleDepartment,
            responsiblePerson: logisticsWorkOrder.responsiblePerson,
            startTime: logisticsWorkOrder.startTime?.toISOString() ?? null,
            dueTime: logisticsWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: logisticsWorkOrder.createdAt.toISOString(),
            updatedAt: logisticsWorkOrder.updatedAt.toISOString()
          }
        : null,
      linkedCustomsClearance: customs
        ? {
            id: customs.id,
            clearanceNo: customs.clearanceNo,
            responsibleCompany: customs.responsibleCompany,
            responsiblePerson: customs.responsiblePerson,
            status: customs.status,
            createdAt: customs.createdAt.toISOString(),
            updatedAt: customs.updatedAt.toISOString()
          }
        : null,
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
      recommendedAction: resolveRecommendedAction(stage)
    };
  });
}

async function loadShipmentOr404(shipmentId: string, response: Response) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: {
      id: true,
      shipmentNo: true,
      contractId: true,
      batchId: true,
      purchaseOrderId: true,
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
  });

  if (!shipment) {
    response.status(404).json({ message: "Shipment not found." });
    return null;
  }

  return shipment;
}

logisticsRouter.get("/shipments", async (_request, response) => {
  const shipments = await prisma.shipment.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shipmentNo: true,
      contractId: true,
      batchId: true,
      purchaseOrderId: true,
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
  });

  const logisticsShipments = await buildLogisticsView(shipments);

  response.json({
    summary: {
      totalShipments: logisticsShipments.length,
      readyToDepartShipments: logisticsShipments.filter((item) => item.stage === "COLLECTION_COMPLETED").length,
      inTransitShipments: logisticsShipments.filter((item) => item.stage === "DEPARTED").length,
      pendingCustomsShipments: logisticsShipments.filter((item) => item.stage === "ARRIVED_DESTINATION").length,
      linkedCustomsClearances: logisticsShipments.filter((item) => item.linkedCustomsClearance).length
    },
    shipments: logisticsShipments
  });
});

logisticsRouter.get("/shipments/:id", async (request, response) => {
  const shipment = await loadShipmentOr404(request.params.id, response);

  if (!shipment) {
    return;
  }

  const [view] = await buildLogisticsView([shipment]);
  const documents =
    view.contract && view.batch
      ? await prisma.document.findMany({
          where: {
            status: DocumentStatus.ACTIVE,
            contractNoDraft: view.contract.contractNo,
            batchNoDraft: view.batch.batchNo
          },
          orderBy: { createdAt: "asc" },
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
      : [];

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "Shipment",
      entityId: shipment.id,
      action: {
        in: ["LOGISTICS_STATUS_UPDATE", "LOGISTICS_TRIGGER_CUSTOMS"]
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
        "国际物流模块负责承接采购与集货后的运输执行，展示运输批次、提单、柜号、起运与到港节点，并把业务上下文正式交给清关模块。",
      boundary:
        "第一版只做真实运输记录、节点时间轴和状态推进，不接真实船公司接口，也不直接影响库存。库存仍然只能由二维码扫码入库 / 出库驱动。"
    },
    documents: documents.map((item) => ({
      id: item.id,
      documentType: item.documentType,
      originalName: item.originalName,
      status: item.status,
      aiStatus: item.aiStatus,
      businessCreated: item.businessCreated,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    })),
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary:
        item.action === "LOGISTICS_TRIGGER_CUSTOMS"
          ? "已到达目的港，并自动联动清关草稿与清关工单。"
          : "物流状态已推进。"
    }))
  });
});

logisticsRouter.post("/shipments/:id/progress", async (request, response) => {
  const targetStatus = String((request.body as { targetStatus?: unknown } | undefined)?.targetStatus ?? "");

  if (targetStatus !== "DEPARTED" && targetStatus !== "ARRIVED_DESTINATION") {
    response.status(400).json({ message: "Unsupported targetStatus." });
    return;
  }

  const shipment = await loadShipmentOr404(request.params.id, response);

  if (!shipment) {
    return;
  }

  const [existingNodes, existingCustoms] = await Promise.all([
    prisma.shipmentNode.findMany({
      where: { shipmentId: shipment.id },
      select: { nodeName: true }
    }),
    prisma.customsClearance.findFirst({
      where: { shipmentId: shipment.id },
      select: { status: true }
    })
  ]);

  const currentStage = normalizeShipmentStage(
    shipment,
    new Set(existingNodes.map((item) => item.nodeName)),
    existingCustoms?.status ?? null
  );

  if (targetStatus === "DEPARTED" && currentStage !== "COLLECTION_COMPLETED") {
    response.status(409).json({
      message:
        currentStage === "DEPARTED"
          ? "当前运输批次已经处于海运中。"
          : "当前运输批次不能再推进到已离港。"
    });
    return;
  }

  if (targetStatus === "ARRIVED_DESTINATION" && currentStage !== "DEPARTED") {
    response.status(409).json({
      message:
        currentStage === "ARRIVED_DESTINATION" || currentStage === "WAREHOUSE_DELIVERED"
          ? "当前运输批次已经到达目的港或已交接后续环节。"
          : "请先推进到已离港，再模拟到达目的港。"
    });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await getAuditActor(tx);
    const currentTimestamp = new Date();
    const [nodes, logisticsWorkOrder] = await Promise.all([
      tx.shipmentNode.findMany({
        where: { shipmentId: shipment.id },
        select: {
          nodeName: true
        }
      }),
      tx.workOrder.findFirst({
        where: {
          type: logisticsWorkOrderType,
          relatedEntityType: "Shipment",
          relatedEntityId: shipment.id
        },
        select: {
          id: true,
          status: true
        }
      })
    ]);
    const nodeNameSet = new Set(nodes.map((item) => item.nodeName));

    const ensureNode = async (nodeName: string, nodeTime: Date, remark: string) => {
      if (nodeNameSet.has(nodeName)) {
        return;
      }

      await tx.shipmentNode.create({
        data: {
          shipmentId: shipment.id,
          nodeName,
          nodeStatus: "DONE",
          nodeTime,
          remark,
          createdAt: nodeTime
        }
      });
      nodeNameSet.add(nodeName);
    };

    let customsSummary: null | { id: string; clearanceNo: string; status: string } = null;
    let customsWorkOrderSummary: null | { id: string; workOrderNo: string; status: string } = null;

    if (targetStatus === "DEPARTED") {
      const loadedAt = addHours(currentTimestamp, -2);
      const departedAt = addHours(currentTimestamp, -1);
      const inTransitAt = currentTimestamp;

      await ensureNode("已装柜", loadedAt, "物流模块模拟推进到已装柜。");
      await ensureNode("已离港", departedAt, "物流模块模拟推进到已离港。");
      await ensureNode("海运中", inTransitAt, "物流模块模拟推进到海运中。");

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          departureTime: shipment.departureTime ?? departedAt,
          estimatedArrivalTime: shipment.estimatedArrivalTime ?? addDays(currentTimestamp, 18),
          status: "IN_TRANSIT"
        }
      });

      if (logisticsWorkOrder && logisticsWorkOrder.status === "PENDING") {
        await tx.workOrder.update({
          where: { id: logisticsWorkOrder.id },
          data: {
            status: "IN_PROGRESS",
            startTime: currentTimestamp
          }
        });
      }

      await writeAuditLog(
        tx,
        actor,
        request,
        "LOGISTICS_STATUS_UPDATE",
        "Shipment",
        shipment.id,
        { stage: currentStage, shipmentNo: shipment.shipmentNo },
        { stage: targetStatus, shipmentNo: shipment.shipmentNo }
      );
    }

    if (targetStatus === "ARRIVED_DESTINATION") {
      const arrivedAt = currentTimestamp;
      const customsReadyAt = addHours(currentTimestamp, 1);

      await ensureNode("到达目的港", arrivedAt, "物流模块模拟推进到到达目的港。");
      await ensureNode("待清关", customsReadyAt, "已自动进入清关准备阶段。");

      await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          actualArrivalTime: arrivedAt,
          estimatedArrivalTime: shipment.estimatedArrivalTime ?? arrivedAt,
          status: "PENDING_CUSTOMS"
        }
      });

      if (logisticsWorkOrder && logisticsWorkOrder.status !== "COMPLETED") {
        await tx.workOrder.update({
          where: { id: logisticsWorkOrder.id },
          data: {
            status: "COMPLETED"
          }
        });
      }

      const [contract, batch] = await Promise.all([
        shipment.contractId
          ? tx.contract.findUnique({
              where: { id: shipment.contractId },
              select: {
                id: true,
                contractNo: true,
                totalQuantity: true,
                unit: true
              }
            })
          : Promise.resolve(null),
        shipment.batchId
          ? tx.batch.findUnique({
              where: { id: shipment.batchId },
              select: {
                id: true,
                batchNo: true,
                totalQuantity: true,
                unit: true
              }
            })
          : Promise.resolve(null)
      ]);

      const documents =
        contract && batch
          ? await tx.document.findMany({
              where: {
                status: DocumentStatus.ACTIVE,
                contractNoDraft: contract.contractNo,
                batchNoDraft: batch.batchNo
              },
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                documentType: true,
                extractedJson: true
              }
            })
          : [];

      const packingListDocument = documents.find((item) => item.documentType === DocumentType.PACKING_LIST) ?? null;
      const invoiceDocument = documents.find((item) => item.documentType === DocumentType.INVOICE) ?? null;
      const billOfLadingDocument = documents.find((item) => item.documentType === DocumentType.BILL_OF_LADING) ?? null;
      const packingListJson = readJsonObject(packingListDocument?.extractedJson);
      const invoiceJson = readJsonObject(invoiceDocument?.extractedJson);
      const billOfLadingJson = readJsonObject(billOfLadingDocument?.extractedJson);
      const quantityFallback = buildQuantityLabel(
        batch?.totalQuantity ?? contract?.totalQuantity ?? null,
        batch?.unit ?? contract?.unit ?? null
      );
      const aiCheckResult = buildAiCheckResult({
        packingListQuantity:
          buildQuantityLabel(readOptionalNumber(packingListJson.totalQuantity), readOptionalString(packingListJson.unit)) ??
          quantityFallback,
        invoiceQuantity:
          buildQuantityLabel(readOptionalNumber(invoiceJson.totalQuantity), readOptionalString(invoiceJson.unit)) ??
          quantityFallback,
        billOfLadingContainerNo:
          readOptionalString(billOfLadingJson.containerNoDraft) ??
          readOptionalString(billOfLadingJson.containerNo) ??
          shipment.containerNo
      });

      const existingCustomsClearance = await tx.customsClearance.findFirst({
        where: { shipmentId: shipment.id },
        select: {
          id: true,
          clearanceNo: true,
          status: true
        }
      });

      const customsClearance =
        existingCustomsClearance ??
        (await tx.customsClearance.create({
          data: {
            clearanceNo: `CUS-${shipment.shipmentNo.replace(/^SHP-/, "")}`,
            contractId: shipment.contractId,
            batchId: shipment.batchId,
            shipmentId: shipment.id,
            responsibleCompany: "赞比亚公司",
            responsiblePerson: "Demo Customs Owner",
            packingListDocumentId: packingListDocument?.id ?? null,
            invoiceDocumentId: invoiceDocument?.id ?? null,
            billOfLadingDocumentId: billOfLadingDocument?.id ?? null,
            aiCheckResult: toAuditJson(aiCheckResult),
            status: "PENDING"
          },
          select: {
            id: true,
            clearanceNo: true,
            status: true
          }
        }));

      if (existingCustomsClearance) {
        await tx.customsClearance.update({
          where: { id: existingCustomsClearance.id },
          data: {
            responsibleCompany: "赞比亚公司",
            responsiblePerson: "Demo Customs Owner",
            packingListDocumentId: packingListDocument?.id ?? null,
            invoiceDocumentId: invoiceDocument?.id ?? null,
            billOfLadingDocumentId: billOfLadingDocument?.id ?? null,
            aiCheckResult: toAuditJson(aiCheckResult),
            status: existingCustomsClearance.status === "COMPLETED" ? "COMPLETED" : "PENDING"
          }
        });
      }

      customsSummary = customsClearance;

      const existingCustomsWorkOrder = await tx.workOrder.findFirst({
        where: {
          type: customsWorkOrderType,
          relatedEntityType: "CustomsClearance",
          relatedEntityId: customsClearance.id
        },
        select: {
          id: true,
          workOrderNo: true,
          status: true
        }
      });

      const customsWorkOrder =
        existingCustomsWorkOrder ??
        (await tx.workOrder.create({
          data: {
            workOrderNo: `WO-CUS-${shipment.shipmentNo.replace(/^SHP-/, "")}`,
            type: customsWorkOrderType,
            title: "清关工单",
            content: `运输批次 ${shipment.shipmentNo} 已到达目的港，请核对箱单、发票、提单并推进清关。`,
            responsibleDepartment: "清关部",
            responsiblePerson: "Demo Customs Owner",
            status: "PENDING",
            priority: "HIGH",
            startTime: arrivedAt,
            dueTime: addDays(arrivedAt, 2),
            contractId: shipment.contractId,
            batchId: shipment.batchId,
            documentId: billOfLadingDocument?.id ?? null,
            relatedEntityType: "CustomsClearance",
            relatedEntityId: customsClearance.id,
            completionCondition: "完成清关并生成仓库预收货。"
          },
          select: {
            id: true,
            workOrderNo: true,
            status: true
          }
        }));

      customsWorkOrderSummary = customsWorkOrder;

      await writeAuditLog(
        tx,
        actor,
        request,
        "LOGISTICS_STATUS_UPDATE",
        "Shipment",
        shipment.id,
        { stage: currentStage, shipmentNo: shipment.shipmentNo },
        { stage: targetStatus, shipmentNo: shipment.shipmentNo }
      );

      await writeAuditLog(
        tx,
        actor,
        request,
        "LOGISTICS_TRIGGER_CUSTOMS",
        "Shipment",
        shipment.id,
        { customsClearance: existingCustomsClearance ?? null },
        {
          customsClearance,
          customsWorkOrder,
          aiCheckResult
        }
      );
    }

    return {
      customsClearance: customsSummary,
      customsWorkOrder: customsWorkOrderSummary
    };
  });

  const refreshedShipment = await loadShipmentOr404(request.params.id, response);

  if (!refreshedShipment) {
    return;
  }

  const [view] = await buildLogisticsView([refreshedShipment]);

  response.json({
    progressed: true,
    shipment: view,
    customsLinked: Boolean(result.customsClearance),
    customsClearance: result.customsClearance,
    customsWorkOrder: result.customsWorkOrder
  });
});
