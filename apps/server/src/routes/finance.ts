import { PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
import type { Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../lib/prisma";

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type CollectionMode = "partial" | "full";

const financeWorkOrderType = "RECEIVABLE_FOLLOW_UP";
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

export const financeRouter = Router();

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * ONE_DAY_IN_MS);
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

function buildReceivableScopeLabel(scope: "SALES_ORDER" | "CONTRACT") {
  return scope === "SALES_ORDER" ? "销售单级应收" : "合同级应收";
}

function buildReceivableStatusMeta(status: string | null | undefined, amount: number, receivedAmount: number) {
  const openAmount = roundMoney(Math.max(amount - receivedAmount, 0));

  if (openAmount <= 0) {
    return {
      code: "PAID",
      label: "已回款",
      color: "success" as const,
      openAmount
    };
  }

  if (receivedAmount > 0) {
    return {
      code: "PARTIAL",
      label: "部分回款",
      color: "processing" as const,
      openAmount
    };
  }

  if (status === "PENDING_COLLECTION") {
    return {
      code: "PENDING_COLLECTION",
      label: "待回款",
      color: "warning" as const,
      openAmount
    };
  }

  return {
    code: status ?? "UNPAID",
    label: "未回款",
    color: "warning" as const,
    openAmount
  };
}

function buildOverdueMeta(dueDate: Date | null, openAmount: number, now = new Date()) {
  if (openAmount <= 0) {
    return {
      code: "SETTLED",
      label: "已结清",
      color: "success" as const,
      daysOverdue: 0,
      daysUntilDue: 0
    };
  }

  if (!dueDate) {
    return {
      code: "NO_DUE_DATE",
      label: "待设账期",
      color: "default" as const,
      daysOverdue: 0,
      daysUntilDue: null as number | null
    };
  }

  const diffMs = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / ONE_DAY_IN_MS);

  if (diffDays < 0) {
    return {
      code: "OVERDUE",
      label: `已逾期 ${Math.abs(diffDays)} 天`,
      color: "error" as const,
      daysOverdue: Math.abs(diffDays),
      daysUntilDue: diffDays
    };
  }

  if (diffDays === 0) {
    return {
      code: "DUE_TODAY",
      label: "今日到期",
      color: "warning" as const,
      daysOverdue: 0,
      daysUntilDue: 0
    };
  }

  return {
    code: "IN_TERM",
    label: `账期内，剩余 ${diffDays} 天`,
    color: "processing" as const,
    daysOverdue: 0,
    daysUntilDue: diffDays
  };
}

function buildReconciliationMeta(openAmount: number, receivedAmount: number) {
  if (openAmount <= 0) {
    return {
      code: "READY",
      label: "可核销",
      color: "success" as const
    };
  }

  if (receivedAmount > 0) {
    return {
      code: "PARTIAL",
      label: "待核销",
      color: "processing" as const
    };
  }

  return {
    code: "PENDING",
    label: "未核销",
    color: "default" as const
  };
}

function buildRecommendedPartialAmount(openAmount: number) {
  if (openAmount <= 0) {
    return 0;
  }

  const half = roundMoney(openAmount / 2);
  return half > 0 ? Math.min(openAmount, half) : openAmount;
}

function buildFinanceWorkOrderStatus(openAmount: number, receivedAmount: number) {
  if (openAmount <= 0) {
    return "COMPLETED";
  }

  if (receivedAmount > 0) {
    return "IN_PROGRESS";
  }

  return "PENDING";
}

function buildFinanceWorkOrderNo(receivableId: string) {
  return `WO-FIN-${receivableId.slice(-8).toUpperCase()}`;
}

async function loadReceivableOr404(receivableId: string, response: Response) {
  const receivable = await prisma.receivable.findUnique({
    where: { id: receivableId },
    select: {
      id: true,
      contractId: true,
      salesOrderId: true,
      customerId: true,
      amount: true,
      currency: true,
      dueDate: true,
      receivedAmount: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!receivable) {
    response.status(404).json({ message: "Receivable not found." });
    return null;
  }

  return receivable;
}

async function buildFinanceView(
  records: Array<{
    id: string;
    contractId: string | null;
    salesOrderId: string | null;
    customerId: string | null;
    amount: number;
    currency: string;
    dueDate: Date | null;
    receivedAmount: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>
) {
  const contractIds = uniqueIds(records.map((item) => item.contractId));
  const salesOrderIds = uniqueIds(records.map((item) => item.salesOrderId));

  const [contracts, salesOrders, payments, workOrders] = await Promise.all([
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
            paymentStatus: true,
            status: true
          }
        })
      : Promise.resolve([]),
    salesOrderIds.length > 0
      ? prisma.salesOrder.findMany({
          where: { id: { in: salesOrderIds } },
          select: {
            id: true,
            salesNo: true,
            batchId: true,
            customerName: true,
            skuName: true,
            quantity: true,
            unit: true,
            amount: true,
            currency: true,
            deliveryStatus: true,
            signStatus: true,
            status: true
          }
        })
      : Promise.resolve([]),
    contractIds.length > 0
      ? prisma.payment.findMany({
          where: { contractId: { in: contractIds } },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            contractId: true,
            receivableAmount: true,
            receivedAmount: true,
            currency: true,
            status: true,
            dueDate: true,
            receivedAt: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([]),
    records.length > 0
      ? prisma.workOrder.findMany({
          where: {
            type: financeWorkOrderType,
            relatedEntityType: "Receivable",
            relatedEntityId: { in: records.map((item) => item.id) }
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
            relatedEntityId: true,
            createdAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve([])
  ]);

  const batchIds = uniqueIds(salesOrders.map((item) => item.batchId));
  const batches =
    batchIds.length > 0
      ? await prisma.batch.findMany({
          where: { id: { in: batchIds } },
          select: {
            id: true,
            batchNo: true,
            productName: true,
            totalQuantity: true,
            unit: true,
            destinationWarehouse: true,
            status: true
          }
        })
      : [];

  const contractById = new Map(contracts.map((item) => [item.id, item]));
  const salesOrderById = new Map(salesOrders.map((item) => [item.id, item]));
  const batchById = new Map(batches.map((item) => [item.id, item]));
  const paymentByContractId = new Map<string, (typeof payments)[number]>();
  const workOrderByReceivableId = new Map<string, (typeof workOrders)[number]>();

  for (const item of payments) {
    if (!paymentByContractId.has(item.contractId)) {
      paymentByContractId.set(item.contractId, item);
    }
  }

  for (const item of workOrders) {
    if (item.relatedEntityId && !workOrderByReceivableId.has(item.relatedEntityId)) {
      workOrderByReceivableId.set(item.relatedEntityId, item);
    }
  }

  return records.map((item) => {
    const contract = item.contractId ? contractById.get(item.contractId) ?? null : null;
    const salesOrder = item.salesOrderId ? salesOrderById.get(item.salesOrderId) ?? null : null;
    const batch = salesOrder?.batchId ? batchById.get(salesOrder.batchId) ?? null : null;
    const payment = item.contractId ? paymentByContractId.get(item.contractId) ?? null : null;
    const workOrder = workOrderByReceivableId.get(item.id) ?? null;
    const statusMeta = buildReceivableStatusMeta(item.status, item.amount, item.receivedAmount);
    const overdueMeta = buildOverdueMeta(item.dueDate, statusMeta.openAmount);
    const reconciliationMeta = buildReconciliationMeta(statusMeta.openAmount, item.receivedAmount);
    const scope = salesOrder ? ("SALES_ORDER" as const) : ("CONTRACT" as const);

    return {
      id: item.id,
      amount: item.amount,
      currency: item.currency,
      dueDate: item.dueDate?.toISOString() ?? null,
      receivedAmount: item.receivedAmount,
      openAmount: statusMeta.openAmount,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      scope,
      scopeLabel: buildReceivableScopeLabel(scope),
      status: item.status,
      statusMeta,
      overdueMeta,
      reconciliationMeta,
      recommendedAction: {
        canCollectPartial: statusMeta.openAmount > 0,
        canCollectFull: statusMeta.openAmount > 0,
        partialAmount: buildRecommendedPartialAmount(statusMeta.openAmount)
      },
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
            paymentStatus: contract.paymentStatus,
            contractStatus: contract.status
          }
        : null,
      salesOrder: salesOrder
        ? {
            id: salesOrder.id,
            salesNo: salesOrder.salesNo,
            customerName: salesOrder.customerName,
            skuName: salesOrder.skuName,
            quantity: salesOrder.quantity,
            unit: salesOrder.unit,
            amount: salesOrder.amount,
            currency: salesOrder.currency,
            deliveryStatus: salesOrder.deliveryStatus,
            signStatus: salesOrder.signStatus,
            status: salesOrder.status
          }
        : null,
      batch: batch
        ? {
            id: batch.id,
            batchNo: batch.batchNo,
            productName: batch.productName,
            totalQuantity: batch.totalQuantity,
            unit: batch.unit,
            destinationWarehouse: batch.destinationWarehouse,
            status: batch.status
          }
        : null,
      payment: payment
        ? {
            id: payment.id,
            receivableAmount: payment.receivableAmount,
            receivedAmount: payment.receivedAmount,
            currency: payment.currency,
            status: payment.status,
            dueDate: payment.dueDate?.toISOString() ?? null,
            receivedAt: payment.receivedAt?.toISOString() ?? null,
            paidAt: payment.paidAt?.toISOString() ?? null,
            createdAt: payment.createdAt.toISOString(),
            updatedAt: payment.updatedAt.toISOString()
          }
        : null,
      linkedFinanceWorkOrder: workOrder
        ? {
            id: workOrder.id,
            workOrderNo: workOrder.workOrderNo,
            title: workOrder.title,
            status: workOrder.status,
            priority: workOrder.priority,
            responsibleDepartment: workOrder.responsibleDepartment,
            responsiblePerson: workOrder.responsiblePerson,
            startTime: workOrder.startTime?.toISOString() ?? null,
            dueTime: workOrder.dueTime?.toISOString() ?? null,
            createdAt: workOrder.createdAt.toISOString(),
            updatedAt: workOrder.updatedAt.toISOString()
          }
        : null
    };
  });
}

financeRouter.get("/receivables", async (_request, response) => {
  const receivables = await prisma.receivable.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      contractId: true,
      salesOrderId: true,
      customerId: true,
      amount: true,
      currency: true,
      dueDate: true,
      receivedAmount: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  const items = await buildFinanceView(receivables);
  const openAmount = roundMoney(items.reduce((sum, item) => sum + item.openAmount, 0));
  const receivedAmount = roundMoney(items.reduce((sum, item) => sum + item.receivedAmount, 0));

  response.json({
    summary: {
      totalReceivables: items.length,
      pendingCount: items.filter((item) => item.openAmount > 0 && item.receivedAmount <= 0).length,
      partialCount: items.filter((item) => item.openAmount > 0 && item.receivedAmount > 0).length,
      paidCount: items.filter((item) => item.openAmount <= 0).length,
      overdueCount: items.filter((item) => item.overdueMeta.code === "OVERDUE").length,
      linkedWorkOrders: items.filter((item) => item.linkedFinanceWorkOrder).length,
      openAmount,
      receivedAmount,
      currency: items[0]?.currency ?? "USD"
    },
    receivables: items
  });
});

financeRouter.get("/receivables/:id", async (request, response) => {
  const receivable = await loadReceivableOr404(request.params.id, response);

  if (!receivable) {
    return;
  }

  const [view] = await buildFinanceView([receivable]);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        {
          entityType: "Receivable",
          entityId: receivable.id,
          action: {
            in: ["FINANCE_RECEIVABLE_PARTIAL", "FINANCE_RECEIVABLE_PAID"]
          }
        },
        ...(receivable.salesOrderId
          ? [
              {
                entityType: "SalesOrder",
                entityId: receivable.salesOrderId,
                action: {
                  in: ["SALES_TRIGGER_FINANCE"]
                }
              }
            ]
          : [])
      ]
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
        "财务回款模块负责承接销售完成后的应收跟进，统一展示应收金额、已收金额、账期、逾期和核销状态，并保留与合同、销售单、财务工单的上下文。",
      boundary:
        "第一版只做真实应收读取与模拟回款，不接真实银行流水、不做财务凭证，也不会反向改动二维码或库存；库存仍然只由扫码入库/出库驱动。"
    },
    history: auditLogs.map((item) => ({
      id: item.id,
      action: item.action,
      operator: item.username ?? "demo-owner",
      occurredAt: item.createdAt.toISOString(),
      summary:
        item.action === "SALES_TRIGGER_FINANCE"
          ? "销售配送完成后，系统已把该应收推进到财务跟进链路。"
          : item.action === "FINANCE_RECEIVABLE_PAID"
            ? "已模拟全部回款，当前应收进入可核销状态。"
            : "已模拟部分回款，应收与合同回款状态已同步更新。"
    }))
  });
});

async function applyCollection(request: Request, response: Response, mode: CollectionMode) {
  const receivableId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
  const receivable = await loadReceivableOr404(receivableId, response);

  if (!receivable) {
    return;
  }

  const currentOpenAmount = roundMoney(Math.max(receivable.amount - receivable.receivedAmount, 0));

  if (currentOpenAmount <= 0) {
    response.status(409).json({ message: "当前应收已经全部回款，无需重复操作。" });
    return;
  }

  const requestAmount = (request.body as { amount?: unknown } | undefined)?.amount;
  const requestedAmount =
    typeof requestAmount === "number" && Number.isFinite(requestAmount) ? roundMoney(requestAmount) : null;

  const collectionAmount =
    mode === "full"
      ? currentOpenAmount
      : requestedAmount && requestedAmount > 0
        ? Math.min(currentOpenAmount, requestedAmount)
        : buildRecommendedPartialAmount(currentOpenAmount);

  if (collectionAmount <= 0) {
    response.status(400).json({ message: "本次回款金额必须大于 0。" });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const actor = await getAuditActor(tx);
    const now = new Date();

    const freshReceivable = await tx.receivable.findUnique({
      where: { id: receivable.id },
      select: {
        id: true,
        contractId: true,
        salesOrderId: true,
        customerId: true,
        amount: true,
        currency: true,
        dueDate: true,
        receivedAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!freshReceivable) {
      throw new Error("Receivable not found.");
    }

    const freshOpenAmount = roundMoney(Math.max(freshReceivable.amount - freshReceivable.receivedAmount, 0));

    if (freshOpenAmount <= 0) {
      throw new Error("当前应收已经全部回款，无需重复操作。");
    }

    const appliedAmount = mode === "full" ? freshOpenAmount : Math.min(collectionAmount, freshOpenAmount);
    const nextReceivedAmount = roundMoney(freshReceivable.receivedAmount + appliedAmount);
    const nextOpenAmount = roundMoney(Math.max(freshReceivable.amount - nextReceivedAmount, 0));
    const nextReceivableStatus =
      nextOpenAmount <= 0 ? "PAID" : nextReceivedAmount > 0 ? "PARTIAL" : "PENDING_COLLECTION";

    const updatedReceivable = await tx.receivable.update({
      where: { id: freshReceivable.id },
      data: {
        receivedAmount: nextReceivedAmount,
        status: nextReceivableStatus,
        dueDate: freshReceivable.dueDate ?? addDays(now, 30)
      },
      select: {
        id: true,
        contractId: true,
        salesOrderId: true,
        customerId: true,
        amount: true,
        currency: true,
        dueDate: true,
        receivedAmount: true,
        status: true,
        createdAt: true,
        updatedAt: true
      }
    });

    let paymentSummary:
      | {
          id: string;
          contractId: string;
          receivableAmount: number;
          receivedAmount: number;
          currency: string;
          status: PaymentStatus;
          dueDate: Date | null;
          receivedAt: Date | null;
          paidAt: Date | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | null = null;

    let contractSummary:
      | {
          id: string;
          contractNo: string;
          paymentStatus: string;
        }
      | null = null;

    if (updatedReceivable.contractId) {
      const [contractReceivables, existingPayment, existingContract, salesOrder, existingWorkOrder] = await Promise.all([
        tx.receivable.findMany({
          where: { contractId: updatedReceivable.contractId },
          select: {
            id: true,
            amount: true,
            receivedAmount: true
          }
        }),
        tx.payment.findFirst({
          where: { contractId: updatedReceivable.contractId },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            contractId: true,
            receivableAmount: true,
            receivedAmount: true,
            currency: true,
            status: true,
            dueDate: true,
            receivedAt: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        tx.contract.findUnique({
          where: { id: updatedReceivable.contractId },
          select: {
            id: true,
            contractNo: true,
            paymentStatus: true
          }
        }),
        updatedReceivable.salesOrderId
          ? tx.salesOrder.findUnique({
              where: { id: updatedReceivable.salesOrderId },
              select: {
                salesNo: true
              }
            })
          : Promise.resolve(null),
        tx.workOrder.findFirst({
          where: {
            type: financeWorkOrderType,
            relatedEntityType: "Receivable",
            relatedEntityId: updatedReceivable.id
          },
          select: {
            id: true
          }
        })
      ]);

      const contractReceivedAmount = roundMoney(
        contractReceivables.reduce((sum, item) => sum + item.receivedAmount, 0)
      );
      const contractReceivableAmount = roundMoney(contractReceivables.reduce((sum, item) => sum + item.amount, 0));
      const contractOpenAmount = roundMoney(Math.max(contractReceivableAmount - contractReceivedAmount, 0));
      const nextContractPaymentStatus =
        contractOpenAmount <= 0
          ? PaymentStatus.PAID
          : contractReceivedAmount > 0
            ? PaymentStatus.PARTIAL
            : PaymentStatus.UNPAID;

      if (existingPayment) {
        paymentSummary = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            receivedAmount: Math.min(existingPayment.receivableAmount, contractReceivedAmount),
            status: nextContractPaymentStatus,
            dueDate: existingPayment.dueDate ?? updatedReceivable.dueDate ?? addDays(now, 30),
            receivedAt: contractReceivedAmount > 0 ? now : existingPayment.receivedAt,
            paidAt: nextContractPaymentStatus === PaymentStatus.PAID ? now : null
          },
          select: {
            id: true,
            contractId: true,
            receivableAmount: true,
            receivedAmount: true,
            currency: true,
            status: true,
            dueDate: true,
            receivedAt: true,
            paidAt: true,
            createdAt: true,
            updatedAt: true
          }
        });
      }

      if (existingContract) {
        contractSummary = await tx.contract.update({
          where: { id: existingContract.id },
          data: {
            paymentStatus: nextContractPaymentStatus
          },
          select: {
            id: true,
            contractNo: true,
            paymentStatus: true
          }
        });
      }

      const workOrderStatus = buildFinanceWorkOrderStatus(nextOpenAmount, nextReceivedAmount);
      const workOrderDueTime = updatedReceivable.dueDate ?? paymentSummary?.dueDate ?? addDays(now, 30);
      const workOrderContent = `应收 ${updatedReceivable.id} 已进入财务跟进阶段，请继续跟进回款并在全部回款后进入可核销状态。`;

      if (existingWorkOrder) {
        await tx.workOrder.update({
          where: { id: existingWorkOrder.id },
          data: {
            title: "财务回款跟进工单",
            content: workOrderContent,
            responsibleDepartment: "财务部",
            responsiblePerson: "Demo Finance Owner",
            status: workOrderStatus,
            priority: nextOpenAmount <= 0 ? "NORMAL" : "HIGH",
            startTime: now,
            dueTime: workOrderDueTime,
            completionCondition: "完成客户回款并进入可核销状态。"
          }
        });
      } else {
        await tx.workOrder.create({
          data: {
            workOrderNo: buildFinanceWorkOrderNo(updatedReceivable.id),
            type: financeWorkOrderType,
            title: "财务回款跟进工单",
            content:
              salesOrder?.salesNo && contractSummary?.contractNo
                ? `销售单 ${salesOrder.salesNo} 对应合同 ${contractSummary.contractNo} 已进入财务跟进阶段，请继续跟进回款。`
                : workOrderContent,
            responsibleDepartment: "财务部",
            responsiblePerson: "Demo Finance Owner",
            status: workOrderStatus,
            priority: nextOpenAmount <= 0 ? "NORMAL" : "HIGH",
            startTime: now,
            dueTime: workOrderDueTime,
            contractId: updatedReceivable.contractId,
            relatedEntityType: "Receivable",
            relatedEntityId: updatedReceivable.id,
            completionCondition: "完成客户回款并进入可核销状态。"
          }
        });
      }
    }

    await writeAuditLog(
      tx,
      actor,
      request,
      mode === "full" ? "FINANCE_RECEIVABLE_PAID" : "FINANCE_RECEIVABLE_PARTIAL",
      "Receivable",
      updatedReceivable.id,
      {
        amount: freshReceivable.amount,
        receivedAmount: freshReceivable.receivedAmount,
        status: freshReceivable.status
      },
      {
        amount: updatedReceivable.amount,
        receivedAmount: updatedReceivable.receivedAmount,
        status: updatedReceivable.status,
        appliedAmount,
        payment: paymentSummary,
        contract: contractSummary
      }
    );

    return {
      receivableId: updatedReceivable.id,
      appliedAmount
    };
  });

  const refreshedReceivable = await prisma.receivable.findUnique({
    where: { id: result.receivableId },
    select: {
      id: true,
      contractId: true,
      salesOrderId: true,
      customerId: true,
      amount: true,
      currency: true,
      dueDate: true,
      receivedAmount: true,
      status: true,
      createdAt: true,
      updatedAt: true
    }
  });

  if (!refreshedReceivable) {
    response.status(404).json({ message: "Receivable not found after update." });
    return;
  }

  const [view] = await buildFinanceView([refreshedReceivable]);

  response.json({
    mode,
    appliedAmount: result.appliedAmount,
    receivable: view
  });
}

financeRouter.post("/receivables/:id/collect-partial", async (request, response) => {
  try {
    await applyCollection(request, response, "partial");
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Failed to simulate partial collection."
    });
  }
});

financeRouter.post("/receivables/:id/collect-full", async (request, response) => {
  try {
    await applyCollection(request, response, "full");
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Failed to simulate full collection."
    });
  }
});
