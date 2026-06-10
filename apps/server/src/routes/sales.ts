import { Prisma, type PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../lib/prisma";

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type SalesStage = "READY" | "IN_TRANSIT" | "DELIVERED";

type SalesRecord = {
  id: string;
  salesNo: string;
  contractId: string | null;
  batchId: string | null;
  customerId: string | null;
  customerName: string;
  companyId: string | null;
  skuName: string;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
  deliveryMethod: string | null;
  deliveryStatus: string;
  signStatus: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

const receivableWorkOrderType = "RECEIVABLE_FOLLOW_UP";

export const salesRouter = Router();

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
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

function normalizeSalesStage(deliveryStatus: string | null | undefined, signStatus: string | null | undefined): SalesStage {
  if (signStatus === "SIGNED" || deliveryStatus === "DELIVERED" || deliveryStatus === "COMPLETED") {
    return "DELIVERED";
  }

  if (deliveryStatus === "IN_TRANSIT" || deliveryStatus === "DELIVERING") {
    return "IN_TRANSIT";
  }

  return "READY";
}

function resolveStageMeta(stage: SalesStage) {
  switch (stage) {
    case "IN_TRANSIT":
      return {
        label: "配送中",
        color: "processing" as const,
        summary: "销售单已经进入配送执行阶段，可继续模拟客户签收并联动财务待回款。"
      };
    case "DELIVERED":
      return {
        label: "已配送完成",
        color: "success" as const,
        summary: "配送已经完成，系统已把应收记录推进到待回款跟进状态。"
      };
    case "READY":
    default:
      return {
        label: "待配送",
        color: "default" as const,
        summary: "销售单已创建，等待配送执行或人工模拟客户签收。"
      };
  }
}

function resolveRecommendedAction(stage: SalesStage, outboundCompleted: boolean) {
  if (stage === "DELIVERED") {
    return {
      canComplete: false,
      buttonText: "已完成配送交接",
      description: "当前销售单已经完成配送，可去财务回款模块继续演示后续回款与核销。"
    };
  }

  if (stage === "IN_TRANSIT") {
    return {
      canComplete: true,
      buttonText: "模拟配送完成",
      description: "确认客户已签收，系统会联动财务应收进入待回款状态，并生成或刷新财务跟进工单。"
    };
  }

  return {
    canComplete: true,
    buttonText: "模拟配送完成",
    description: outboundCompleted
      ? "仓储出库已经完成，可直接模拟客户签收，并把财务应收推进到待回款状态。"
      : "第一版允许直接模拟配送完成，用于演示销售到财务的联动；该操作不会改写库存，库存仍以二维码出库为准。"
  };
}

function resolveSignStatusMeta(signStatus: string | null | undefined) {
  if (signStatus === "SIGNED") {
    return {
      label: "已签收",
      color: "success" as const
    };
  }

  return {
    label: "未签收",
    color: "warning" as const
  };
}

function buildProgress(outboundCompleted: boolean, stage: SalesStage) {
  return [
    {
      key: "SALES_CREATED",
      title: "销售单已创建",
      state: "finish" as const
    },
    {
      key: "WAREHOUSE_OUTBOUND",
      title: "仓库已出库",
      state: outboundCompleted || stage !== "READY" ? ("finish" as const) : ("process" as const)
    },
    {
      key: "IN_DELIVERY",
      title: "配送执行中",
      state:
        stage === "DELIVERED" ? ("finish" as const) : stage === "IN_TRANSIT" ? ("process" as const) : ("wait" as const)
    },
    {
      key: "DELIVERED",
      title: "客户已签收",
      state: stage === "DELIVERED" ? ("finish" as const) : ("wait" as const)
    }
  ];
}

function calculateNormalizedSalesAmount(input: {
  salesAmount: number;
  salesQuantity: number;
  contractAmount?: number | null;
  contractTotalQuantity?: number | null;
}) {
  const { salesAmount, salesQuantity, contractAmount, contractTotalQuantity } = input;

  if (salesAmount > 0 && contractAmount && contractTotalQuantity) {
    if (salesQuantity > 0 && salesQuantity < contractTotalQuantity && salesAmount >= contractAmount) {
      return roundMoney(contractAmount * (salesQuantity / contractTotalQuantity));
    }

    return roundMoney(salesAmount);
  }

  if (salesAmount > 0) {
    return roundMoney(salesAmount);
  }

  if (contractAmount && contractTotalQuantity && contractTotalQuantity > 0) {
    return roundMoney(contractAmount * (salesQuantity / contractTotalQuantity));
  }

  return 0;
}

function mapReceivableStatus(status: string | null | undefined, amount: number, receivedAmount: number) {
  const openAmount = roundMoney(Math.max(amount - receivedAmount, 0));

  if (openAmount <= 0) {
    return {
      status: "PAID",
      label: "已回款",
      color: "success" as const,
      openAmount
    };
  }

  if (receivedAmount > 0) {
    return {
      status: "PARTIAL",
      label: "部分回款",
      color: "processing" as const,
      openAmount
    };
  }

  if (status === "PENDING_COLLECTION") {
    return {
      status,
      label: "待回款",
      color: "warning" as const,
      openAmount
    };
  }

  return {
    status: status ?? "UNPAID",
    label: "待回款",
    color: "warning" as const,
    openAmount
  };
}

function buildReceivableScopeLabel(scope: "SALES_ORDER" | "CONTRACT") {
  return scope === "SALES_ORDER" ? "销售单级应收" : "合同级应收草稿";
}

async function loadSalesOrderOr404(salesOrderId: string, response: Response) {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: salesOrderId },
    select: {
      id: true,
      salesNo: true,
      contractId: true,
      batchId: true,
      customerId: true,
      customerName: true,
      companyId: true,
      skuName: true,
      quantity: true,
      unit: true,
      amount: true,
      currency: true,
      deliveryMethod: true,
      deliveryStatus: true,
      signStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!salesOrder) {
    response.status(404).json({ message: "Sales order not found." });
    return null;
  }

  return salesOrder;
}

async function buildSalesView(records: SalesRecord[]) {
  const contractIds = uniqueIds(records.map((item) => item.contractId));
  const batchIds = uniqueIds(records.map((item) => item.batchId));
  const salesOrderIds = records.map((item) => item.id);

  const [contracts, batches, outboundOrders, deliveryOrders, receivables, workOrders, qrItems, warehouses] =
    await Promise.all([
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
              amount: true,
              currency: true,
              destinationWarehouse: true,
              paymentStatus: true
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
      salesOrderIds.length > 0
        ? prisma.outboundOrder.findMany({
            where: { salesOrderId: { in: salesOrderIds } },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              outboundNo: true,
              salesOrderId: true,
              batchId: true,
              warehouseId: true,
              quantity: true,
              unit: true,
              status: true,
              updatedAt: true
            }
          })
        : Promise.resolve([]),
      salesOrderIds.length > 0
        ? prisma.deliveryOrder.findMany({
            where: { salesOrderId: { in: salesOrderIds } },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              deliveryNo: true,
              salesOrderId: true,
              batchId: true,
              warehouseId: true,
              warehouseName: true,
              quantity: true,
              unit: true,
              status: true,
              createdAt: true,
              updatedAt: true
            }
          })
        : Promise.resolve([]),
      salesOrderIds.length > 0 || contractIds.length > 0
        ? prisma.receivable.findMany({
            where: {
              OR: [
                ...(salesOrderIds.length > 0 ? [{ salesOrderId: { in: salesOrderIds } }] : []),
                ...(contractIds.length > 0 ? [{ contractId: { in: contractIds } }] : [])
              ]
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
            select: {
              id: true,
              contractId: true,
              salesOrderId: true,
              amount: true,
              currency: true,
              dueDate: true,
              receivedAmount: true,
              status: true,
              createdAt: true,
              updatedAt: true
            }
          })
        : Promise.resolve([]),
      contractIds.length > 0 || salesOrderIds.length > 0
        ? prisma.workOrder.findMany({
            where: {
              type: receivableWorkOrderType
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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
              contractId: true,
              batchId: true,
              relatedEntityType: true,
              relatedEntityId: true,
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
      batchIds.length > 0
        ? prisma.warehouse.findMany({
            select: {
              id: true,
              name: true
            }
          })
        : Promise.resolve([])
    ]);

  const contractById = new Map(contracts.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const warehouseById = new Map(warehouses.map((item) => [item.id, item]));
  const outboundOrderBySalesOrderId = new Map<string, (typeof outboundOrders)[number]>();
  const deliveryOrderBySalesOrderId = new Map<string, (typeof deliveryOrders)[number]>();
  const receivablesBySalesOrderId = new Map<string, Array<(typeof receivables)[number]>>();
  const contractLevelReceivableByContractId = new Map<string, (typeof receivables)[number]>();
  const financeWorkOrderByReceivableId = new Map<string, (typeof workOrders)[number]>();
  const qrItemsByBatchId = new Map<string, Array<{ batchId: string; status: string }>>();

  for (const item of outboundOrders) {
    if (item.salesOrderId && !outboundOrderBySalesOrderId.has(item.salesOrderId)) {
      outboundOrderBySalesOrderId.set(item.salesOrderId, item);
    }
  }

  for (const item of deliveryOrders) {
    if (item.salesOrderId && !deliveryOrderBySalesOrderId.has(item.salesOrderId)) {
      deliveryOrderBySalesOrderId.set(item.salesOrderId, item);
    }
  }

  for (const item of receivables) {
    if (item.salesOrderId) {
      const current = receivablesBySalesOrderId.get(item.salesOrderId) ?? [];
      current.push(item);
      receivablesBySalesOrderId.set(item.salesOrderId, current);
    }

    if (item.contractId && item.salesOrderId === null && !contractLevelReceivableByContractId.has(item.contractId)) {
      contractLevelReceivableByContractId.set(item.contractId, item);
    }
  }

  for (const item of workOrders) {
    if (item.relatedEntityType === "Receivable" && item.relatedEntityId && !financeWorkOrderByReceivableId.has(item.relatedEntityId)) {
      financeWorkOrderByReceivableId.set(item.relatedEntityId, item);
    }
  }

  for (const item of qrItems) {
    const current = qrItemsByBatchId.get(item.batchId) ?? [];
    current.push(item);
    qrItemsByBatchId.set(item.batchId, current);
  }

  return records.map((salesOrder) => {
    const contract = salesOrder.contractId ? contractById.get(salesOrder.contractId) ?? null : null;
    const batch = salesOrder.batchId ? batchById.get(salesOrder.batchId) ?? null : null;
    const outboundOrder = outboundOrderBySalesOrderId.get(salesOrder.id) ?? null;
    const deliveryOrder = deliveryOrderBySalesOrderId.get(salesOrder.id) ?? null;
    const outboundCompleted =
      outboundOrder?.status === "COMPLETED" ||
      Boolean(batch && (qrItemsByBatchId.get(batch.id) ?? []).filter((item) => item.status === "OUTBOUND").length >= salesOrder.quantity);
    const stage = normalizeSalesStage(salesOrder.deliveryStatus, salesOrder.signStatus);
    const salesAmount = calculateNormalizedSalesAmount({
      salesAmount: salesOrder.amount,
      salesQuantity: salesOrder.quantity,
      contractAmount: contract?.amount ?? null,
      contractTotalQuantity: contract?.totalQuantity ?? null
    });
    const relatedReceivable =
      (receivablesBySalesOrderId.get(salesOrder.id) ?? [])[0] ??
      (salesOrder.contractId ? contractLevelReceivableByContractId.get(salesOrder.contractId) ?? null : null) ??
      null;
    const receivableScope =
      relatedReceivable && relatedReceivable.salesOrderId === salesOrder.id ? ("SALES_ORDER" as const) : ("CONTRACT" as const);
    const receivableMeta = relatedReceivable
      ? mapReceivableStatus(relatedReceivable.status, relatedReceivable.amount, relatedReceivable.receivedAmount)
      : null;
    const financeWorkOrder = relatedReceivable ? financeWorkOrderByReceivableId.get(relatedReceivable.id) ?? null : null;
    const relatedQrItems = batch ? qrItemsByBatchId.get(batch.id) ?? [] : [];

    return {
      id: salesOrder.id,
      salesNo: salesOrder.salesNo,
      customerName: salesOrder.customerName,
      skuName: salesOrder.skuName,
      quantity: salesOrder.quantity,
      unit: salesOrder.unit,
      amount: salesAmount,
      currency: salesOrder.currency,
      deliveryMethod: salesOrder.deliveryMethod,
      rawDeliveryStatus: salesOrder.deliveryStatus,
      rawSignStatus: salesOrder.signStatus,
      salesStatus: salesOrder.status,
      createdAt: salesOrder.createdAt.toISOString(),
      updatedAt: salesOrder.updatedAt.toISOString(),
      stage,
      statusMeta: resolveStageMeta(stage),
      signStatusMeta: resolveSignStatusMeta(salesOrder.signStatus),
      contract: contract
        ? {
            id: contract.id,
            contractNo: contract.contractNo,
            customerName: contract.customerName,
            supplierName: contract.supplierName,
            productName: contract.productName,
            totalQuantity: contract.totalQuantity,
            unit: contract.unit,
            amount: contract.amount,
            currency: contract.currency,
            destinationWarehouse: contract.destinationWarehouse,
            paymentStatus: contract.paymentStatus
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
      outboundOrder: outboundOrder
        ? {
            id: outboundOrder.id,
            outboundNo: outboundOrder.outboundNo,
            status: outboundOrder.status,
            quantity: outboundOrder.quantity,
            unit: outboundOrder.unit,
            warehouseId: outboundOrder.warehouseId,
            warehouseName: outboundOrder.warehouseId
              ? warehouseById.get(outboundOrder.warehouseId)?.name ?? null
              : null,
            updatedAt: outboundOrder.updatedAt.toISOString()
          }
        : null,
      deliveryOrder: deliveryOrder
        ? {
            id: deliveryOrder.id,
            deliveryNo: deliveryOrder.deliveryNo,
            status: deliveryOrder.status,
            quantity: deliveryOrder.quantity,
            unit: deliveryOrder.unit,
            warehouseId: deliveryOrder.warehouseId,
            warehouseName:
              deliveryOrder.warehouseName ??
              (deliveryOrder.warehouseId ? warehouseById.get(deliveryOrder.warehouseId)?.name ?? null : null),
            createdAt: deliveryOrder.createdAt.toISOString(),
            updatedAt: deliveryOrder.updatedAt.toISOString()
          }
        : null,
      qrSummary: {
        total: relatedQrItems.length,
        pendingInbound: relatedQrItems.filter((item) => item.status === "PENDING_INBOUND").length,
        inStock: relatedQrItems.filter((item) => item.status === "IN_STOCK").length,
        outbound: relatedQrItems.filter((item) => item.status === "OUTBOUND").length,
        frozen: relatedQrItems.filter((item) => item.status === "FROZEN").length
      },
      progress: buildProgress(outboundCompleted, stage),
      receivable: relatedReceivable && receivableMeta
        ? {
            id: relatedReceivable.id,
            status: receivableMeta.status,
            statusLabel: receivableMeta.label,
            statusColor: receivableMeta.color,
            amount: relatedReceivable.amount,
            currency: relatedReceivable.currency,
            receivedAmount: relatedReceivable.receivedAmount,
            openAmount: receivableMeta.openAmount,
            dueDate: relatedReceivable.dueDate?.toISOString() ?? null,
            scope: receivableScope,
            scopeLabel: buildReceivableScopeLabel(receivableScope),
            createdAt: relatedReceivable.createdAt.toISOString(),
            updatedAt: relatedReceivable.updatedAt.toISOString()
          }
        : null,
      linkedFinanceWorkOrder: financeWorkOrder
        ? {
            id: financeWorkOrder.id,
            workOrderNo: financeWorkOrder.workOrderNo,
            title: financeWorkOrder.title,
            status: financeWorkOrder.status,
            priority: financeWorkOrder.priority,
            responsibleDepartment: financeWorkOrder.responsibleDepartment,
            responsiblePerson: financeWorkOrder.responsiblePerson,
            startTime: financeWorkOrder.startTime?.toISOString() ?? null,
            dueTime: financeWorkOrder.dueTime?.toISOString() ?? null,
            createdAt: financeWorkOrder.createdAt.toISOString(),
            updatedAt: financeWorkOrder.updatedAt.toISOString()
          }
        : null,
      recommendedAction: resolveRecommendedAction(stage, outboundCompleted)
    };
  });
}

salesRouter.get("/orders", async (_request, response) => {
  const salesOrders = await prisma.salesOrder.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      salesNo: true,
      contractId: true,
      batchId: true,
      customerId: true,
      customerName: true,
      companyId: true,
      skuName: true,
      quantity: true,
      unit: true,
      amount: true,
      currency: true,
      deliveryMethod: true,
      deliveryStatus: true,
      signStatus: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const orders = await buildSalesView(salesOrders);

  response.json({
    summary: {
      totalOrders: orders.length,
      readyOrders: orders.filter((item) => item.stage === "READY").length,
      inTransitOrders: orders.filter((item) => item.stage === "IN_TRANSIT").length,
      deliveredOrders: orders.filter((item) => item.stage === "DELIVERED").length,
      pendingReceivables: orders.filter((item) => item.receivable && item.receivable.openAmount > 0).length
    },
    orders
  });
});

salesRouter.get("/orders/:id", async (request, response) => {
  const salesOrder = await loadSalesOrderOr404(request.params.id, response);

  if (!salesOrder) {
    return;
  }

  const [view] = await buildSalesView([salesOrder]);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "SalesOrder",
      entityId: salesOrder.id,
      action: {
        in: ["SALES_DELIVERY_COMPLETED", "SALES_TRIGGER_FINANCE"]
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
        "销售与配送模块负责承接仓储出库后的销售执行，展示销售单、配送单、签收状态，以及配送完成后联动财务待回款的业务上下文。",
      boundary:
        "第一版只做真实销售单读取、配送状态展示与模拟配送完成，不接真实第三方配送接口，也不会直接改库存。库存仍然只能由二维码扫码入库 / 出库驱动。"
    },
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary:
        item.action === "SALES_TRIGGER_FINANCE"
          ? "配送完成后，已自动联动财务待回款记录与回款跟进工单。"
          : "销售配送状态已推进为客户已签收。"
    }))
  });
});

salesRouter.post("/orders/:id/complete-delivery", async (request, response) => {
  const salesOrder = await loadSalesOrderOr404(request.params.id, response);

  if (!salesOrder) {
    return;
  }

  const currentStage = normalizeSalesStage(salesOrder.deliveryStatus, salesOrder.signStatus);

  if (currentStage === "DELIVERED") {
    response.status(409).json({ message: "当前销售单已经完成配送，无需重复推进。" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await getAuditActor(tx);
    const now = new Date();

    const [contract, batch, outboundOrder, existingDeliveryOrder, salesOrderReceivable, contractReceivable, payment] =
      await Promise.all([
        salesOrder.contractId
          ? tx.contract.findUnique({
              where: { id: salesOrder.contractId },
              select: {
                id: true,
                contractNo: true,
                customerName: true,
                supplierName: true,
                productName: true,
                totalQuantity: true,
                unit: true,
                amount: true,
                currency: true,
                destinationWarehouse: true,
                paymentStatus: true
              }
            })
          : Promise.resolve(null),
        salesOrder.batchId
          ? tx.batch.findUnique({
              where: { id: salesOrder.batchId },
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
        tx.outboundOrder.findFirst({
          where: { salesOrderId: salesOrder.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            outboundNo: true,
            warehouseId: true,
            quantity: true,
            unit: true,
            status: true
          }
        }),
        tx.deliveryOrder.findFirst({
          where: { salesOrderId: salesOrder.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            deliveryNo: true,
            warehouseId: true,
            warehouseName: true,
            quantity: true,
            unit: true,
            status: true
          }
        }),
        tx.receivable.findFirst({
          where: { salesOrderId: salesOrder.id },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            contractId: true,
            salesOrderId: true,
            amount: true,
            currency: true,
            dueDate: true,
            receivedAmount: true,
            status: true
          }
        }),
        salesOrder.contractId
          ? tx.receivable.findFirst({
              where: {
                contractId: salesOrder.contractId,
                salesOrderId: null
              },
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                contractId: true,
                salesOrderId: true,
                amount: true,
                currency: true,
                dueDate: true,
                receivedAmount: true,
                status: true
              }
            })
          : Promise.resolve(null),
        salesOrder.contractId
          ? tx.payment.findFirst({
              where: { contractId: salesOrder.contractId },
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              select: {
                id: true,
                receivableAmount: true,
                receivedAmount: true,
                currency: true,
                status: true,
                dueDate: true
              }
            })
          : Promise.resolve(null)
      ]);

    const normalizedSalesAmount = calculateNormalizedSalesAmount({
      salesAmount: salesOrder.amount,
      salesQuantity: salesOrder.quantity,
      contractAmount: contract?.amount ?? null,
      contractTotalQuantity: contract?.totalQuantity ?? null
    });

    const warehouse =
      (existingDeliveryOrder?.warehouseId
        ? await tx.warehouse.findUnique({
            where: { id: existingDeliveryOrder.warehouseId },
            select: { id: true, name: true }
          })
        : null) ??
      (outboundOrder?.warehouseId
        ? await tx.warehouse.findUnique({
            where: { id: outboundOrder.warehouseId },
            select: { id: true, name: true }
          })
        : null) ??
      (batch?.warehouseId
        ? await tx.warehouse.findUnique({
            where: { id: batch.warehouseId },
            select: { id: true, name: true }
          })
        : null);

    const updatedSalesOrder = await tx.salesOrder.update({
      where: { id: salesOrder.id },
      data: {
        deliveryStatus: "DELIVERED",
        signStatus: "SIGNED",
        status: "DELIVERED"
      },
      select: {
        id: true,
        salesNo: true,
        contractId: true,
        batchId: true,
        customerId: true,
        customerName: true,
        companyId: true,
        skuName: true,
        quantity: true,
        unit: true,
        amount: true,
        currency: true,
        deliveryMethod: true,
        deliveryStatus: true,
        signStatus: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    const deliveryOrder =
      existingDeliveryOrder
        ? await tx.deliveryOrder.update({
            where: { id: existingDeliveryOrder.id },
            data: {
              status: "DELIVERED",
              warehouseName: existingDeliveryOrder.warehouseName ?? warehouse?.name ?? null
            },
            select: {
              id: true,
              deliveryNo: true,
              status: true
            }
          })
        : await tx.deliveryOrder.create({
            data: {
              deliveryNo: `DO-${salesOrder.salesNo.replace(/^SO-/, "")}`,
              salesOrderId: salesOrder.id,
              batchId: salesOrder.batchId,
              warehouseId: warehouse?.id ?? null,
              warehouseName: warehouse?.name ?? null,
              quantity: salesOrder.quantity,
              unit: salesOrder.unit,
              status: "DELIVERED"
            },
            select: {
              id: true,
              deliveryNo: true,
              status: true
            }
          });

    const targetReceivable = salesOrderReceivable ?? contractReceivable;
    let receivableSummary:
      | {
          id: string;
          status: string;
          amount: number;
          currency: string;
          dueDate: Date | null;
          receivedAmount: number;
        }
      | null = null;

    const nextReceivableStatus = (currentReceivedAmount: number, currentAmount: number) => {
      const openAmount = Math.max(currentAmount - currentReceivedAmount, 0);

      if (openAmount <= 0) {
        return "PAID";
      }

      if (currentReceivedAmount > 0) {
        return "PARTIAL";
      }

      return "PENDING_COLLECTION";
    };

    if (targetReceivable) {
      receivableSummary = await tx.receivable.update({
        where: { id: targetReceivable.id },
        data: {
          status: nextReceivableStatus(targetReceivable.receivedAmount, targetReceivable.amount),
          dueDate: targetReceivable.dueDate ?? payment?.dueDate ?? addDays(now, 30)
        },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          dueDate: true,
          receivedAmount: true
        }
      });
    } else {
      receivableSummary = await tx.receivable.create({
        data: {
          contractId: salesOrder.contractId,
          salesOrderId: salesOrder.id,
          customerId: salesOrder.customerId,
          amount: normalizedSalesAmount,
          currency: salesOrder.currency,
          dueDate: payment?.dueDate ?? addDays(now, 30),
          receivedAmount: 0,
          status: "PENDING_COLLECTION"
        },
        select: {
          id: true,
          status: true,
          amount: true,
          currency: true,
          dueDate: true,
          receivedAmount: true
        }
      });
    }

    if (payment) {
      const nextPaymentStatus =
        payment.receivedAmount >= payment.receivableAmount
          ? "PAID"
          : payment.receivedAmount > 0
            ? "PARTIAL"
            : "UNPAID";

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: nextPaymentStatus,
          dueDate: payment.dueDate ?? receivableSummary.dueDate ?? addDays(now, 30)
        }
      });
    }

    const existingFinanceWorkOrder =
      receivableSummary
        ? await tx.workOrder.findFirst({
            where: {
              type: receivableWorkOrderType,
              relatedEntityType: "Receivable",
              relatedEntityId: receivableSummary.id
            },
            select: {
              id: true,
              workOrderNo: true,
              status: true
            }
          })
        : null;

    const financeWorkOrder =
      receivableSummary
        ? existingFinanceWorkOrder
          ? await tx.workOrder.update({
              where: { id: existingFinanceWorkOrder.id },
              data: {
                title: "财务回款跟进工单",
                content: `销售单 ${salesOrder.salesNo} 已完成配送，请跟进客户回款并推进财务回款模块。`,
                responsibleDepartment: "财务部",
                responsiblePerson: "Demo Finance Owner",
                status: receivableSummary.receivedAmount >= receivableSummary.amount ? "COMPLETED" : "PENDING",
                priority: "NORMAL",
                startTime: now,
                dueTime: receivableSummary.dueDate ?? addDays(now, 30),
                contractId: salesOrder.contractId,
                batchId: salesOrder.batchId,
                relatedEntityType: "Receivable",
                relatedEntityId: receivableSummary.id,
                completionCondition: "完成客户回款并进入可核销状态。"
              },
              select: {
                id: true,
                workOrderNo: true,
                status: true
              }
            })
          : await tx.workOrder.create({
              data: {
                workOrderNo: `WO-FIN-${salesOrder.salesNo.replace(/^SO-/, "")}`,
                type: receivableWorkOrderType,
                title: "财务回款跟进工单",
                content: `销售单 ${salesOrder.salesNo} 已完成配送，请跟进客户回款并推进财务回款模块。`,
                responsibleDepartment: "财务部",
                responsiblePerson: "Demo Finance Owner",
                status: receivableSummary.receivedAmount >= receivableSummary.amount ? "COMPLETED" : "PENDING",
                priority: "NORMAL",
                startTime: now,
                dueTime: receivableSummary.dueDate ?? addDays(now, 30),
                contractId: salesOrder.contractId,
                batchId: salesOrder.batchId,
                relatedEntityType: "Receivable",
                relatedEntityId: receivableSummary.id,
                completionCondition: "完成客户回款并进入可核销状态。"
              },
              select: {
                id: true,
                workOrderNo: true,
                status: true
              }
            })
        : null;

    await writeAuditLog(
      tx,
      actor,
      request,
      "SALES_DELIVERY_COMPLETED",
      "SalesOrder",
      salesOrder.id,
      {
        deliveryStatus: salesOrder.deliveryStatus,
        signStatus: salesOrder.signStatus,
        status: salesOrder.status
      },
      {
        deliveryStatus: "DELIVERED",
        signStatus: "SIGNED",
        status: "DELIVERED",
        deliveryOrder
      }
    );

    await writeAuditLog(
      tx,
      actor,
      request,
      "SALES_TRIGGER_FINANCE",
      "SalesOrder",
      salesOrder.id,
      {
        receivable: targetReceivable,
        financeWorkOrder: existingFinanceWorkOrder
      },
      {
        receivable: receivableSummary,
        financeWorkOrder
      }
    );

    return {
      updatedSalesOrder,
      deliveryOrder,
      receivable: receivableSummary,
      financeWorkOrder
    };
  });

  const [view] = await buildSalesView([result.updatedSalesOrder]);

  response.json({
    completed: true,
    order: view,
    deliveryOrder: result.deliveryOrder,
    receivable: result.receivable,
    financeWorkOrder: result.financeWorkOrder
  });
});
