import {
  BarChartOutlined,
  CarOutlined,
  DollarCircleOutlined,
  GlobalOutlined,
  InboxOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  ShoppingCartOutlined
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Descriptions, Empty, List, Row, Skeleton, Space, Tag, Typography, message } from "antd";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type SourceLabel = "真实统计" | "业务记录" | "Demo演示";
type Tone = "success" | "processing" | "warning" | "default" | "error";

type DashboardOverviewResponse = {
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
  orderPools: Array<{
    key: string;
    label: string;
    count: number;
    description: string;
  }>;
  availableContracts: Array<{
    contractId: string;
    contractNo: string;
    customerName: string;
    totalQuantity: number;
    unit: string;
    batchCount: number;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    outboundQuantity: number;
    unpaidAmount: number;
    mainFlowStatusText: string;
    mainFlowTone: Tone;
    afterSalesStatusText: string;
    afterSalesTone: Tone;
    exceptionStatusText: string;
    exceptionTone: Tone;
    archiveStatusText: string;
    archiveTone: Tone;
    dashboardGroupKey: string;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    owner: string;
    reference: string;
    statusText: string;
    tone: Tone;
    description: string;
    routePath: string;
  }>;
  recentActivities: Array<{
    id: string;
    kind: string;
    title: string;
    occurredAt: string;
    tone: Tone;
    description: string;
    routePath: string;
  }>;
};

type InventorySummaryResponse = {
  generatedAt: string;
  summary: {
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
    damagedQuantity: number;
    lostQuantity: number;
    abnormalQuantity: number;
    totalInboundMovements: number;
    totalOutboundMovements: number;
    statusAccountedQuantity: number;
    isConsistent: boolean;
  };
  byBatch: Array<{
    batchId: string;
    batchNo: string;
    contractNo: string;
    productName: string;
    batchQuantity: number;
    unit: string;
    warehouseName: string;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
  }>;
  byWarehouse: Array<{
    warehouseId: string | null;
    warehouseName: string;
    contractCount: number;
    batchCount: number;
    totalQrItems: number;
    inTransitInventory: number;
    realtimeInventory: number;
    availableInventory: number;
    frozenInventory: number;
    outboundQuantity: number;
  }>;
  recentMovements: Array<{
    id: string;
    movementType: string;
    warehouseName: string | null;
    operatorName: string | null;
    occurredAt: string;
    qrCode: string;
    productName: string | null;
    batchNo: string;
    contractNo: string;
    fromStatus: string | null;
    toStatus: string | null;
  }>;
};

type ProcurementOrdersResponse = {
  summary: {
    totalOrders: number;
    draftOrders: number;
    supplierShippedOrders: number;
    collectionCompletedOrders: number;
    linkedShipments: number;
  };
  orders: Array<{
    id: string;
    purchaseNo: string;
    supplierName: string;
    skuName: string;
    quantity: number;
    unit: string;
    statusMeta: {
      label: string;
      color: Tone;
    };
    contract: {
      contractNo: string;
    } | null;
    batch: {
      batchNo: string;
    } | null;
  }>;
};

type LogisticsShipmentsResponse = {
  summary: {
    totalShipments: number;
    readyToDepartShipments: number;
    inTransitShipments: number;
    pendingCustomsShipments: number;
    linkedCustomsClearances: number;
  };
  shipments: Array<{
    id: string;
    shipmentNo: string;
    shippingCompany: string | null;
    destinationPort: string | null;
    statusMeta: {
      label: string;
      color: Tone;
    };
    contract: {
      contractNo: string;
    } | null;
    batch: {
      batchNo: string;
    } | null;
  }>;
};

type SalesOrdersResponse = {
  summary: {
    totalOrders: number;
    readyOrders: number;
    inTransitOrders: number;
    deliveredOrders: number;
    pendingReceivables: number;
  };
  orders: Array<{
    id: string;
    salesNo: string;
    customerName: string;
    quantity: number;
    unit: string;
    amount: number;
    currency: string;
    statusMeta: {
      label: string;
      color: Tone;
    };
    batch: {
      batchNo: string;
    } | null;
  }>;
};

type FinanceReceivablesResponse = {
  summary: {
    totalReceivables: number;
    pendingCount: number;
    partialCount: number;
    paidCount: number;
    overdueCount: number;
    linkedWorkOrders: number;
    openAmount: number;
    receivedAmount: number;
    currency: string;
  };
  receivables: Array<{
    id: string;
    amount: number;
    currency: string;
    openAmount: number;
    receivedAmount: number;
    scopeLabel: string;
    statusMeta: {
      label: string;
      color: Tone;
    };
    contract: {
      contractNo: string;
      customerName: string;
    } | null;
    salesOrder: {
      salesNo: string;
    } | null;
  }>;
};

type CostsResponse = {
  summary: {
    totalContracts: number;
    demoContracts: number;
    manualContracts: number;
    totalSalesBaseCny: number;
    totalCostBaseCny: number;
    totalGrossProfitBaseCny: number;
    averageGrossMargin: number;
  };
  records: Array<{
    id: string;
    isDemoData: boolean;
    statusMeta: {
      label: string;
      color: Tone;
    };
    contract: {
      contractNo: string;
      customerName: string;
      totalQuantity: number;
      unit: string;
    };
    totals: {
      salesAmount: number;
      salesCurrency: string;
      totalCostInSalesCurrency: number;
      grossProfitInSalesCurrency: number;
      grossMargin: number;
    };
  }>;
};

type ReportCardModel = {
  key: string;
  title: string;
  icon: ReactNode;
  source: SourceLabel;
  value: string;
  secondary: string;
  description: string;
  routePath: string;
};

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  if (typeof quantity !== "number") {
    return "-";
  }

  return `${quantity.toLocaleString("zh-CN")}${unit ?? ""}`;
}

function formatPercent(value?: number | null) {
  if (typeof value !== "number") {
    return "-";
  }

  return `${value.toFixed(2)}%`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function toneToTagColor(tone?: Tone) {
  switch (tone) {
    case "success":
      return "success";
    case "processing":
      return "processing";
    case "warning":
      return "warning";
    case "error":
      return "error";
    default:
      return "default";
  }
}

function sourceToTagColor(source: SourceLabel) {
  switch (source) {
    case "真实统计":
      return "success";
    case "业务记录":
      return "processing";
    case "Demo演示":
    default:
      return "warning";
  }
}

function sumQuantity<T extends { quantity: number }>(records: T[]) {
  return records.reduce((sum, item) => sum + item.quantity, 0);
}

export function ReportsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);
  const [inventory, setInventory] = useState<InventorySummaryResponse | null>(null);
  const [procurement, setProcurement] = useState<ProcurementOrdersResponse | null>(null);
  const [logistics, setLogistics] = useState<LogisticsShipmentsResponse | null>(null);
  const [sales, setSales] = useState<SalesOrdersResponse | null>(null);
  const [finance, setFinance] = useState<FinanceReceivablesResponse | null>(null);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadReports() {
    setIsLoading(true);

    const results = await Promise.allSettled([
      requestJson<DashboardOverviewResponse>("/api/dashboard/overview"),
      requestJson<InventorySummaryResponse>("/api/inventory/summary"),
      requestJson<ProcurementOrdersResponse>("/api/procurement/orders"),
      requestJson<LogisticsShipmentsResponse>("/api/logistics/shipments"),
      requestJson<SalesOrdersResponse>("/api/sales/orders"),
      requestJson<FinanceReceivablesResponse>("/api/finance/receivables"),
      requestJson<CostsResponse>("/api/costs/contracts")
    ]);

    const nextErrors: string[] = [];

    if (results[0].status === "fulfilled") {
      setOverview(results[0].value);
    } else {
      nextErrors.push(results[0].reason instanceof Error ? results[0].reason.message : "加载驾驶舱总览失败。");
      setOverview(null);
    }

    if (results[1].status === "fulfilled") {
      setInventory(results[1].value);
    } else {
      nextErrors.push(results[1].reason instanceof Error ? results[1].reason.message : "加载库存统计失败。");
      setInventory(null);
    }

    if (results[2].status === "fulfilled") {
      setProcurement(results[2].value);
    } else {
      nextErrors.push(results[2].reason instanceof Error ? results[2].reason.message : "加载采购数据失败。");
      setProcurement(null);
    }

    if (results[3].status === "fulfilled") {
      setLogistics(results[3].value);
    } else {
      nextErrors.push(results[3].reason instanceof Error ? results[3].reason.message : "加载国际物流数据失败。");
      setLogistics(null);
    }

    if (results[4].status === "fulfilled") {
      setSales(results[4].value);
    } else {
      nextErrors.push(results[4].reason instanceof Error ? results[4].reason.message : "加载销售数据失败。");
      setSales(null);
    }

    if (results[5].status === "fulfilled") {
      setFinance(results[5].value);
    } else {
      nextErrors.push(results[5].reason instanceof Error ? results[5].reason.message : "加载财务数据失败。");
      setFinance(null);
    }

    if (results[6].status === "fulfilled") {
      setCosts(results[6].value);
    } else {
      nextErrors.push(results[6].reason instanceof Error ? results[6].reason.message : "加载成本利润数据失败。");
      setCosts(null);
    }

    setLoadErrors(nextErrors);
    setIsLoading(false);

    if (nextErrors.length > 0) {
      message.warning("部分报表数据加载失败，页面已按当前可用数据继续展示。");
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const scenario = overview?.scenario ?? null;
  const inventorySummary = inventory?.summary ?? null;
  const procurementQuantity = procurement ? sumQuantity(procurement.orders) : 0;
  const salesQuantity = sales ? sumQuantity(sales.orders) : 0;
  const costsRecord = costs?.records[0] ?? null;
  const hasBusinessRecords =
    Boolean(overview?.counts.businessDocuments) ||
    Boolean(overview?.counts.contracts) ||
    Boolean(procurement?.summary.totalOrders) ||
    Boolean(logistics?.summary.totalShipments) ||
    Boolean(sales?.summary.totalOrders) ||
    Boolean(finance?.summary.totalReceivables) ||
    Boolean(costs?.summary.totalContracts) ||
    Boolean(inventorySummary?.totalQrItems) ||
    Boolean(inventorySummary?.totalInboundMovements) ||
    Boolean(inventorySummary?.totalOutboundMovements);

  const reportCards: ReportCardModel[] = scenario
    ? [
        {
          key: "procurement",
          title: "采购报表",
          icon: <ShoppingCartOutlined />,
          source: procurement && procurement.summary.totalOrders > 0 ? "业务记录" : "Demo演示",
          value:
            procurement && procurement.summary.totalOrders > 0
              ? formatQuantity(procurementQuantity, procurement.orders[0]?.unit ?? scenario.unit)
              : formatQuantity(scenario.totalQuantity, scenario.unit),
          secondary:
            procurement && procurement.summary.totalOrders > 0
              ? `采购单 ${procurement.summary.totalOrders} 笔，已集货 ${procurement.summary.collectionCompletedOrders} 笔`
              : `当前仅展示默认演示计划：${scenario.supplierName} -> ${scenario.destinationWarehouse}`,
          description: "采购模块有正式采购单时按业务记录统计，否则回落到演示主线中的采购计划数量。",
          routePath: "/procurement"
        },
        {
          key: "transit",
          title: "在途报表",
          icon: <GlobalOutlined />,
          source: "真实统计",
          value: formatQuantity(inventorySummary?.inTransitInventory ?? 0, scenario.unit),
          secondary:
            logistics && logistics.summary.totalShipments > 0
              ? `运输单 ${logistics.summary.totalShipments} 笔，待清关 ${logistics.summary.pendingCustomsShipments} 笔`
              : "当前系统内暂无正式国际物流记录，真实在途数量仍按二维码状态统计。",
          description: "在途数量必须来自真实二维码状态，不能按合同数量或运输计划直接假设。",
          routePath: "/logistics"
        },
        {
          key: "inventory",
          title: "库存报表",
          icon: <InboxOutlined />,
          source: "真实统计",
          value: formatQuantity(inventorySummary?.realtimeInventory ?? 0, scenario.unit),
          secondary: `可用 ${(inventorySummary?.availableInventory ?? 0).toLocaleString("zh-CN")} / 冻结 ${(inventorySummary?.frozenInventory ?? 0).toLocaleString("zh-CN")} / 异常 ${(inventorySummary?.abnormalQuantity ?? 0).toLocaleString("zh-CN")}`,
          description: "实时库存只认已经完成扫码入库的二维码，不会把合同数量直接算成库存。",
          routePath: "/warehouse"
        },
        {
          key: "sales",
          title: "销售报表",
          icon: <CarOutlined />,
          source: "真实统计",
          value: formatQuantity(inventorySummary?.outboundQuantity ?? 0, scenario.unit),
          secondary:
            sales && sales.summary.totalOrders > 0
              ? `销售单 ${sales.summary.totalOrders} 笔，业务数量 ${formatQuantity(salesQuantity, sales.orders[0]?.unit ?? scenario.unit)}`
              : `当前实际已出库 0，演示计划出库 ${formatQuantity(scenario.plannedOutboundQuantity, scenario.unit)}`,
          description: "这里优先展示真实已出库数量，避免把“销售计划”误当成已经完成的出库数量。",
          routePath: "/sales"
        },
        {
          key: "finance",
          title: "回款报表",
          icon: <DollarCircleOutlined />,
          source: finance && finance.summary.totalReceivables > 0 ? "业务记录" : "Demo演示",
          value:
            finance && finance.summary.totalReceivables > 0
              ? formatAmount(finance.summary.openAmount, finance.summary.currency)
              : formatAmount(scenario.amount, scenario.currency),
          secondary:
            finance && finance.summary.totalReceivables > 0
              ? `应收 ${finance.summary.totalReceivables} 笔，已收 ${formatAmount(finance.summary.receivedAmount, finance.summary.currency)}`
              : "当前系统内暂无正式应收记录，先按演示场景展示待回款金额。",
          description: "没有正式应收记录时，这里只展示 Demo 金额口径，不代表真实财务已入账。",
          routePath: "/finance"
        },
        {
          key: "costs",
          title: "成本报表",
          icon: <BarChartOutlined />,
          source: costs && costs.summary.totalContracts > 0 ? "业务记录" : "Demo演示",
          value:
            costsRecord && (costs?.summary.totalContracts ?? 0) > 0
              ? formatAmount(costsRecord.totals.totalCostInSalesCurrency, costsRecord.totals.salesCurrency)
              : "38,000 USD",
          secondary:
            costsRecord && (costs?.summary.totalContracts ?? 0) > 0
              ? `已纳入成本合同 ${costs?.summary.totalContracts ?? 0} 份，人民币总成本 ${formatAmount(costs?.summary.totalCostBaseCny ?? 0, "CNY")}`
              : "当前使用设计稿中的演示成本模板，正式版将按费用单据和汇率核算。",
          description: "成本报表在第一版允许使用演示数据，但一旦存在正式成本记录就优先显示业务记录。",
          routePath: "/costs"
        },
        {
          key: "profit",
          title: "利润报表",
          icon: <BarChartOutlined />,
          source: costs && costs.summary.totalContracts > 0 ? "业务记录" : "Demo演示",
          value:
            costsRecord && (costs?.summary.totalContracts ?? 0) > 0
              ? formatAmount(costsRecord.totals.grossProfitInSalesCurrency, costsRecord.totals.salesCurrency)
              : "12,000 USD",
          secondary:
            costsRecord && (costs?.summary.totalContracts ?? 0) > 0
              ? `平均毛利率 ${formatPercent(costs?.summary.averageGrossMargin ?? 0)}`
              : "默认演示毛利率 24%，用于向甲方展示经营视角，不代表真实财务结算结果。",
          description: "利润口径与成本模块同步，当前先支持经营演示，后续再深化到真实核算。",
          routePath: "/costs"
        },
        {
          key: "qr",
          title: "二维码追溯",
          icon: <QrcodeOutlined />,
          source: "真实统计",
          value: `${(inventorySummary?.totalQrItems ?? 0).toLocaleString("zh-CN")} 个码`,
          secondary: `已出库 ${(inventorySummary?.outboundQuantity ?? 0).toLocaleString("zh-CN")} / 在库 ${(inventorySummary?.realtimeInventory ?? 0).toLocaleString("zh-CN")} / 在途 ${(inventorySummary?.inTransitInventory ?? 0).toLocaleString("zh-CN")}`,
          description: "二维码卡片始终展示系统内全局累计数量，进入追溯页后再按最新批次或指定批次看明细。",
          routePath: "/qr-items"
        }
      ]
    : [];

  return (
    <div className="document-workspace reports-workspace">
      <section className="page-hero reports-hero">
        <div className="reports-hero-main">
          <Typography.Title level={2}>数据报表与业务大盘</Typography.Title>
          <Typography.Paragraph>
            这一页把采购、在途、库存、销售、回款、成本、利润和二维码追溯放到同一个经营视角里，同时明确区分哪些数来自真实扫码和库存流水，哪些数只是第一版 Demo 的演示计划。
          </Typography.Paragraph>
          <Space wrap>
            <Tag color="success">库存 / 二维码 = 真实统计</Tag>
            <Tag color="processing">采购 / 回款 / 成本 = 优先业务记录</Tag>
            <Tag color="warning">业务为空时回落到 Demo 演示口径</Tag>
          </Space>
        </div>
        <div className="reports-hero-side">
          <Card className="placeholder-card reports-summary-card" bordered={false}>
            {scenario ? (
              <div className="reports-summary-grid">
                <div>
                  <span className="app-header-panel-label">演示场景</span>
                  <strong>{scenario.scenarioName}</strong>
                </div>
                <div>
                  <span className="app-header-panel-label">数据更新时间</span>
                  <strong>{formatDateTime(overview?.generatedAt ?? inventory?.generatedAt ?? null)}</strong>
                </div>
                <div>
                  <span className="app-header-panel-label">当前 AI</span>
                  <strong>
                    {overview?.assistant.provider ?? "template"}
                    {overview?.assistant.model ? ` / ${overview.assistant.model}` : ""}
                  </strong>
                </div>
                <div>
                  <span className="app-header-panel-label">正式业务数据</span>
                  <strong>{hasBusinessRecords ? "已有数据" : "空白演示起点"}</strong>
                </div>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无报表总览信息" />
            )}
          </Card>
        </div>
      </section>

      {loadErrors.length > 0 ? (
        <Alert
          showIcon
          type="warning"
          message="部分报表接口加载失败"
          description={
            <div className="reports-alert-list">
              {loadErrors.map((item) => (
                <div key={item}>{item}</div>
              ))}
            </div>
          }
        />
      ) : null}

      <Alert
        showIcon
        type={hasBusinessRecords ? "success" : "info"}
        message={hasBusinessRecords ? "当前报表已接入正式业务数据" : "当前处于空白演示起点"}
        description={
          hasBusinessRecords
            ? "库存、二维码、出入库等真实统计会直接反映当前数据库状态；没有完成业务建单的模块，仍会保留 Demo 演示口径。"
            : "你现在看到的库存、二维码、出入库都是真实的 0；采购、回款、成本、利润等经营卡片则暂时使用默认演示场景，方便先展示完整 ERP 形态。"
        }
        action={
          <Space wrap>
            <Button type="primary" onClick={() => navigate("/documents")}>
              去合同与单据
            </Button>
            <Button onClick={() => navigate("/dashboard")}>回首页驾驶舱</Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadReports()}>
              刷新报表
            </Button>
          </Space>
        }
      />

      <div className="reports-card-grid">
        {isLoading
          ? Array.from({ length: 8 }, (_, index) => (
              <Card key={`skeleton-${index}`} className="placeholder-card reports-metric-card" bordered={false}>
                <Skeleton active paragraph={{ rows: 4 }} />
              </Card>
            ))
          : reportCards.map((card) => (
              <Card key={card.key} className="placeholder-card reports-metric-card" bordered={false}>
                <div className="reports-card-head">
                  <div className="reports-card-icon">{card.icon}</div>
                  <div className="reports-card-title-group">
                    <Space wrap>
                      <Typography.Text strong>{card.title}</Typography.Text>
                      <Tag color={sourceToTagColor(card.source)}>{card.source}</Tag>
                    </Space>
                    <Typography.Text type="secondary">{card.description}</Typography.Text>
                  </div>
                </div>
                <div className="reports-card-value">{card.value}</div>
                <div className="reports-card-secondary">{card.secondary}</div>
                <Button type="link" onClick={() => navigate(card.routePath)}>
                  查看对应模块
                </Button>
              </Card>
            ))}
      </div>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={14}>
          <Card className="placeholder-card" title="演示主线与正式业务口径" bordered={false}>
            {scenario ? (
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="商品名称">{scenario.productName}</Descriptions.Item>
                <Descriptions.Item label="演示客户">{scenario.customerName}</Descriptions.Item>
                <Descriptions.Item label="供应商">{scenario.supplierName}</Descriptions.Item>
                <Descriptions.Item label="目的仓库">{scenario.destinationWarehouse}</Descriptions.Item>
                <Descriptions.Item label="合同计划数量">
                  {formatQuantity(scenario.totalQuantity, scenario.unit)}
                </Descriptions.Item>
                <Descriptions.Item label="计划出库数量">
                  {formatQuantity(scenario.plannedOutboundQuantity, scenario.unit)}
                </Descriptions.Item>
                <Descriptions.Item label="合同金额">{formatAmount(scenario.amount, scenario.currency)}</Descriptions.Item>
                <Descriptions.Item label="起运地">{scenario.origin}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无演示主线信息" />
            )}

            <div className="reports-note-list">
              <div>合同数量代表业务计划，不自动等于真实库存。</div>
              <div>库存剩余必须由二维码状态和库存流水共同计算。</div>
              <div>没有正式业务记录时，经营类卡片会明确标注为 Demo 演示口径。</div>
            </div>
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="placeholder-card" title="二维码与库存一致性" bordered={false}>
            {inventorySummary ? (
              <div className="reports-summary-grid reports-summary-grid--compact">
                <div>
                  <span className="app-header-panel-label">全局二维码</span>
                  <strong>{inventorySummary.totalQrItems.toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span className="app-header-panel-label">库存状态合计</span>
                  <strong>{inventorySummary.statusAccountedQuantity.toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span className="app-header-panel-label">入库流水</span>
                  <strong>{inventorySummary.totalInboundMovements.toLocaleString("zh-CN")}</strong>
                </div>
                <div>
                  <span className="app-header-panel-label">出库流水</span>
                  <strong>{inventorySummary.totalOutboundMovements.toLocaleString("zh-CN")}</strong>
                </div>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无库存统计" />
            )}

            <Alert
              showIcon
              type={inventorySummary?.isConsistent ? "success" : "warning"}
              message={inventorySummary?.isConsistent ? "二维码状态与库存统计一致" : "二维码状态与库存统计存在差异"}
              description={
                inventorySummary?.isConsistent
                  ? "当前全局二维码数量与各状态统计口径一致，适合作为驾驶舱和报表页的真实库存来源。"
                  : "需要检查二维码状态、库存流水或异常货物状态，避免报表对外展示出现误导。"
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={12}>
          <Card className="placeholder-card" title="最近业务推进与工单" bordered={false}>
            {overview?.recentTasks.length ? (
              <List
                dataSource={overview.recentTasks}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key={item.id} type="link" onClick={() => navigate(item.routePath)}>
                        查看
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag color={toneToTagColor(item.tone)}>{item.statusText}</Tag>
                        </Space>
                      }
                      description={
                        <div className="reports-list-meta">
                          <div>责任人：{item.owner}</div>
                          <div>关联：{item.reference}</div>
                          <div>{item.description}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前还没有自动工单或最近任务。完成正式业务建单后，这里会逐步出现采购、物流、清关、仓储、财务等工单。"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card className="placeholder-card" title="最近活动与真实库存流水" bordered={false}>
            {inventory?.recentMovements.length ? (
              <List
                dataSource={inventory.recentMovements}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Typography.Text strong>{item.qrCode}</Typography.Text>
                          <Tag color="processing">{item.movementType}</Tag>
                        </Space>
                      }
                      description={
                        <div className="reports-list-meta">
                          <div>
                            合同 {item.contractNo} / 批次 {item.batchNo}
                          </div>
                          <div>
                            {item.fromStatus ?? "-"} {"->"} {item.toStatus ?? "-"} / 仓库 {item.warehouseName ?? "-"}
                          </div>
                          <div>
                            操作人 {item.operatorName ?? "-"} / {formatDateTime(item.occurredAt)}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : overview?.recentActivities.length ? (
              <List
                dataSource={overview.recentActivities}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key={item.id} type="link" onClick={() => navigate(item.routePath)}>
                        查看
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Tag color={toneToTagColor(item.tone)}>{item.kind}</Tag>
                        </Space>
                      }
                      description={
                        <div className="reports-list-meta">
                          <div>{item.description}</div>
                          <div>{formatDateTime(item.occurredAt)}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前还没有库存流水和最近活动。等你从合同与单据开始推进流程后，这里会展示真实的系统变化轨迹。"
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="stretch">
        <Col xs={24} xl={12}>
          <Card className="placeholder-card" title="批次与库存分布" bordered={false}>
            {inventory?.byBatch.length ? (
              <List
                dataSource={inventory.byBatch.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key={item.batchId} type="link" onClick={() => navigate("/qr-items")}>
                        查看二维码
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Typography.Text strong>{item.batchNo}</Typography.Text>
                          <Tag color="processing">{item.contractNo}</Tag>
                        </Space>
                      }
                      description={
                        <div className="reports-list-meta">
                          <div>
                            {item.productName} / 批次数量 {formatQuantity(item.batchQuantity, item.unit)}
                          </div>
                          <div>
                            在途 {item.inTransitInventory} / 在库 {item.realtimeInventory} / 已出库 {item.outboundQuantity}
                          </div>
                          <div>仓库：{item.warehouseName}</div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前还没有正式批次二维码数据。生成二维码后，这里会按批次自动统计库存分布。"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={12}>
          <Card className="placeholder-card" title="合同订单与经营分组" bordered={false}>
            {overview?.availableContracts.length ? (
              <List
                dataSource={overview.availableContracts.slice(0, 6)}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key={item.contractId} type="link" onClick={() => navigate("/dashboard")}>
                        去驾驶舱
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space wrap>
                          <Typography.Text strong>{item.contractNo}</Typography.Text>
                          <Tag color={toneToTagColor(item.mainFlowTone)}>{item.mainFlowStatusText}</Tag>
                          <Tag color={toneToTagColor(item.archiveTone)}>{item.archiveStatusText}</Tag>
                        </Space>
                      }
                      description={
                        <div className="reports-list-meta">
                          <div>
                            客户 {item.customerName} / 合同数量 {formatQuantity(item.totalQuantity, item.unit)}
                          </div>
                          <div>
                            批次 {item.batchCount} / 二维码 {item.totalQrItems} / 在库 {item.realtimeInventory} / 已出库{" "}
                            {item.outboundQuantity}
                          </div>
                          <div>
                            售后 {item.afterSalesStatusText} / 异常 {item.exceptionStatusText} / 未回款{" "}
                            {item.unpaidAmount.toLocaleString("zh-CN")}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div className="reports-empty-stack">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="当前还没有正式合同订单，首页驾驶舱也因此没有可切换的业务对象。"
                />
                <div className="reports-order-pools">
                  {overview?.orderPools.map((pool) => (
                    <div key={pool.key} className="reports-order-pool">
                      <strong>{pool.label}</strong>
                      <span>{pool.count} 单</span>
                      <Typography.Text type="secondary">{pool.description}</Typography.Text>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
