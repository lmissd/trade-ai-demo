import { type Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma";

type CostStatusCode = "DEMO_ESTIMATE" | "MANUAL_DRAFT";
type CostStatusColor = "default" | "processing" | "success";
type CostLineSource = "DEMO_TEMPLATE" | "MANUAL_ENTRY";

const BASE_CURRENCY = "CNY";
const demoTemplateRatios = {
  purchase: 0.6,
  internationalFreight: 0.1,
  customs: 0.04,
  warehouse: 3500 / 360000,
  localDelivery: 2100 / 360000,
  miscellaneous: 1600 / 360000
} as const;

const fallbackRateToCny: Record<string, number> = {
  CNY: 1,
  USD: 7.2,
  EUR: 7.8,
  HKD: 0.92,
  SGD: 5.3,
  ZMW: 0.26,
  CDF: 0.0025
};

const contractsSelect = {
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
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ContractSelect;

const batchSelect = {
  id: true,
  contractId: true,
  batchNo: true,
  sku: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  destinationWarehouse: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.BatchSelect;

const purchaseOrderSelect = {
  id: true,
  contractId: true,
  purchaseNo: true,
  supplierName: true,
  skuName: true,
  quantity: true,
  unit: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PurchaseOrderSelect;

const shipmentSelect = {
  id: true,
  contractId: true,
  batchId: true,
  shipmentNo: true,
  shippingCompany: true,
  billOfLadingNo: true,
  containerNo: true,
  originPort: true,
  destinationPort: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ShipmentSelect;

const salesOrderSelect = {
  id: true,
  contractId: true,
  batchId: true,
  salesNo: true,
  customerName: true,
  skuName: true,
  quantity: true,
  unit: true,
  amount: true,
  currency: true,
  deliveryStatus: true,
  signStatus: true,
  status: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.SalesOrderSelect;

const paymentSelect = {
  id: true,
  contractId: true,
  receivableAmount: true,
  receivedAmount: true,
  currency: true,
  status: true,
  dueDate: true,
  paidAt: true,
  receivedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.PaymentSelect;

const receivableSelect = {
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
} satisfies Prisma.ReceivableSelect;

const costItemSelect = {
  id: true,
  contractId: true,
  batchId: true,
  costType: true,
  amount: true,
  currency: true,
  exchangeRate: true,
  baseCurrencyAmount: true,
  remark: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.CostItemSelect;

type ContractRecord = Prisma.ContractGetPayload<{ select: typeof contractsSelect }>;
type BatchRecord = Prisma.BatchGetPayload<{ select: typeof batchSelect }>;
type PurchaseOrderRecord = Prisma.PurchaseOrderGetPayload<{ select: typeof purchaseOrderSelect }>;
type ShipmentRecord = Prisma.ShipmentGetPayload<{ select: typeof shipmentSelect }>;
type SalesOrderRecord = Prisma.SalesOrderGetPayload<{ select: typeof salesOrderSelect }>;
type PaymentRecord = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;
type ReceivableRecord = Prisma.ReceivableGetPayload<{ select: typeof receivableSelect }>;
type CostItemRecord = Prisma.CostItemGetPayload<{ select: typeof costItemSelect }>;

export const costsRouter = Router();

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function roundPercent(value: number) {
  return Number(value.toFixed(2));
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function buildRateLookup(exchangeRates: Array<{ fromCurrency: string; rate: number }>) {
  const lookup = new Map<string, number>();

  lookup.set(BASE_CURRENCY, 1);

  for (const entry of exchangeRates) {
    const key = entry.fromCurrency.trim().toUpperCase();
    if (!lookup.has(key)) {
      lookup.set(key, entry.rate);
    }
  }

  for (const [currency, rate] of Object.entries(fallbackRateToCny)) {
    if (!lookup.has(currency)) {
      lookup.set(currency, rate);
    }
  }

  return lookup;
}

function getRateToCny(currency: string | null | undefined, lookup: Map<string, number>) {
  const normalized = (currency ?? BASE_CURRENCY).trim().toUpperCase();
  return lookup.get(normalized) ?? 1;
}

function resolveCostTypeMeta(costType: string) {
  const normalized = costType.trim().toUpperCase();

  switch (normalized) {
    case "PURCHASE":
    case "PURCHASE_COST":
      return { key: "purchase", label: "采购成本" };
    case "FREIGHT":
    case "INTERNATIONAL_FREIGHT":
      return { key: "internationalFreight", label: "国际运费" };
    case "CUSTOMS":
    case "CUSTOMS_CLEARANCE":
      return { key: "customs", label: "清关费" };
    case "WAREHOUSE":
    case "WAREHOUSE_STORAGE":
      return { key: "warehouse", label: "仓储费" };
    case "LOCAL_DELIVERY":
    case "LAST_MILE":
      return { key: "localDelivery", label: "本地配送费" };
    case "MISC":
    case "MISCELLANEOUS":
    case "OTHER":
      return { key: "miscellaneous", label: "杂费" };
    default:
      return { key: normalized.toLowerCase(), label: costType };
  }
}

function resolveStatusMeta(isDemoData: boolean, costItemCount: number) {
  if (isDemoData) {
    return {
      code: "DEMO_ESTIMATE" as CostStatusCode,
      label: "Demo 估算",
      color: "processing" as CostStatusColor,
      summary: "当前成本利润口径使用 Demo 模板测算，正式版将按真实费用单据、汇率与财务规则核算。"
    };
  }

  return {
    code: "MANUAL_DRAFT" as CostStatusCode,
    label: costItemCount >= 6 ? "手工成本草稿" : "部分成本录入",
    color: costItemCount >= 6 ? ("success" as CostStatusColor) : ("default" as CostStatusColor),
    summary:
      costItemCount >= 6
        ? "当前记录已录入完整的成本明细，可继续扩展为正式成本核算。"
        : "当前记录已录入部分成本项，剩余费用仍可继续补录。"
  };
}

function formatAmount(amount: number, currency: string) {
  return `${roundMoney(amount).toLocaleString("zh-CN")} ${currency}`;
}

function buildDemoCostLines(
  salesAmount: number,
  salesCurrency: string,
  rateLookup: Map<string, number>
) {
  const salesRateToCny = getRateToCny(salesCurrency, rateLookup);
  const salesBaseCny = roundMoney(salesAmount * salesRateToCny);
  const localDeliveryRateToCny = getRateToCny("ZMW", rateLookup);

  const lines = [
    {
      key: "purchase",
      costType: "PURCHASE_COST",
      label: "采购成本",
      amount: roundMoney(salesAmount * demoTemplateRatios.purchase),
      currency: salesCurrency,
      exchangeRateToCny: salesRateToCny,
      remark: "按合同销售金额的 60% 估算采购成本。"
    },
    {
      key: "internationalFreight",
      costType: "INTERNATIONAL_FREIGHT",
      label: "国际运费",
      amount: roundMoney(salesAmount * demoTemplateRatios.internationalFreight),
      currency: salesCurrency,
      exchangeRateToCny: salesRateToCny,
      remark: "按合同销售金额的 10% 估算国际海运与装柜费用。"
    },
    {
      key: "customs",
      costType: "CUSTOMS_CLEARANCE",
      label: "清关费",
      amount: roundMoney(salesAmount * demoTemplateRatios.customs),
      currency: salesCurrency,
      exchangeRateToCny: salesRateToCny,
      remark: "按合同销售金额的 4% 估算清关与报关相关费用。"
    },
    {
      key: "warehouse",
      costType: "WAREHOUSE_STORAGE",
      label: "仓储费",
      amount: roundMoney(salesBaseCny * demoTemplateRatios.warehouse),
      currency: "CNY",
      exchangeRateToCny: 1,
      remark: "以人民币演示仓储费用，体现多币种成本结构。"
    },
    {
      key: "localDelivery",
      costType: "LOCAL_DELIVERY",
      label: "本地配送费",
      amount: roundMoney((salesBaseCny * demoTemplateRatios.localDelivery) / localDeliveryRateToCny),
      currency: "ZMW",
      exchangeRateToCny: localDeliveryRateToCny,
      remark: "以赞比亚本地币种演示末端配送费用。"
    },
    {
      key: "miscellaneous",
      costType: "MISCELLANEOUS",
      label: "杂费",
      amount: roundMoney(salesBaseCny * demoTemplateRatios.miscellaneous),
      currency: "CNY",
      exchangeRateToCny: 1,
      remark: "用于承接文件、保险与其他零散费用的 Demo 测算。"
    }
  ];

  return lines.map((line) => ({
    ...line,
    source: "DEMO_TEMPLATE" as CostLineSource,
    baseCurrencyAmount: roundMoney(line.amount * line.exchangeRateToCny)
  }));
}

function buildManualCostLines(items: CostItemRecord[], rateLookup: Map<string, number>) {
  return items
    .slice()
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
    .map((item) => {
      const meta = resolveCostTypeMeta(item.costType);
      const exchangeRateToCny = item.exchangeRate ?? getRateToCny(item.currency, rateLookup);
      const baseCurrencyAmount = item.baseCurrencyAmount ?? roundMoney(item.amount * exchangeRateToCny);

      return {
        key: item.id,
        costType: item.costType,
        label: meta.label,
        amount: roundMoney(item.amount),
        currency: item.currency,
        exchangeRateToCny: roundMoney(exchangeRateToCny),
        baseCurrencyAmount: roundMoney(baseCurrencyAmount),
        remark: item.remark ?? "已录入成本项。",
        source: "MANUAL_ENTRY" as CostLineSource
      };
    });
}

function buildHistory(
  contract: ContractRecord,
  batch: BatchRecord | null,
  purchaseOrder: PurchaseOrderRecord | null,
  shipment: ShipmentRecord | null,
  salesOrder: SalesOrderRecord | null,
  receivable: ReceivableRecord | null,
  isDemoData: boolean,
  costLinesCount: number
) {
  const history = [
    {
      id: `${contract.id}-contract`,
      action: "CONTRACT_CREATED",
      operator: "系统",
      occurredAt: contract.createdAt.toISOString(),
      summary: `正式合同 ${contract.contractNo} 已生成，销售金额 ${formatAmount(contract.amount, contract.currency)}。`
    }
  ];

  if (batch) {
    history.push({
      id: `${batch.id}-batch`,
      action: "BATCH_CREATED",
      operator: "系统",
      occurredAt: batch.createdAt.toISOString(),
      summary: `批次 ${batch.batchNo} 已建立，数量 ${batch.totalQuantity}${batch.unit}。`
    });
  }

  if (purchaseOrder) {
    history.push({
      id: `${purchaseOrder.id}-purchase`,
      action: "PURCHASE_CREATED",
      operator: "系统",
      occurredAt: purchaseOrder.createdAt.toISOString(),
      summary: `采购单 ${purchaseOrder.purchaseNo} 已生成，可作为采购成本来源。`
    });
  }

  if (shipment) {
    history.push({
      id: `${shipment.id}-shipment`,
      action: "SHIPMENT_CREATED",
      operator: "系统",
      occurredAt: shipment.createdAt.toISOString(),
      summary: `国际物流记录 ${shipment.shipmentNo} 已进入链路，可承接运费与清关成本。`
    });
  }

  if (salesOrder) {
    history.push({
      id: `${salesOrder.id}-sales`,
      action: "SALES_CREATED",
      operator: "系统",
      occurredAt: salesOrder.createdAt.toISOString(),
      summary: `销售单 ${salesOrder.salesNo} 已建立，作为利润测算的销售收入口径。`
    });
  }

  if (receivable) {
    history.push({
      id: `${receivable.id}-receivable`,
      action: "RECEIVABLE_CREATED",
      operator: "系统",
      occurredAt: receivable.createdAt.toISOString(),
      summary: `应收记录已建立，当前状态 ${receivable.status}。`
    });
  }

  history.push({
    id: `${contract.id}-costing`,
    action: isDemoData ? "DEMO_COST_TEMPLATE_READY" : "MANUAL_COST_LINES_READY",
    operator: "系统",
    occurredAt: contract.updatedAt.toISOString(),
    summary: isDemoData
      ? `系统已按 Demo 模板准备 ${costLinesCount} 类成本测算项，用于第一版利润演示。`
      : `当前已录入 ${costLinesCount} 条成本项，可用于成本利润测算。`
  });

  return history.sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
  );
}

async function loadCostingContext(contractIds?: string[]) {
  const contracts = await prisma.contract.findMany({
    where: contractIds ? { id: { in: contractIds } } : undefined,
    orderBy: { createdAt: "desc" },
    select: contractsSelect
  });

  if (contracts.length === 0) {
    return { contracts: [] as ContractRecord[], views: [] as Array<any> };
  }

  const contractIdList = contracts.map((item) => item.id);

  const batches = await prisma.batch.findMany({
    where: { contractId: { in: contractIdList } },
    orderBy: [{ createdAt: "desc" }],
    select: batchSelect
  });

  const batchIdList = uniqueIds(batches.map((item) => item.id));

  const [purchaseOrders, shipments, salesOrders, payments, receivables, costItems, exchangeRates] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { contractId: { in: contractIdList } },
      orderBy: [{ createdAt: "desc" }],
      select: purchaseOrderSelect
    }),
    prisma.shipment.findMany({
      where: { contractId: { in: contractIdList } },
      orderBy: [{ createdAt: "desc" }],
      select: shipmentSelect
    }),
    prisma.salesOrder.findMany({
      where: { contractId: { in: contractIdList } },
      orderBy: [{ createdAt: "desc" }],
      select: salesOrderSelect
    }),
    prisma.payment.findMany({
      where: { contractId: { in: contractIdList } },
      orderBy: [{ createdAt: "desc" }],
      select: paymentSelect
    }),
    prisma.receivable.findMany({
      where: { contractId: { in: contractIdList } },
      orderBy: [{ createdAt: "desc" }],
      select: receivableSelect
    }),
    prisma.costItem.findMany({
      where: {
        OR: [{ contractId: { in: contractIdList } }, { batchId: { in: batchIdList } }]
      },
      orderBy: [{ createdAt: "asc" }],
      select: costItemSelect
    }),
    prisma.exchangeRate.findMany({
      where: { toCurrency: BASE_CURRENCY },
      orderBy: [{ rateDate: "desc" }]
    })
  ]);

  const rateLookup = buildRateLookup(
    exchangeRates.map((item) => ({
      fromCurrency: item.fromCurrency,
      rate: item.rate
    }))
  );

  const latestBatchByContractId = new Map<string, BatchRecord>();
  for (const batch of batches) {
    if (!latestBatchByContractId.has(batch.contractId)) {
      latestBatchByContractId.set(batch.contractId, batch);
    }
  }

  const latestPurchaseOrderByContractId = new Map<string, PurchaseOrderRecord>();
  for (const record of purchaseOrders) {
    if (record.contractId && !latestPurchaseOrderByContractId.has(record.contractId)) {
      latestPurchaseOrderByContractId.set(record.contractId, record);
    }
  }

  const latestShipmentByContractId = new Map<string, ShipmentRecord>();
  for (const record of shipments) {
    if (record.contractId && !latestShipmentByContractId.has(record.contractId)) {
      latestShipmentByContractId.set(record.contractId, record);
    }
  }

  const latestSalesOrderByContractId = new Map<string, SalesOrderRecord>();
  for (const record of salesOrders) {
    if (record.contractId && !latestSalesOrderByContractId.has(record.contractId)) {
      latestSalesOrderByContractId.set(record.contractId, record);
    }
  }

  const latestPaymentByContractId = new Map<string, PaymentRecord>();
  for (const record of payments) {
    if (!latestPaymentByContractId.has(record.contractId)) {
      latestPaymentByContractId.set(record.contractId, record);
    }
  }

  const latestReceivableByContractId = new Map<string, ReceivableRecord>();
  for (const record of receivables) {
    if (record.contractId && !latestReceivableByContractId.has(record.contractId)) {
      latestReceivableByContractId.set(record.contractId, record);
    }
  }

  const views = contracts.map((contract) => {
    const batch = latestBatchByContractId.get(contract.id) ?? null;
    const purchaseOrder = latestPurchaseOrderByContractId.get(contract.id) ?? null;
    const shipment = latestShipmentByContractId.get(contract.id) ?? null;
    const salesOrder = latestSalesOrderByContractId.get(contract.id) ?? null;
    const payment = latestPaymentByContractId.get(contract.id) ?? null;
    const receivable = latestReceivableByContractId.get(contract.id) ?? null;
    const relatedCostItems = costItems.filter(
      (item) => item.contractId === contract.id || (batch ? item.batchId === batch.id : false)
    );

    const salesAmount = salesOrder?.amount ?? contract.amount;
    const salesCurrency = salesOrder?.currency ?? contract.currency;
    const salesRateToCny = getRateToCny(salesCurrency, rateLookup);
    const salesAmountBaseCny = roundMoney(salesAmount * salesRateToCny);
    const isDemoData = relatedCostItems.length === 0;
    const costBreakdown = isDemoData
      ? buildDemoCostLines(salesAmount, salesCurrency, rateLookup)
      : buildManualCostLines(relatedCostItems, rateLookup);

    const totalCostBaseCny = roundMoney(
      costBreakdown.reduce((sum, item) => {
        return sum + item.baseCurrencyAmount;
      }, 0)
    );
    const totalCostInSalesCurrency = roundMoney(totalCostBaseCny / salesRateToCny);
    const grossProfitBaseCny = roundMoney(salesAmountBaseCny - totalCostBaseCny);
    const grossProfitInSalesCurrency = roundMoney(grossProfitBaseCny / salesRateToCny);
    const grossMargin = salesAmountBaseCny > 0 ? roundPercent((grossProfitBaseCny / salesAmountBaseCny) * 100) : 0;
    const statusMeta = resolveStatusMeta(isDemoData, relatedCostItems.length);

    const exchangeRates = Array.from(
      new Set([salesCurrency, ...costBreakdown.map((item) => item.currency), BASE_CURRENCY])
    ).map((currency) => ({
      currency,
      rateToCny: roundMoney(getRateToCny(currency, rateLookup)),
      source: Object.prototype.hasOwnProperty.call(fallbackRateToCny, currency) ? "fallback" : "manual"
    }));

    return {
      id: contract.id,
      isDemoData,
      statusMeta,
      contract: {
        ...contract,
        createdAt: contract.createdAt.toISOString(),
        updatedAt: contract.updatedAt.toISOString()
      },
      batch: batch
        ? {
            ...batch,
            createdAt: batch.createdAt.toISOString(),
            updatedAt: batch.updatedAt.toISOString()
          }
        : null,
      purchaseOrder: purchaseOrder
        ? {
            ...purchaseOrder,
            createdAt: purchaseOrder.createdAt.toISOString(),
            updatedAt: purchaseOrder.updatedAt.toISOString()
          }
        : null,
      shipment: shipment
        ? {
            ...shipment,
            createdAt: shipment.createdAt.toISOString(),
            updatedAt: shipment.updatedAt.toISOString()
          }
        : null,
      salesOrder: salesOrder
        ? {
            ...salesOrder,
            createdAt: salesOrder.createdAt.toISOString(),
            updatedAt: salesOrder.updatedAt.toISOString()
          }
        : null,
      payment: payment
        ? {
            ...payment,
            dueDate: payment.dueDate?.toISOString() ?? null,
            paidAt: payment.paidAt?.toISOString() ?? null,
            receivedAt: payment.receivedAt?.toISOString() ?? null,
            createdAt: payment.createdAt.toISOString(),
            updatedAt: payment.updatedAt.toISOString()
          }
        : null,
      receivable: receivable
        ? {
            ...receivable,
            dueDate: receivable.dueDate?.toISOString() ?? null,
            createdAt: receivable.createdAt.toISOString(),
            updatedAt: receivable.updatedAt.toISOString()
          }
        : null,
      totals: {
        salesAmount: roundMoney(salesAmount),
        salesCurrency,
        salesAmountBaseCny,
        totalCostBaseCny,
        totalCostInSalesCurrency,
        grossProfitBaseCny,
        grossProfitInSalesCurrency,
        grossMargin
      },
      costBreakdown,
      exchangeRates,
      moduleNarrative: {
        role: "用于把采购、物流、清关、仓储、配送等费用按合同 / 批次汇总为经营测算口径，帮助演示系统具备利润管理视角。",
        boundary: "当前页面允许使用 Demo 模板和演示汇率；正式版应按真实费用单据、实际汇率、会计规则与成本分摊逻辑核算。"
      },
      history: buildHistory(
        contract,
        batch,
        purchaseOrder,
        shipment,
        salesOrder,
        receivable,
        isDemoData,
        costBreakdown.length
      )
    };
  });

  return { contracts, views };
}

costsRouter.get("/contracts", async (_request, response) => {
  const { views } = await loadCostingContext();

  const summary = {
    totalContracts: views.length,
    demoContracts: views.filter((item) => item.isDemoData).length,
    manualContracts: views.filter((item) => !item.isDemoData).length,
    totalSalesBaseCny: roundMoney(views.reduce((sum, item) => sum + item.totals.salesAmountBaseCny, 0)),
    totalCostBaseCny: roundMoney(views.reduce((sum, item) => sum + item.totals.totalCostBaseCny, 0)),
    totalGrossProfitBaseCny: roundMoney(views.reduce((sum, item) => sum + item.totals.grossProfitBaseCny, 0)),
    averageGrossMargin: views.length > 0 ? roundPercent(views.reduce((sum, item) => sum + item.totals.grossMargin, 0) / views.length) : 0
  };

  response.json({
    summary,
    records: views.map((item) => ({
      id: item.id,
      isDemoData: item.isDemoData,
      statusMeta: item.statusMeta,
      contract: item.contract,
      batch: item.batch,
      salesOrder: item.salesOrder,
      receivable: item.receivable,
      totals: item.totals,
      costPreview: item.costBreakdown.slice(0, 3)
    }))
  });
});

costsRouter.get("/contracts/:id", async (request, response) => {
  const { views } = await loadCostingContext([request.params.id]);
  const detail = views[0];

  if (!detail) {
    response.status(404).json({ message: "Costing record not found." });
    return;
  }

  response.json(detail);
});
