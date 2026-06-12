import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { buildDocumentPackageStatus } from "../services/documentPackage";

export const contractsRouter = Router();

const contractListSelect = {
  id: true,
  contractNo: true,
  contractType: true,
  status: true,
  paymentStatus: true,
  executionStatus: true,
  executionProgress: true,
  isOverdue: true,
  overdueDays: true,
  breachStatus: true,
  breachNote: true,
  plannedReceiptAmount: true,
  actualReceiptAmount: true,
  plannedPaymentAmount: true,
  actualPaymentAmount: true,
  receiptPaymentPlanJson: true,
  customerName: true,
  supplierName: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  amount: true,
  currency: true,
  destinationWarehouse: true,
  sourceDocumentId: true,
  parentContractId: true,
  createdAt: true,
  updatedAt: true,
  sourceDocument: {
    select: {
      id: true,
      originalName: true
    }
  },
  batches: {
    select: {
      id: true,
      batchNo: true,
      status: true,
      sourceDocumentId: true
    }
  },
  payments: {
    select: {
      id: true,
      receivableAmount: true,
      receivedAmount: true,
      currency: true,
      status: true,
      dueDate: true
    }
  }
} satisfies Prisma.ContractSelect;

const contractDetailSelect = {
  id: true,
  contractNo: true,
  contractType: true,
  parentContractId: true,
  status: true,
  paymentStatus: true,
  executionStatus: true,
  executionProgress: true,
  isOverdue: true,
  overdueDays: true,
  breachStatus: true,
  breachNote: true,
  plannedReceiptAmount: true,
  actualReceiptAmount: true,
  plannedPaymentAmount: true,
  actualPaymentAmount: true,
  receiptPaymentPlanJson: true,
  customerId: true,
  customerName: true,
  supplierId: true,
  supplierName: true,
  companyId: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  amount: true,
  currency: true,
  destinationWarehouse: true,
  sourceDocumentId: true,
  createdAt: true,
  updatedAt: true,
  parentContract: {
    select: {
      id: true,
      contractNo: true,
      contractType: true
    }
  },
  supplementalContracts: {
    select: {
      id: true,
      contractNo: true,
      contractType: true,
      status: true,
      amount: true,
      currency: true
    }
  },
  sourceDocument: {
    select: {
      id: true,
      originalName: true,
      fileUrl: true
    }
  },
  batches: {
    select: {
      id: true,
      batchNo: true,
      status: true,
      productName: true,
      totalQuantity: true,
      unit: true,
      destinationWarehouse: true,
      sourceDocumentId: true,
      createdAt: true
    }
  },
  payments: {
    select: {
      id: true,
      receivableAmount: true,
      receivedAmount: true,
      currency: true,
      status: true,
      dueDate: true,
      createdAt: true
    }
  }
} satisfies Prisma.ContractSelect;

const receivableSelect = {
  id: true,
  contractId: true,
  amount: true,
  currency: true,
  receivedAmount: true,
  status: true,
  dueDate: true,
  createdAt: true
} satisfies Prisma.ReceivableSelect;

const documentPackageSelect = {
  id: true,
  documentType: true,
  originalName: true,
  fileName: true,
  status: true,
  aiStatus: true,
  businessCreated: true,
  version: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.DocumentSelect;

type ContractListRecord = Prisma.ContractGetPayload<{ select: typeof contractListSelect }>;
type ContractDetailRecord = Prisma.ContractGetPayload<{ select: typeof contractDetailSelect }>;
type ReceivableRecord = Prisma.ReceivableGetPayload<{ select: typeof receivableSelect }>;

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function daysOverdue(value: Date | null) {
  if (!value) {
    return 0;
  }

  const diff = Date.now() - value.getTime();
  return diff > 0 ? Math.floor(diff / (24 * 60 * 60 * 1000)) : 0;
}

function isClosedPaymentStatus(status: string) {
  return status === "PAID" || status === "COMPLETED" || status === "CLOSED";
}

function buildExecutionControl(
  contract: Pick<
    ContractListRecord,
    | "amount"
    | "currency"
    | "paymentStatus"
    | "executionStatus"
    | "executionProgress"
    | "isOverdue"
    | "overdueDays"
    | "breachStatus"
    | "breachNote"
    | "plannedReceiptAmount"
    | "actualReceiptAmount"
    | "plannedPaymentAmount"
    | "actualPaymentAmount"
    | "receiptPaymentPlanJson"
    | "payments"
  >,
  receivables: ReceivableRecord[]
) {
  const paymentReceivedAmount = contract.payments.reduce((sum, item) => sum + item.receivedAmount, 0);
  const receivableReceivedAmount = receivables.reduce((sum, item) => sum + item.receivedAmount, 0);
  const plannedReceiptAmount =
    contract.plannedReceiptAmount > 0
      ? contract.plannedReceiptAmount
      : contract.payments.reduce((sum, item) => sum + item.receivableAmount, 0) ||
        receivables.reduce((sum, item) => sum + item.amount, 0) ||
        contract.amount;
  const actualReceiptAmount = Math.max(
    contract.actualReceiptAmount,
    paymentReceivedAmount,
    receivableReceivedAmount
  );
  const plannedPaymentAmount =
    contract.plannedPaymentAmount > 0 ? contract.plannedPaymentAmount : roundMoney(contract.amount * 0.6);
  const actualPaymentAmount = contract.actualPaymentAmount;
  const receivableOverdueDays = Math.max(
    0,
    ...receivables
      .filter((item) => !isClosedPaymentStatus(item.status))
      .map((item) => daysOverdue(item.dueDate))
  );
  const paymentOverdueDays = Math.max(
    0,
    ...contract.payments
      .filter((item) => !isClosedPaymentStatus(item.status))
      .map((item) => daysOverdue(item.dueDate))
  );
  const overdueDays = Math.max(contract.overdueDays, receivableOverdueDays, paymentOverdueDays);
  const isOverdue = contract.isOverdue || overdueDays > 0;
  const breachStatus =
    contract.breachStatus !== "NONE"
      ? contract.breachStatus
      : overdueDays >= 30
        ? "RISK"
        : "NONE";

  return {
    executionStatus: contract.executionStatus,
    executionProgress: contract.executionProgress,
    isOverdue,
    overdueDays,
    breachStatus,
    breachNote: contract.breachNote,
    plannedReceiptAmount,
    actualReceiptAmount,
    receiptGap: roundMoney(Math.max(plannedReceiptAmount - actualReceiptAmount, 0)),
    plannedPaymentAmount,
    actualPaymentAmount,
    paymentGap: roundMoney(Math.max(plannedPaymentAmount - actualPaymentAmount, 0)),
    currency: contract.currency,
    receiptPaymentPlan: contract.receiptPaymentPlanJson,
    warning:
      isOverdue
        ? `存在逾期风险，最长已逾期 ${overdueDays} 天。`
        : "当前未发现逾期。正式版将按真实收付款计划、应收应付和审批节点持续刷新。"
  };
}

async function loadReceivablesByContractIds(contractIds: string[]) {
  if (contractIds.length === 0) {
    return [];
  }

  return prisma.receivable.findMany({
    where: {
      contractId: {
        in: contractIds
      }
    },
    select: receivableSelect
  });
}

async function loadDocumentPackageForContract(contract: ContractDetailRecord) {
  const documentIds = [
    contract.sourceDocumentId,
    ...contract.batches.map((item) => item.sourceDocumentId)
  ].filter((item): item is string => Boolean(item));
  const batchNos = contract.batches.map((item) => item.batchNo);
  const relatedEntityIds = [
    contract.id,
    ...contract.batches.map((item) => item.id)
  ];
  const orFilters: Prisma.DocumentWhereInput[] = [
    { contractNoDraft: contract.contractNo },
    { relatedEntityId: { in: relatedEntityIds } }
  ];

  if (documentIds.length > 0) {
    orFilters.push({ id: { in: documentIds } });
  }

  if (batchNos.length > 0) {
    orFilters.push({ batchNoDraft: { in: batchNos } });
  }

  const documents = await prisma.document.findMany({
    where: {
      isDeleted: false,
      OR: orFilters
    },
    orderBy: [{ updatedAt: "desc" }],
    select: documentPackageSelect
  });

  return buildDocumentPackageStatus(documents);
}

contractsRouter.get("/", async (_request, response) => {
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    select: contractListSelect
  });
  const receivables = await loadReceivablesByContractIds(contracts.map((item) => item.id));
  const receivableByContractId = new Map<string, ReceivableRecord[]>();

  for (const receivable of receivables) {
    if (!receivable.contractId) {
      continue;
    }

    const current = receivableByContractId.get(receivable.contractId) ?? [];
    current.push(receivable);
    receivableByContractId.set(receivable.contractId, current);
  }

  response.json(
    contracts.map((contract) => {
      const contractReceivables = receivableByContractId.get(contract.id) ?? [];

      return {
        ...contract,
        receivable: contractReceivables[0] ?? null,
        executionControl: buildExecutionControl(contract, contractReceivables)
      };
    })
  );
});

contractsRouter.get("/:id", async (request, response) => {
  const contract = await prisma.contract.findUnique({
    where: { id: request.params.id },
    select: contractDetailSelect
  });

  if (!contract) {
    response.status(404).json({ message: "Contract not found." });
    return;
  }

  const [items, purchaseOrders, receivables, documentPackage] = await Promise.all([
    prisma.contractItem.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        skuCode: true,
        skuName: true,
        quantity: true,
        unit: true,
        unitPrice: true,
        amount: true,
        currency: true
      }
    }),
    prisma.purchaseOrder.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        purchaseNo: true,
        status: true,
        supplierName: true,
        skuName: true,
        quantity: true,
        unit: true,
        deliveryDate: true,
        createdAt: true
      }
    }),
    prisma.receivable.findMany({
      where: { contractId: contract.id },
      orderBy: { createdAt: "asc" },
      select: receivableSelect
    }),
    loadDocumentPackageForContract(contract)
  ]);

  response.json({
    ...contract,
    items,
    purchaseOrders,
    receivables,
    executionControl: buildExecutionControl(contract, receivables),
    documentPackage
  });
});
