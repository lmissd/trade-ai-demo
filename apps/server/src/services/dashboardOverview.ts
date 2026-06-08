import {
  AiTaskType,
  DocumentAiStatus,
  DocumentStatus,
  StockMovementType
} from "@prisma/client";
import { demoScenarioConfig } from "../config/demoScenario";
import { prisma } from "../lib/prisma";
import { resolveAiAssistantRuntime } from "./aiAssistantConfig";
import { buildInventorySummary, type InventorySummaryResult } from "./inventorySummary";

export type DashboardTone = "success" | "processing" | "warning" | "default" | "error";
export type DashboardOrderView = "active" | "completed" | "after_sales" | "exception" | "archived" | "all";

type DashboardStatusKey =
  | "pending_qr"
  | "in_transit"
  | "in_stock"
  | "partial_outbound"
  | "awaiting_receivable"
  | "completed"
  | "none"
  | "open"
  | "processing"
  | "resolved"
  | "normal"
  | "warning"
  | "blocked"
  | "not_ready"
  | "ready"
  | "archived";

type DashboardStatusDimension = {
  key: DashboardStatusKey;
  text: string;
  tone: DashboardTone;
};

type DashboardOrderPoolSummary = {
  key: DashboardOrderView;
  label: string;
  count: number;
  description: string;
};

type DashboardContractProfile = {
  contractId: string;
  contractNo: string;
  customerName: string;
  totalQuantity: number;
  unit: string;
  batchCount: number;
  hasQrItems: boolean;
  totalQrItems: number;
  inTransitInventory: number;
  realtimeInventory: number;
  outboundQuantity: number;
  abnormalQuantity: number;
  unpaidAmount: number;
  mainFlowStatus: DashboardStatusDimension;
  afterSalesStatus: DashboardStatusDimension;
  exceptionStatus: DashboardStatusDimension;
  archiveStatus: DashboardStatusDimension;
  dashboardGroupKey: Exclude<DashboardOrderView, "all">;
};

type DashboardStatusCard = {
  key: string;
  title: string;
  statusText: string;
  tone: DashboardTone;
  metricLabel: string;
  metricValue: string;
  description: string;
  routePath: string;
};

type DashboardTask = {
  id: string;
  title: string;
  owner: string;
  reference: string;
  statusText: string;
  tone: DashboardTone;
  description: string;
  routePath: string;
};

type DashboardActivity = {
  id: string;
  kind: string;
  title: string;
  occurredAt: string;
  tone: DashboardTone;
  description: string;
  routePath: string;
};

type DashboardOverviewOptions = {
  focusContractId?: string | null;
  orderView?: DashboardOrderView | null;
};

export type DashboardOverview = {
  generatedAt: string;
  scenario: {
    scenarioName: string;
    origin: string;
    destinationWarehouse: string;
    customerName: string;
    supplierName: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    plannedOutboundQuantity: number;
    amount: number;
    currency: string;
  };
  assistant: {
    llmEnabled: boolean;
    mode: "llm" | "template";
    source: "runtime" | "env" | "template";
    provider: string;
    model: string | null;
  };
  counts: {
    documents: number;
    draftDocuments: number;
    businessDocuments: number;
    contracts: number;
    batches: number;
    qrItems: number;
    stockMovements: number;
    aiLogs: number;
    workOrdersInDatabase: number;
  };
  finance: {
    unpaidCount: number;
    unpaidAmount: number;
    currency: string;
  };
  orderView: DashboardOrderView;
  orderPools: DashboardOrderPoolSummary[];
  availableContracts: Array<{
    contractId: string;
    contractNo: string;
    customerName: string;
    totalQuantity: number;
    unit: string;
    batchCount: number;
    hasQrItems: boolean;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    outboundQuantity: number;
    unpaidAmount: number;
    mainFlowStatus: string;
    mainFlowStatusText: string;
    mainFlowTone: DashboardTone;
    afterSalesStatus: string;
    afterSalesStatusText: string;
    afterSalesTone: DashboardTone;
    exceptionStatus: string;
    exceptionStatusText: string;
    exceptionTone: DashboardTone;
    archiveStatus: string;
    archiveStatusText: string;
    archiveTone: DashboardTone;
    dashboardGroupKey: Exclude<DashboardOrderView, "all">;
  }>;
  focus: {
    contractId: string | null;
    contractNo: string | null;
    customerName: string | null;
    contractQuantity: number | null;
    unit: string | null;
    batchCount: number;
    hasQrItems: boolean;
    batchId: string | null;
    batchNo: string | null;
    warehouseName: string | null;
    productName: string | null;
    mainFlowStatus: string | null;
    mainFlowStatusText: string | null;
    mainFlowTone: DashboardTone | null;
    afterSalesStatus: string | null;
    afterSalesStatusText: string | null;
    afterSalesTone: DashboardTone | null;
    exceptionStatus: string | null;
    exceptionStatusText: string | null;
    exceptionTone: DashboardTone | null;
    archiveStatus: string | null;
    archiveStatusText: string | null;
    archiveTone: DashboardTone | null;
  };
  execution: {
    totalQuantity: number;
    unit: string;
    inboundCompleted: number;
    inboundPending: number;
    inboundProgressPercent: number;
    outboundTarget: number;
    outboundCompleted: number;
    outboundRemaining: number;
    outboundProgressPercent: number;
  };
  inventory: InventorySummaryResult["summary"];
  statusCards: DashboardStatusCard[];
  recentTasks: DashboardTask[];
  recentActivities: DashboardActivity[];
};

function toPercent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number(((part / total) * 100).toFixed(1))));
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function decodePotentialMojibake(value: string | null | undefined) {
  if (!value) {
    return value ?? null;
  }

  if (!/[\u00C0-\u00FF]/.test(value)) {
    return value;
  }

  const decoded = Buffer.from(value, "latin1").toString("utf8");

  if (decoded.includes("\uFFFD")) {
    return value;
  }

  return /[\u4E00-\u9FFF]/.test(decoded) ? decoded : value;
}

function resolveDocumentStatusText(input: {
  status: DocumentStatus;
  aiStatus: DocumentAiStatus;
  businessCreated: boolean;
}) {
  if (input.status === DocumentStatus.VOIDED) {
    return "已作废";
  }

  if (input.status === DocumentStatus.REPLACED) {
    return "已替换";
  }

  if (input.status === DocumentStatus.ARCHIVED) {
    return "已归档";
  }

  if (input.businessCreated) {
    return "已生成业务数据";
  }

  if (input.aiStatus === DocumentAiStatus.EXTRACTED) {
    return "已识别待确认";
  }

  if (input.aiStatus === DocumentAiStatus.FAILED) {
    return "识别失败";
  }

  return "待识别";
}

function resolveDocumentTone(input: {
  status: DocumentStatus;
  aiStatus: DocumentAiStatus;
  businessCreated: boolean;
}): DashboardTone {
  if (input.status === DocumentStatus.VOIDED || input.status === DocumentStatus.REPLACED) {
    return "default";
  }

  if (input.businessCreated) {
    return "success";
  }

  if (input.aiStatus === DocumentAiStatus.EXTRACTED) {
    return "warning";
  }

  if (input.aiStatus === DocumentAiStatus.FAILED) {
    return "error";
  }

  return "processing";
}

function resolveMovementTone(movementType: StockMovementType): DashboardTone {
  switch (movementType) {
    case StockMovementType.INBOUND:
      return "processing";
    case StockMovementType.OUTBOUND:
      return "warning";
    case StockMovementType.FREEZE:
      return "warning";
    case StockMovementType.UNFREEZE:
      return "success";
    default:
      return "default";
  }
}

const dashboardOrderViewMeta: Record<
  DashboardOrderView,
  {
    label: string;
    description: string;
  }
> = {
  active: {
    label: "进行中订单",
    description: "默认优先查看尚未走完全链路的订单。"
  },
  completed: {
    label: "已完成待归档",
    description: "主流程已完成、未触发售后和异常，等待人工确认归档。"
  },
  after_sales: {
    label: "售后订单",
    description: "已触发售后处理，主流程与售后状态分开管理。"
  },
  exception: {
    label: "异常订单",
    description: "存在库存异常、货损货差或需要优先处理的异常状态。"
  },
  archived: {
    label: "已归档订单",
    description: "已完成全链路并完成归档确认的历史订单。"
  },
  all: {
    label: "全部订单",
    description: "查看当前系统内全部合同订单。"
  }
};

const orderViewOptions = Object.keys(dashboardOrderViewMeta) as DashboardOrderView[];

function normalizeDashboardOrderView(value: DashboardOrderView | null | undefined): DashboardOrderView {
  return value && orderViewOptions.includes(value) ? value : "active";
}

function createStatusDimension(
  key: DashboardStatusKey,
  text: string,
  tone: DashboardTone
): DashboardStatusDimension {
  return {
    key,
    text,
    tone
  };
}

function deriveMainFlowStatus(input: {
  totalQrItems: number;
  inTransitInventory: number;
  realtimeInventory: number;
  outboundQuantity: number;
  unpaidAmount: number;
}) {
  const { totalQrItems, inTransitInventory, realtimeInventory, outboundQuantity, unpaidAmount } = input;

  if (totalQrItems <= 0) {
    return createStatusDimension("pending_qr", "待生成二维码", "warning");
  }

  if (outboundQuantity >= totalQrItems) {
    if (unpaidAmount > 0) {
      return createStatusDimension("awaiting_receivable", "已出库待回款", "warning");
    }

    return createStatusDimension("completed", "全链路完成", "success");
  }

  if (outboundQuantity > 0) {
    return createStatusDimension("partial_outbound", "销售出库进行中", "warning");
  }

  if (inTransitInventory > 0) {
    if (realtimeInventory > 0) {
      return createStatusDimension("in_transit", "部分入库进行中", "processing");
    }

    return createStatusDimension("in_transit", "在途待入库", "processing");
  }

  if (realtimeInventory > 0) {
    return createStatusDimension("in_stock", "已入库待销售", "success");
  }

  return createStatusDimension("none", "待推进", "default");
}

function deriveAfterSalesStatus() {
  return createStatusDimension("none", "未触发售后", "default");
}

function deriveExceptionStatus(input: {
  abnormalQuantity: number;
  totalQrItems: number;
}) {
  const { abnormalQuantity, totalQrItems } = input;

  if (abnormalQuantity <= 0) {
    return createStatusDimension("normal", "无异常", "success");
  }

  const blockedThreshold = Math.max(3, Math.ceil(totalQrItems * 0.1));

  if (abnormalQuantity >= blockedThreshold) {
    return createStatusDimension("blocked", "异常阻塞", "error");
  }

  return createStatusDimension("warning", "存在异常待处理", "warning");
}

function deriveArchiveStatus(input: {
  mainFlowStatus: DashboardStatusDimension;
  afterSalesStatus: DashboardStatusDimension;
  exceptionStatus: DashboardStatusDimension;
}) {
  const { mainFlowStatus, afterSalesStatus, exceptionStatus } = input;

  if (mainFlowStatus.key === "completed" && afterSalesStatus.key === "none" && exceptionStatus.key === "normal") {
    return createStatusDimension("ready", "待归档", "success");
  }

  return createStatusDimension("not_ready", "未到归档阶段", "default");
}

function resolveDashboardGroupKey(input: {
  mainFlowStatus: DashboardStatusDimension;
  afterSalesStatus: DashboardStatusDimension;
  exceptionStatus: DashboardStatusDimension;
  archiveStatus: DashboardStatusDimension;
}): Exclude<DashboardOrderView, "all"> {
  const { mainFlowStatus, afterSalesStatus, exceptionStatus, archiveStatus } = input;

  if (archiveStatus.key === "archived") {
    return "archived";
  }

  if (exceptionStatus.key === "warning" || exceptionStatus.key === "blocked") {
    return "exception";
  }

  if (afterSalesStatus.key === "open" || afterSalesStatus.key === "processing") {
    return "after_sales";
  }

  if (mainFlowStatus.key === "completed" && archiveStatus.key === "ready") {
    return "completed";
  }

  return "active";
}

export async function getDashboardOverview(options: DashboardOverviewOptions = {}): Promise<DashboardOverview> {
  const [
    inventory,
    assistantRuntime,
    activeScenario,
    documents,
    contracts,
    batches,
    qrItemsCount,
    stockMovementsCount,
    aiLogsCount,
    workOrdersCount,
    receivables,
    preReceiveOrders,
    inboundOrders,
    outboundOrders,
    salesOrders,
    recentDocuments,
    recentContracts,
    recentBatches,
    recentMovements,
    recentAiLogs
  ] = await Promise.all([
    buildInventorySummary(),
    resolveAiAssistantRuntime(),
    prisma.demoConfig.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        scenarioName: true,
        origin: true,
        destinationWarehouse: true,
        customerName: true,
        supplierName: true,
        productName: true,
        totalQuantity: true,
        unit: true,
        plannedOutboundQuantity: true,
        amount: true,
        currency: true
      }
    }),
    prisma.document.findMany({
      where: {
        isDeleted: false,
        status: {
          not: DocumentStatus.DELETED
        }
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        originalName: true,
        status: true,
        aiStatus: true,
        businessCreated: true,
        updatedAt: true
      }
    }),
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        contractNo: true,
        customerName: true,
        totalQuantity: true,
        unit: true,
        createdAt: true
      }
    }),
    prisma.batch.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        contractId: true,
        destinationWarehouse: true,
        batchNo: true,
        productName: true,
        totalQuantity: true,
        unit: true,
        status: true,
        updatedAt: true,
        contract: {
          select: {
            id: true,
            customerName: true,
            contractNo: true
          }
        }
      }
    }),
    prisma.qrItem.count(),
    prisma.stockMovement.count(),
    prisma.aiLog.count(),
    prisma.workOrder.count(),
    prisma.receivable.findMany({
      select: {
        id: true,
        contractId: true,
        amount: true,
        receivedAmount: true,
        currency: true
      }
    }),
    prisma.preReceiveOrder.findMany({
      where: {
        status: {
          notIn: ["COMPLETED", "CANCELLED"]
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        contractId: true,
        preReceiveNo: true,
        status: true,
        quantity: true,
        unit: true
      }
    }),
    prisma.inboundOrder.findMany({
      where: {
        status: {
          notIn: ["COMPLETED", "CANCELLED"]
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        contractId: true,
        inboundNo: true,
        status: true,
        quantity: true,
        unit: true
      }
    }),
    prisma.outboundOrder.findMany({
      where: {
        status: {
          notIn: ["COMPLETED", "CANCELLED"]
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        contractId: true,
        outboundNo: true,
        status: true,
        quantity: true,
        unit: true
      }
    }),
    prisma.salesOrder.findMany({
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        contractId: true,
        salesNo: true,
        status: true,
        deliveryStatus: true,
        signStatus: true
      }
    }),
    prisma.document.findMany({
      where: {
        isDeleted: false,
        status: {
          not: DocumentStatus.DELETED
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: {
        id: true,
        originalName: true,
        status: true,
        aiStatus: true,
        businessCreated: true,
        updatedAt: true
      }
    }),
    prisma.contract.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        contractNo: true,
        customerName: true,
        totalQuantity: true,
        unit: true,
        createdAt: true
      }
    }),
    prisma.batch.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        batchNo: true,
        productName: true,
        status: true,
        updatedAt: true,
        contract: {
          select: {
            contractNo: true
          }
        }
      }
    }),
    prisma.stockMovement.findMany({
      orderBy: { occurredAt: "desc" },
      take: 5,
      select: {
        id: true,
        movementType: true,
        occurredAt: true,
        warehouseName: true,
        qrItem: {
          select: {
            qrCode: true
          }
        },
        batch: {
          select: {
            batchNo: true
          }
        }
      }
    }),
    prisma.aiLog.findMany({
      where: {
        taskType: {
          in: [AiTaskType.DOCUMENT_EXTRACT, AiTaskType.INVENTORY_QA]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        taskType: true,
        provider: true,
        model: true,
        createdAt: true
      }
    })
  ]);

  const scenario = activeScenario ?? {
    scenarioName: demoScenarioConfig.scenarioName,
    origin: demoScenarioConfig.origin,
    destinationWarehouse: demoScenarioConfig.destinationWarehouse,
    customerName: demoScenarioConfig.customerName,
    supplierName: demoScenarioConfig.supplierName,
    productName: demoScenarioConfig.productName,
    totalQuantity: demoScenarioConfig.totalQuantity,
    unit: demoScenarioConfig.unit,
    plannedOutboundQuantity: demoScenarioConfig.plannedOutboundQuantity,
    amount: demoScenarioConfig.amount,
    currency: demoScenarioConfig.currency
  };

  const orderView = normalizeDashboardOrderView(options.orderView);

  const contractInventoryMap = new Map(
    inventory.byContract.filter((item) => item.contractId).map((item) => [item.contractId as string, item])
  );
  const batchInventoryMap = new Map(inventory.byBatch.map((item) => [item.batchId, item]));
  const batchCountByContractId = new Map<string, number>();
  const unpaidAmountByContractId = new Map<string, number>();

  for (const batch of batches) {
    batchCountByContractId.set(batch.contractId, (batchCountByContractId.get(batch.contractId) ?? 0) + 1);
  }

  for (const receivable of receivables) {
    if (!receivable.contractId) {
      continue;
    }

    const openAmount = Math.max(receivable.amount - receivable.receivedAmount, 0);
    unpaidAmountByContractId.set(
      receivable.contractId,
      roundMoney((unpaidAmountByContractId.get(receivable.contractId) ?? 0) + openAmount)
    );
  }

  const contractProfiles: DashboardContractProfile[] = contracts.map((item) => {
    const contractInventory = contractInventoryMap.get(item.id);
    const totalQrItems = contractInventory?.totalQrItems ?? 0;
    const inTransitInventory = contractInventory?.inTransitInventory ?? 0;
    const realtimeInventory = contractInventory?.realtimeInventory ?? 0;
    const outboundQuantity = contractInventory?.outboundQuantity ?? 0;
    const abnormalQuantity = contractInventory?.abnormalQuantity ?? 0;
    const unpaidContractAmount = unpaidAmountByContractId.get(item.id) ?? 0;

    const mainFlowStatus = deriveMainFlowStatus({
      totalQrItems,
      inTransitInventory,
      realtimeInventory,
      outboundQuantity,
      unpaidAmount: unpaidContractAmount
    });
    const afterSalesStatus = deriveAfterSalesStatus();
    const exceptionStatus = deriveExceptionStatus({
      abnormalQuantity,
      totalQrItems
    });
    const archiveStatus = deriveArchiveStatus({
      mainFlowStatus,
      afterSalesStatus,
      exceptionStatus
    });

    return {
      contractId: item.id,
      contractNo: item.contractNo,
      customerName: item.customerName,
      totalQuantity: item.totalQuantity,
      unit: item.unit,
      batchCount: batchCountByContractId.get(item.id) ?? 0,
      hasQrItems: totalQrItems > 0,
      totalQrItems,
      inTransitInventory,
      realtimeInventory,
      outboundQuantity,
      abnormalQuantity,
      unpaidAmount: unpaidContractAmount,
      mainFlowStatus,
      afterSalesStatus,
      exceptionStatus,
      archiveStatus,
      dashboardGroupKey: resolveDashboardGroupKey({
        mainFlowStatus,
        afterSalesStatus,
        exceptionStatus,
        archiveStatus
      })
    };
  });

  const orderPools: DashboardOrderPoolSummary[] = orderViewOptions.map((key) => ({
    key,
    label: dashboardOrderViewMeta[key].label,
    count: key === "all" ? contractProfiles.length : contractProfiles.filter((item) => item.dashboardGroupKey === key).length,
    description: dashboardOrderViewMeta[key].description
  }));

  const visibleProfiles =
    orderView === "all"
      ? contractProfiles
      : contractProfiles.filter((item) => item.dashboardGroupKey === orderView);

  const fallbackProfile = visibleProfiles.find((item) => item.hasQrItems) ?? visibleProfiles[0] ?? null;
  const selectedProfile = visibleProfiles.find((item) => item.contractId === options.focusContractId) ?? fallbackProfile;
  const selectedContract = contracts.find((item) => item.id === selectedProfile?.contractId) ?? null;
  const selectedContractInventory = selectedContract ? contractInventoryMap.get(selectedContract.id) ?? null : null;
  const selectedContractBatches = selectedContract ? batches.filter((item) => item.contractId === selectedContract.id) : [];
  const focusBatchRecord =
    selectedContractBatches.find((item) => (batchInventoryMap.get(item.id)?.totalQrItems ?? 0) > 0) ??
    selectedContractBatches[0] ??
    null;
  const focusBatchInventory = focusBatchRecord ? batchInventoryMap.get(focusBatchRecord.id) ?? null : null;
  const focusWarehouse =
    focusBatchInventory?.warehouseId
      ? inventory.byWarehouse.find((item) => item.warehouseId === focusBatchInventory.warehouseId) ?? null
      : null;

  const totalQuantity = selectedProfile ? selectedContract?.totalQuantity ?? focusBatchInventory?.batchQuantity ?? 0 : 0;
  const unit = selectedContract?.unit ?? selectedProfile?.unit ?? selectedContractInventory?.unit ?? focusBatchInventory?.unit ?? scenario.unit;
  const inboundPending = selectedProfile?.inTransitInventory ?? selectedContractInventory?.inTransitInventory ?? 0;
  const outboundCompleted = selectedProfile?.outboundQuantity ?? selectedContractInventory?.outboundQuantity ?? 0;
  const inboundCompleted =
    selectedProfile && totalQuantity > 0 ? Math.max(totalQuantity - inboundPending, 0) : 0;
  const outboundTarget = Math.min(scenario.plannedOutboundQuantity, totalQuantity);
  const outboundRemaining = Math.max(outboundTarget - outboundCompleted, 0);

  const unpaidReceivables = receivables
    .map((item) => ({
      ...item,
      openAmount: Math.max(item.amount - item.receivedAmount, 0)
    }))
    .filter((item) => item.openAmount > 0);

  const unpaidAmount = roundMoney(unpaidReceivables.reduce((sum, item) => sum + item.openAmount, 0));
  const financeCurrency = unpaidReceivables[0]?.currency ?? scenario.currency;

  const draftDocuments = documents.filter((item) => !item.businessCreated).length;
  const businessDocuments = documents.filter((item) => item.businessCreated).length;
  const selectedContractHasQrItems = selectedProfile?.hasQrItems ?? (selectedContractInventory?.totalQrItems ?? 0) > 0;
  const availableContracts = visibleProfiles.map((item) => ({
    contractId: item.contractId,
    contractNo: item.contractNo,
    customerName: item.customerName,
    totalQuantity: item.totalQuantity,
    unit: item.unit,
    batchCount: item.batchCount,
    hasQrItems: item.hasQrItems,
    totalQrItems: item.totalQrItems,
    inTransitInventory: item.inTransitInventory,
    realtimeInventory: item.realtimeInventory,
    outboundQuantity: item.outboundQuantity,
    unpaidAmount: item.unpaidAmount,
    mainFlowStatus: item.mainFlowStatus.key,
    mainFlowStatusText: item.mainFlowStatus.text,
    mainFlowTone: item.mainFlowStatus.tone,
    afterSalesStatus: item.afterSalesStatus.key,
    afterSalesStatusText: item.afterSalesStatus.text,
    afterSalesTone: item.afterSalesStatus.tone,
    exceptionStatus: item.exceptionStatus.key,
    exceptionStatusText: item.exceptionStatus.text,
    exceptionTone: item.exceptionStatus.tone,
    archiveStatus: item.archiveStatus.key,
    archiveStatusText: item.archiveStatus.text,
    archiveTone: item.archiveStatus.tone,
    dashboardGroupKey: item.dashboardGroupKey
  }));

  const statusCards: DashboardStatusCard[] = [
    {
      key: "documents",
      title: "合同与单据",
      statusText:
        draftDocuments > 0 ? `${draftDocuments} 份草稿待确认` : businessDocuments > 0 ? "已生成业务数据" : "等待上传单据",
      tone: draftDocuments > 0 ? "warning" : businessDocuments > 0 ? "success" : "default",
      metricLabel: "单据 / 合同 / 批次",
      metricValue: `${documents.length} / ${contracts.length} / ${batches.length}`,
      description: "上传、识别、人工修正、确认生成业务数据的主链路已经可演示。",
      routePath: "/documents"
    },
    {
      key: "qr",
      title: "二维码追溯",
      statusText: qrItemsCount > 0 ? "已接入真实二维码状态" : "待生成二维码",
      tone: qrItemsCount > 0 ? "success" : "default",
      metricLabel: "全局二维码累计",
      metricValue: `${qrItemsCount} 个码`,
      description: "这里展示的是系统内所有已生成二维码的全局累计，进入追溯页后再按最新批次或指定批次查看明细。",
      routePath: "/qr-items"
    },
    {
      key: "warehouse",
      title: "仓储扫码",
      statusText:
        stockMovementsCount > 0
          ? `已完成 ${inventory.summary.totalInboundMovements} 次入库、${inventory.summary.totalOutboundMovements} 次出库`
          : "等待扫码执行",
      tone: stockMovementsCount > 0 ? "processing" : "default",
      metricLabel: "在途 / 在库 / 已出库",
      metricValue: `${inventory.summary.inTransitInventory} / ${inventory.summary.realtimeInventory} / ${inventory.summary.outboundQuantity}`,
      description: "扫码入库与扫码出库都已经带有防呆校验和人工确认。",
      routePath: "/warehouse"
    },
    {
      key: "finance",
      title: "财务回款",
      statusText: unpaidReceivables.length > 0 ? `${unpaidReceivables.length} 笔待回款` : "暂无待回款",
      tone: unpaidReceivables.length > 0 ? "warning" : "success",
      metricLabel: "未回款金额",
      metricValue: `${unpaidAmount} ${financeCurrency}`,
      description: "回款与核销仍是演示版，但首页已能把业务金额和跟进状态串起来。",
      routePath: "/finance"
    },
    {
      key: "assistant",
      title: "AI 助手",
      statusText: assistantRuntime.llmEnabled ? "升级版 AI 已启用" : "本地模板模式",
      tone: assistantRuntime.llmEnabled ? "success" : "default",
      metricLabel: "当前模型",
      metricValue: assistantRuntime.model ?? "本地模板",
      description: "支持网页保存升级配置，并在失败时自动回退到模板回答。",
      routePath: "/ai-assistant"
    },
    {
      key: "scenario",
      title: "演示场景",
      statusText: "默认场景可配置",
      tone: "processing",
      metricLabel: "采购 / 出库目标",
      metricValue: `${scenario.totalQuantity}${scenario.unit} / ${scenario.plannedOutboundQuantity}${scenario.unit}`,
      description: "商品、客户、供应商、仓库、数量、金额和币种都支持后续配置化调整。",
      routePath: "/dashboard"
    }
  ];

  const recentTasks: DashboardTask[] = [];
  const latestDraftDocument = documents.find((item) => !item.businessCreated);
  const selectedPreReceiveOrder = selectedProfile
    ? preReceiveOrders.find((item) => item.contractId === selectedProfile.contractId) ?? null
    : null;
  const selectedInboundOrder = selectedProfile
    ? inboundOrders.find((item) => item.contractId === selectedProfile.contractId) ?? null
    : null;
  const selectedOutboundOrder = selectedProfile
    ? outboundOrders.find((item) => item.contractId === selectedProfile.contractId) ?? null
    : null;
  const selectedSalesOrder = selectedProfile
    ? salesOrders.find((item) => item.contractId === selectedProfile.contractId) ?? null
    : null;

  if (latestDraftDocument) {
    recentTasks.push({
      id: `doc-${latestDraftDocument.id}`,
      title: "单据草稿待确认生成业务数据",
      owner: "单证 / 业务",
      reference: decodePotentialMojibake(latestDraftDocument.originalName) ?? latestDraftDocument.id,
      statusText: resolveDocumentStatusText(latestDraftDocument),
      tone: resolveDocumentTone(latestDraftDocument),
      description: "AI 识别已经完成，但仍需人工确认后才会生成正式合同、批次与应收草稿。",
      routePath: "/documents"
    });
  }

  if (selectedPreReceiveOrder && selectedContractHasQrItems) {
    recentTasks.push({
      id: `pre-${selectedPreReceiveOrder.preReceiveNo}`,
      title: "仓库预收货待跟进",
      owner: "仓储部",
      reference: selectedPreReceiveOrder.preReceiveNo,
      statusText: selectedPreReceiveOrder.status,
      tone: "processing",
      description: `当前预收货数量 ${selectedPreReceiveOrder.quantity}${selectedPreReceiveOrder.unit}，等待继续收货验收。`,
      routePath: "/warehouse"
    });
  }

  if (selectedInboundOrder && selectedContractHasQrItems && inboundPending > 0) {
    recentTasks.push({
      id: `in-${selectedInboundOrder.inboundNo}`,
      title: "扫码入库任务继续执行",
      owner: "仓储部",
      reference: selectedInboundOrder.inboundNo,
      statusText: selectedInboundOrder.status,
      tone: "processing",
      description: `当前仍有 ${inboundPending}${unit} 待入库，需继续扫码确认。`,
      routePath: "/warehouse"
    });
  }

  if (selectedOutboundOrder && selectedContractHasQrItems && outboundRemaining > 0) {
    recentTasks.push({
      id: `out-${selectedOutboundOrder.outboundNo}`,
      title: "销售出库任务待推进",
      owner: "仓储部 / 销售部",
      reference: selectedOutboundOrder.outboundNo,
      statusText: selectedOutboundOrder.status,
      tone: "warning",
      description: `计划出库 ${outboundTarget}${unit}，当前已完成 ${outboundCompleted}${unit}，剩余 ${outboundRemaining}${unit}。`,
      routePath: "/warehouse"
    });
  }

  if (selectedSalesOrder && selectedContractHasQrItems) {
    recentTasks.push({
      id: `sales-${selectedSalesOrder.salesNo}`,
      title: "销售与配送状态待跟进",
      owner: "销售部",
      reference: selectedSalesOrder.salesNo,
      statusText: selectedSalesOrder.deliveryStatus,
      tone: selectedSalesOrder.signStatus === "UNSIGNED" ? "warning" : "success",
      description: `销售单状态 ${selectedSalesOrder.status}，当前配送状态 ${selectedSalesOrder.deliveryStatus}。`,
      routePath: "/sales"
    });
  }

  if (unpaidReceivables.length > 0) {
    recentTasks.push({
      id: "finance-follow-up",
      title: "财务回款待跟进",
      owner: "财务部",
      reference: selectedContract?.contractNo ?? "应收汇总",
      statusText: "待回款",
      tone: "warning",
      description: `当前共有 ${unpaidReceivables.length} 笔未回款记录，金额 ${unpaidAmount} ${financeCurrency}。`,
      routePath: "/finance"
    });
  }

  const recentActivities: DashboardActivity[] = [
    ...recentMovements.map((item) => ({
      id: `movement-${item.id}`,
      kind: "仓储动作",
      title: `${item.batch.batchNo} ${item.movementType === StockMovementType.INBOUND ? "完成扫码入库" : "完成扫码出库"}`,
      occurredAt: item.occurredAt.toISOString(),
      tone: resolveMovementTone(item.movementType) as DashboardTone,
      description: `${item.qrItem.qrCode} 在 ${item.warehouseName ?? "目标仓库"} 完成了 ${item.movementType === StockMovementType.INBOUND ? "入库" : "出库"}。`,
      routePath: "/warehouse"
    })),
    ...recentDocuments.map((item) => ({
      id: `document-${item.id}`,
      kind: "单据进展",
      title: `${decodePotentialMojibake(item.originalName) ?? "未命名单据"} ${resolveDocumentStatusText(item)}`,
      occurredAt: item.updatedAt.toISOString(),
      tone: resolveDocumentTone(item) as DashboardTone,
      description: item.businessCreated
        ? "这份单据已经确认生成业务数据，但不会直接改写库存。"
        : "这份单据仍停留在草稿识别层，支持人工修正后再确认生成业务数据。",
      routePath: "/documents"
    })),
    ...recentContracts.map((item) => ({
      id: `contract-${item.id}`,
      kind: "合同生成",
      title: `正式合同 ${item.contractNo} 已创建`,
      occurredAt: item.createdAt.toISOString(),
      tone: "success" as DashboardTone,
      description: `客户 ${item.customerName}，合同数量 ${item.totalQuantity}${item.unit}。`,
      routePath: "/contracts"
    })),
    ...recentBatches.map((item) => ({
      id: `batch-${item.id}`,
      kind: "批次推进",
      title: `批次 ${item.batchNo} 当前状态 ${item.status}`,
      occurredAt: item.updatedAt.toISOString(),
      tone: (item.status === "READY_FOR_QR" ? "processing" : "default") as DashboardTone,
      description: `关联合同 ${item.contract.contractNo}，商品 ${item.productName}。`,
      routePath: "/batches"
    })),
    ...recentAiLogs.map((item) => ({
      id: `ai-${item.id}`,
      kind: "AI 记录",
      title: item.taskType === AiTaskType.DOCUMENT_EXTRACT ? "AI 单据识别已执行" : "AI 库存问答已执行",
      occurredAt: item.createdAt.toISOString(),
      tone: (item.taskType === AiTaskType.DOCUMENT_EXTRACT ? "processing" : "success") as DashboardTone,
      description: `${item.provider}${item.model ? ` / ${item.model}` : ""} 已参与当前 Demo 链路。`,
      routePath: item.taskType === AiTaskType.DOCUMENT_EXTRACT ? "/documents" : "/ai-assistant"
    }))
  ]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 10);

  return {
    generatedAt: new Date().toISOString(),
    scenario,
    assistant: {
      llmEnabled: assistantRuntime.llmEnabled,
      mode: assistantRuntime.mode,
      source: assistantRuntime.source,
      provider: assistantRuntime.provider,
      model: assistantRuntime.model
    },
    counts: {
      documents: documents.length,
      draftDocuments,
      businessDocuments,
      contracts: contracts.length,
      batches: batches.length,
      qrItems: qrItemsCount,
      stockMovements: stockMovementsCount,
      aiLogs: aiLogsCount,
      workOrdersInDatabase: workOrdersCount
    },
    finance: {
      unpaidCount: unpaidReceivables.length,
      unpaidAmount,
      currency: financeCurrency
    },
    orderView,
    orderPools,
    availableContracts,
    focus: {
      contractId: selectedContract?.id ?? selectedProfile?.contractId ?? null,
      contractNo: selectedContract?.contractNo ?? selectedProfile?.contractNo ?? selectedContractInventory?.contractNo ?? null,
      customerName: selectedContract?.customerName ?? selectedProfile?.customerName ?? selectedContractInventory?.customerName ?? null,
      contractQuantity: selectedContract?.totalQuantity ?? selectedProfile?.totalQuantity ?? selectedContractInventory?.contractQuantity ?? null,
      unit,
      batchCount: selectedContractBatches.length,
      hasQrItems: selectedProfile?.hasQrItems ?? (selectedContractInventory?.totalQrItems ?? 0) > 0,
      batchId: focusBatchRecord?.id ?? null,
      batchNo: focusBatchInventory?.batchNo ?? focusBatchRecord?.batchNo ?? null,
      warehouseName: selectedProfile
        ? focusWarehouse?.warehouseName ?? focusBatchInventory?.warehouseName ?? focusBatchRecord?.destinationWarehouse ?? null
        : null,
      productName: selectedProfile ? focusBatchInventory?.productName ?? focusBatchRecord?.productName ?? null : null,
      mainFlowStatus: selectedProfile?.mainFlowStatus.key ?? null,
      mainFlowStatusText: selectedProfile?.mainFlowStatus.text ?? null,
      mainFlowTone: selectedProfile?.mainFlowStatus.tone ?? null,
      afterSalesStatus: selectedProfile?.afterSalesStatus.key ?? null,
      afterSalesStatusText: selectedProfile?.afterSalesStatus.text ?? null,
      afterSalesTone: selectedProfile?.afterSalesStatus.tone ?? null,
      exceptionStatus: selectedProfile?.exceptionStatus.key ?? null,
      exceptionStatusText: selectedProfile?.exceptionStatus.text ?? null,
      exceptionTone: selectedProfile?.exceptionStatus.tone ?? null,
      archiveStatus: selectedProfile?.archiveStatus.key ?? null,
      archiveStatusText: selectedProfile?.archiveStatus.text ?? null,
      archiveTone: selectedProfile?.archiveStatus.tone ?? null
    },
    execution: {
      totalQuantity,
      unit,
      inboundCompleted,
      inboundPending,
      inboundProgressPercent: toPercent(inboundCompleted, totalQuantity),
      outboundTarget,
      outboundCompleted,
      outboundRemaining,
      outboundProgressPercent: toPercent(outboundCompleted, outboundTarget)
    },
    inventory: inventory.summary,
    statusCards,
    recentTasks: recentTasks.slice(0, 6),
    recentActivities
  };
}
