import {
  ApiOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  RobotOutlined
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Timeline,
  Typography,
  message
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { requestJson } from "../lib/api";

type DashboardTone = "success" | "processing" | "warning" | "default" | "error";
type DashboardOrderView = "active" | "completed" | "after_sales" | "exception" | "archived" | "all";

type DemoScenarioSummary = {
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
  expectedRemainingQuantity?: number;
  storyline?: string;
  updatedAt?: string;
  status?: string;
};

type SetupStatusResponse = {
  database: {
    counts: {
      documents: number;
      contracts: number;
      batches: number;
      qrItems: number;
      stockMovements: number;
      workOrders: number;
    };
  };
  resetCapability: {
    enabled: boolean;
    action: string;
    scope: string;
    confirmationRequired?: boolean;
    confirmationPhrase?: string;
    highestPrivilegeRole?: string;
  };
  standardDemoScenario: DemoScenarioSummary;
  demoScenario: DemoScenarioSummary;
};

type ResetDemoResponse = {
  ok: boolean;
  message: string;
  fileWarnings: string[];
  preserved: {
    aiAssistantRuntimeConfig: boolean;
  };
  standardScenario: DemoScenarioSummary;
  activeScenario: DemoScenarioSummary | null;
  countsAfter: {
    documents: number;
    contracts: number;
    batches: number;
    qrItems: number;
    stockMovements: number;
    purchaseOrders: number;
    shipments: number;
    workOrders: number;
  };
};

const DEFAULT_RESET_CONFIRMATION_PHRASE = "我是最高权限用户";

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
  finance: {
    unpaidCount: number;
    unpaidAmount: number;
    currency: string;
  };
  orderView: DashboardOrderView;
  orderPools: Array<{
    key: DashboardOrderView;
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
    contractTotalQuantity: number;
    contractExecutingQuantity: number;
    contractPendingExecutionQuantity: number;
    focusBatchQuantity: number;
    focusBatchInTransitQuantity: number;
    focusBatchInStockQuantity: number;
    focusBatchOutboundQuantity: number;
    inboundScopeQuantity: number;
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
  inventory: {
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
  statusCards: Array<{
    key: string;
    title: string;
    statusText: string;
    tone: DashboardTone;
    metricLabel: string;
    metricValue: string;
    description: string;
    routePath: string;
  }>;
  recentTasks: Array<{
    id: string;
    title: string;
    owner: string;
    reference: string;
    statusText: string;
    tone: DashboardTone;
    description: string;
    routePath: string;
  }>;
  recentActivities: Array<{
    id: string;
    kind: string;
    title: string;
    occurredAt: string;
    tone: DashboardTone;
    description: string;
    routePath: string;
  }>;
};

const toneColorMap: Record<DashboardTone, string> = {
  success: "success",
  processing: "processing",
  warning: "warning",
  default: "default",
  error: "error"
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<DashboardOverviewResponse | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [highestPrivilegeConfirmed, setHighestPrivilegeConfirmed] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const focusContractId = searchParams.get("focusContractId");
  const orderView = (searchParams.get("orderView") as DashboardOrderView | null) ?? null;
  const resetConfirmationPhrase =
    setupStatus?.resetCapability.confirmationPhrase ?? DEFAULT_RESET_CONFIRMATION_PHRASE;
  const isResetConfirmationValid =
    highestPrivilegeConfirmed && resetConfirmationText.trim() === resetConfirmationPhrase;

  async function loadDashboardOverview(
    nextFocusContractId: string | null = focusContractId,
    nextOrderView: DashboardOrderView | null = orderView
  ) {
    setLoading(true);

    try {
      const query = new URLSearchParams();
      if (nextFocusContractId) {
        query.set("focusContractId", nextFocusContractId);
      }
      if (nextOrderView) {
        query.set("orderView", nextOrderView);
      }

      const nextData = await requestJson<DashboardOverviewResponse>(
        `/api/dashboard/overview${query.size > 0 ? `?${query.toString()}` : ""}`
      );
      setData(nextData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载首页驾驶舱失败。");
    } finally {
      setLoading(false);
    }
  }

  async function loadSetupStatus() {
    try {
      const nextStatus = await requestJson<SetupStatusResponse>("/api/setup/status");
      setSetupStatus(nextStatus);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载演示环境状态失败。");
    }
  }

  async function handleRefreshAll() {
    await Promise.all([loadDashboardOverview(), loadSetupStatus()]);
  }

  async function handleResetDemoEnvironment() {
    if (!isResetConfirmationValid) {
      message.warning(`请先勾选最高权限确认，并输入“${resetConfirmationPhrase}”。`);
      return;
    }

    setIsResetting(true);

    try {
      const result = await requestJson<ResetDemoResponse>("/api/setup/reset-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          highestPrivilegeConfirmed: true,
          confirmationText: resetConfirmationText.trim()
        })
      });

      setIsResetModalOpen(false);
      setHighestPrivilegeConfirmed(false);
      setResetConfirmationText("");
      setSearchParams(
        new URLSearchParams({
          orderView: "active"
        })
      );

      await Promise.all([loadDashboardOverview(null, "active"), loadSetupStatus()]);

      message.success(result.message);

      if (result.fileWarnings.length > 0) {
        message.warning(result.fileWarnings.join("；"));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重置演示环境失败。");
    } finally {
      setIsResetting(false);
    }
  }

  useEffect(() => {
    void loadDashboardOverview();
  }, [focusContractId, orderView]);

  useEffect(() => {
    void loadSetupStatus();
  }, []);

  const inventoryCards = data
    ? [
        { label: "在途库存", value: data.inventory.inTransitInventory, suffix: "箱" },
        { label: "实时库存", value: data.inventory.realtimeInventory, suffix: "箱" },
        { label: "可用库存", value: data.inventory.availableInventory, suffix: "箱" },
        { label: "已出库", value: data.inventory.outboundQuantity, suffix: "箱" },
        { label: "累计入库流水", value: data.inventory.totalInboundMovements, suffix: "次" },
        { label: "累计出库流水", value: data.inventory.totalOutboundMovements, suffix: "次" }
      ]
    : [];

  const selectedContractLabel = data?.focus.contractNo
    ? `${data.focus.contractNo}${data.focus.customerName ? ` | ${data.focus.customerName}` : ""}`
    : "待选择";
  const activeOrderPool = data?.orderPools.find((item) => item.key === data.orderView) ?? null;
  const hasFocusedOrder = Boolean(data?.focus.contractId);
  return (
    <div className="dashboard-workspace">
      <section className="page-hero dashboard-hero">
        <div className="dashboard-hero-main">
          <div className="placeholder-meta">
            <span className="placeholder-icon">
              <ApiOutlined />
            </span>
            <div>
              <Typography.Title level={2}>国际贸易 ERP 首页驾驶舱</Typography.Title>
              <Typography.Paragraph>
                首页现在已经切换为老板视角总览。真实库存和扫码执行数据来自当前二维码状态与库存流水，
                采购、回款、AI 助手和演示场景则在这里被串成一条完整的 ERP 演示主线。
              </Typography.Paragraph>
            </div>
          </div>

          <Space wrap className="placeholder-badges">
            <Tag color="blue">核心链路真实</Tag>
            <Tag color="gold">外围模块成熟展示</Tag>
            <Tag color="green">库存来自二维码状态</Tag>
            <Tag color="cyan">{activeOrderPool?.label ?? "进行中订单"}</Tag>
            <Tag color={data?.assistant.llmEnabled ? "success" : "default"}>
              {data?.assistant.llmEnabled ? "升级版 AI 已启用" : "本地模板 AI"}
            </Tag>
          </Space>
        </div>

        <div className="dashboard-hero-side">
          <Card className="dashboard-scenario-card" bordered={false}>
            {data ? (
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <div>
                  <Typography.Text type="secondary">当前演示场景</Typography.Text>
                  <Typography.Title level={4} style={{ marginTop: 6, marginBottom: 0 }}>
                    {data.scenario.scenarioName}
                  </Typography.Title>
                </div>

                <div className="dashboard-focus-picker">
                  <span className="app-header-panel-label">订单池视角</span>
                  <Select
                    className="dashboard-focus-select"
                    value={data.orderView}
                    onChange={(value) => {
                      const next = new URLSearchParams(searchParams);
                      next.set("orderView", value);
                      next.delete("focusContractId");
                      setSearchParams(next);
                    }}
                    options={data.orderPools.map((pool) => ({
                      value: pool.key,
                      label: `${pool.label} (${pool.count})`
                    }))}
                    placeholder="选择首页默认查看的订单池"
                  />
                </div>

                <div className="dashboard-focus-picker">
                  <span className="app-header-panel-label">主合同视角</span>
                  <Select
                    className="dashboard-focus-select"
                    value={data.focus.contractId ?? undefined}
                    onChange={(value) => {
                      const next = new URLSearchParams(searchParams);
                      if (value) {
                        next.set("focusContractId", value);
                      } else {
                        next.delete("focusContractId");
                      }
                      if (!next.get("orderView") && data.orderView) {
                        next.set("orderView", data.orderView);
                      }
                      setSearchParams(next);
                    }}
                    options={data.availableContracts.map((contract) => ({
                      value: contract.contractId,
                      label: `${contract.contractNo} | ${contract.customerName} | ${contract.mainFlowStatusText}`
                    }))}
                    placeholder="选择要重点展示的合同"
                  />
                </div>

                <div className="dashboard-mini-grid">
                  <div>
                    <span className="app-header-panel-label">商品</span>
                    <strong>{hasFocusedOrder ? data.focus.productName ?? data.scenario.productName : "当前池暂无订单"}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">目的仓库</span>
                    <strong>
                      {hasFocusedOrder ? data.focus.warehouseName ?? data.scenario.destinationWarehouse : "当前池暂无订单"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">主合同</span>
                    <strong>{selectedContractLabel}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">主批次</span>
                    <strong>{data.focus.batchNo ?? "待生成"}</strong>
                  </div>
                </div>

                <div className="dashboard-focus-note">
                  {!hasFocusedOrder
                    ? `${activeOrderPool?.label ?? "当前订单池"}：当前没有可展示的订单，首页已保留全局库存与模块总览。`
                    : activeOrderPool
                    ? `${activeOrderPool.label}：${activeOrderPool.description}`
                    : "首页默认优先查看进行中的订单，减少已完成订单对驾驶舱的干扰。"}
                </div>

                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={() => void handleRefreshAll()} loading={loading}>
                    刷新驾驶舱
                  </Button>

                  {setupStatus?.resetCapability.enabled ? (
                    <Button
                      danger
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => setIsResetModalOpen(true)}
                      loading={isResetting}
                    >
                      回到空白起点
                    </Button>
                  ) : null}
                </Space>
              </Space>
            ) : (
              <Skeleton active paragraph={{ rows: 5 }} />
            )}
          </Card>
        </div>
      </section>

      <Alert
        type={data?.inventory.isConsistent === false ? "warning" : "success"}
        showIcon
        message={
          data?.inventory.isConsistent === false
            ? "库存统计与二维码状态存在差异，请先检查扫码链路"
            : "当前库存统计已与二维码状态和库存流水对齐"
        }
        description={
          data
            ? `本次统计生成于 ${formatDateTime(data.generatedAt)}。合同数量只是业务目标量，真正库存由二维码状态和扫码流水共同决定。`
            : "首页会优先展示真实库存结果，再叠加经营演示状态。"
        }
      />

      <section>
        <div className="dashboard-section-head">
          <Typography.Title level={4} style={{ margin: 0 }}>
            订单池总览
          </Typography.Title>
          <Typography.Text type="secondary">
            首页默认优先查看进行中的订单，已完成、售后、异常、归档订单分池管理
          </Typography.Text>
        </div>

        <div className="dashboard-order-pools">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="placeholder-card">
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Card>
              ))
            : data?.orderPools.map((pool) => (
                <Card
                  key={pool.key}
                  className={`placeholder-card dashboard-order-pool-card${
                    data.orderView === pool.key ? " is-active" : ""
                  }`}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("orderView", pool.key);
                    next.delete("focusContractId");
                    setSearchParams(next);
                  }}
                >
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Title level={5} style={{ margin: 0 }}>
                      {pool.label}
                    </Typography.Title>
                    <Typography.Text type="secondary">{pool.description}</Typography.Text>
                    <Statistic title="订单数" value={pool.count} />
                  </Space>
                </Card>
              ))}
        </div>
      </section>

      <section>
        <div className="dashboard-section-head">
          <Typography.Title level={4} style={{ margin: 0 }}>
            当前主订单状态
          </Typography.Title>
          <Typography.Text type="secondary">
            使用主流程状态、售后状态、异常状态、归档状态四个维度管理订单
          </Typography.Text>
        </div>

        <div className="dashboard-focus-statuses">
          <Card className="placeholder-card dashboard-focus-status-card">
            <Space direction="vertical" size="small">
              <Typography.Text type="secondary">主流程状态</Typography.Text>
              <Tag color={toneColorMap[data?.focus.mainFlowTone ?? "default"]}>
                {data?.focus.mainFlowStatusText ?? "未选择"}
              </Tag>
            </Space>
          </Card>
          <Card className="placeholder-card dashboard-focus-status-card">
            <Space direction="vertical" size="small">
              <Typography.Text type="secondary">售后状态</Typography.Text>
              <Tag color={toneColorMap[data?.focus.afterSalesTone ?? "default"]}>
                {data?.focus.afterSalesStatusText ?? "未选择"}
              </Tag>
            </Space>
          </Card>
          <Card className="placeholder-card dashboard-focus-status-card">
            <Space direction="vertical" size="small">
              <Typography.Text type="secondary">异常状态</Typography.Text>
              <Tag color={toneColorMap[data?.focus.exceptionTone ?? "default"]}>
                {data?.focus.exceptionStatusText ?? "未选择"}
              </Tag>
            </Space>
          </Card>
          <Card className="placeholder-card dashboard-focus-status-card">
            <Space direction="vertical" size="small">
              <Typography.Text type="secondary">归档状态</Typography.Text>
              <Tag color={toneColorMap[data?.focus.archiveTone ?? "default"]}>
                {data?.focus.archiveStatusText ?? "未选择"}
              </Tag>
            </Space>
          </Card>
        </div>
      </section>

      <section>
        <div className="dashboard-section-head">
          <Typography.Title level={4} style={{ margin: 0 }}>
            真实库存总览
          </Typography.Title>
          <Typography.Text type="secondary">
            这一组数字直接来自 `QrItem.status` 和 `StockMovement`
          </Typography.Text>
        </div>

        <div className="document-summary-grid dashboard-kpi-grid">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="stat-card">
                  <Skeleton active paragraph={false} />
                </Card>
              ))
            : inventoryCards.map((card) => (
                <Card key={card.label} className="stat-card">
                  <Statistic title={card.label} value={card.value} suffix={card.suffix} />
                </Card>
              ))}
        </div>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card className="placeholder-card dashboard-progress-card" title="真实执行进度">
            {data ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <div>
                  <Typography.Text type="secondary">当前主合同：{selectedContractLabel}</Typography.Text>
                </div>

                {!hasFocusedOrder ? (
                  <Alert
                    type="info"
                    showIcon
                    message="当前订单池暂无主订单"
                    description="这个订单池当前还没有合同进入该状态，因此这里只保留空视角，不回退显示其他池子的主订单。"
                  />
                ) : null}

                {hasFocusedOrder ? (
                  <Alert
                    type="info"
                    showIcon
                    message="驾驶舱字段口径"
                    description={`合同总量 = 商务承诺总数量；已进入执行 = 已生成二维码、已进入实际执行链路的数量；当前批次在库 = 当前主批次中已经扫码入库且尚未出库的真实数量。`}
                  />
                ) : null}

                <div>
                  <div className="dashboard-progress-header">
                    <span>入库执行</span>
                    <strong>
                      {data.execution.inboundCompleted}/{data.execution.inboundScopeQuantity}
                      {data.execution.unit}
                    </strong>
                  </div>
                  <Progress percent={data.execution.inboundProgressPercent} strokeColor="#1677ff" />
                  <Typography.Text type="secondary">
                    已完成入库 {data.execution.inboundCompleted}
                    {data.execution.unit}，仍有 {data.execution.inboundPending}
                    {data.execution.unit} 在途待扫码。
                  </Typography.Text>
                </div>

                <div>
                  <div className="dashboard-progress-header">
                    <span>出库执行</span>
                    <strong>
                      {data.execution.outboundCompleted}/{data.execution.outboundTarget}
                      {data.execution.unit}
                    </strong>
                  </div>
                  <Progress percent={data.execution.outboundProgressPercent} strokeColor="#fa8c16" />
                  <Typography.Text type="secondary">
                    计划出库 {data.execution.outboundTarget}
                    {data.execution.unit}，已出库 {data.execution.outboundCompleted}
                    {data.execution.unit}，剩余 {data.execution.outboundRemaining}
                    {data.execution.unit}。
                  </Typography.Text>
                </div>

                <div className="dashboard-mini-grid">
                  <div>
                    <span className="app-header-panel-label">客户</span>
                    <strong>{hasFocusedOrder ? data.focus.customerName ?? data.scenario.customerName : "当前池暂无订单"}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">供应商</span>
                    <strong>{hasFocusedOrder ? data.scenario.supplierName : "当前池暂无订单"}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">合同数量</span>
                    <strong>
                      {hasFocusedOrder ? `${data.execution.contractTotalQuantity} ${data.execution.unit}` : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">已进入执行</span>
                    <strong>
                      {hasFocusedOrder ? `${data.execution.contractExecutingQuantity} ${data.execution.unit}` : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">合同待执行</span>
                    <strong>
                      {hasFocusedOrder
                        ? `${data.execution.contractPendingExecutionQuantity} ${data.execution.unit}`
                        : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">当前执行批次量</span>
                    <strong>{hasFocusedOrder ? `${data.execution.focusBatchQuantity} ${data.execution.unit}` : "0"}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">当前批次在途</span>
                    <strong>
                      {hasFocusedOrder
                        ? `${data.execution.focusBatchInTransitQuantity} ${data.execution.unit}`
                        : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">当前批次在库</span>
                    <strong>
                      {hasFocusedOrder ? `${data.execution.focusBatchInStockQuantity} ${data.execution.unit}` : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">当前批次已出库</span>
                    <strong>
                      {hasFocusedOrder
                        ? `${data.execution.focusBatchOutboundQuantity} ${data.execution.unit}`
                        : "0"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">合同金额</span>
                    <strong>
                      {hasFocusedOrder ? `${data.scenario.amount} ${data.scenario.currency}` : "当前池暂无订单"}
                    </strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">关联合同批次</span>
                    <strong>{data.focus.batchCount}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">订单池</span>
                    <strong>{activeOrderPool?.label ?? "进行中订单"}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">AI 模式</span>
                    <strong>{data.assistant.llmEnabled ? "升级版 AI" : "模板 AI"}</strong>
                  </div>
                </div>
              </Space>
            ) : (
              <Skeleton active paragraph={{ rows: 8 }} />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <Card className="placeholder-card" title="最近工单与待办">
            {data ? (
              data.recentTasks.length > 0 ? (
                <List
                  dataSource={data.recentTasks}
                  renderItem={(item) => (
                    <List.Item
                      className="dashboard-task-item"
                      actions={[
                        <Button key="open" type="link" onClick={() => navigate(item.routePath)}>
                          打开
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space wrap>
                            <span>{item.title}</span>
                            <Tag color={toneColorMap[item.tone]}>{item.statusText}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={4}>
                            <Typography.Text type="secondary">
                              责任角色：{item.owner} | 关联对象：{item.reference}
                            </Typography.Text>
                            <Typography.Text>{item.description}</Typography.Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="当前还没有待展示的首页工单与待办。" />
              )
            ) : (
              <Skeleton active paragraph={{ rows: 6 }} />
            )}
          </Card>
        </Col>
      </Row>

      <section>
        <div className="dashboard-section-head">
          <Typography.Title level={4} style={{ margin: 0 }}>
            ERP 模块状态
          </Typography.Title>
          <Typography.Text type="secondary">真实闭环与成熟展示模块在首页统一串联</Typography.Text>
        </div>

        <div className="dashboard-status-grid">
          {loading && !data
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card key={index} className="placeholder-card">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </Card>
              ))
            : data?.statusCards.map((card) => (
                <Card key={card.key} className="placeholder-card dashboard-status-card">
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Space wrap>
                      <Typography.Title level={5} style={{ margin: 0 }}>
                        {card.title}
                      </Typography.Title>
                      <Tag color={toneColorMap[card.tone]}>{card.statusText}</Tag>
                    </Space>
                    <Statistic title={card.metricLabel} value={card.metricValue} />
                    <Typography.Paragraph style={{ marginBottom: 0 }}>
                      {card.description}
                    </Typography.Paragraph>
                    <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate(card.routePath)}>
                      进入模块
                    </Button>
                  </Space>
                </Card>
              ))}
        </div>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={14}>
          <Card className="placeholder-card" title="最近推进">
            {data ? (
              data.recentActivities.length > 0 ? (
                <Timeline
                  items={data.recentActivities.map((item) => ({
                    color: toneColorMap[item.tone],
                    children: (
                      <div className="dashboard-timeline-item">
                        <Space wrap>
                          <Tag color={toneColorMap[item.tone]}>{item.kind}</Tag>
                          <Typography.Text type="secondary">{formatDateTime(item.occurredAt)}</Typography.Text>
                        </Space>
                        <Typography.Title level={5} style={{ marginTop: 8, marginBottom: 8 }}>
                          {item.title}
                        </Typography.Title>
                        <Typography.Paragraph style={{ marginBottom: 8 }}>
                          {item.description}
                        </Typography.Paragraph>
                        <Button type="link" onClick={() => navigate(item.routePath)}>
                          查看相关页面
                        </Button>
                      </div>
                    )
                  }))}
                />
              ) : (
                <Empty description="当前还没有可展示的首页推进记录。" />
              )
            ) : (
              <Skeleton active paragraph={{ rows: 7 }} />
            )}
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="placeholder-card" title="系统基础状态">
            {data ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <div className="dashboard-mini-grid">
                  <div>
                    <span className="app-header-panel-label">单据数</span>
                    <strong>{data.counts.documents}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">正式合同</span>
                    <strong>{data.counts.contracts}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">批次数</span>
                    <strong>{data.counts.batches}</strong>
                  </div>
                  <div>
                    <span className="app-header-panel-label">AI 记录</span>
                    <strong>{data.counts.aiLogs}</strong>
                  </div>
                </div>

                <Alert
                  type="info"
                  showIcon
                  icon={<RobotOutlined />}
                  message={
                    data.assistant.llmEnabled
                      ? `升级版 AI 已启用：${data.assistant.provider} / ${data.assistant.model ?? "-"}`
                      : "当前使用本地模板 AI，未强依赖外部模型"
                  }
                  description={`运行来源：${data.assistant.source}。即使升级版 AI 调用失败，也会自动回退到模板回答。`}
                />

                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    href="http://127.0.0.1:3001/api/setup/status"
                    target="_blank"
                  >
                    查看系统状态
                  </Button>
                  <Button href="http://127.0.0.1:3001/api/health" target="_blank">
                    查看服务状态
                  </Button>
                </Space>
              </Space>
            ) : (
              <Skeleton active paragraph={{ rows: 6 }} />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="回到空白演示起点"
        open={isResetModalOpen}
        onCancel={() => {
          setIsResetModalOpen(false);
          setHighestPrivilegeConfirmed(false);
          setResetConfirmationText("");
        }}
        onOk={() => void handleResetDemoEnvironment()}
        confirmLoading={isResetting}
        okText="确认重置"
        okButtonProps={{ danger: true, disabled: !isResetConfirmationValid }}
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="这会回到空白演示起点"
            description={
              setupStatus
                ? `将先清空当前演示单据、正式合同、批次、二维码、库存流水、采购单、物流记录、工单等业务数据，并清理已上传单据文件与二维码图片。重置后系统只保留标准场景参数与基础底座，不再自动生成单据、合同、批次和库存；请从 pics 目录手动上传默认图片开始演示。`
                : "将先清空当前演示单据、正式合同、批次、二维码、库存流水、采购单、物流记录、工单等业务数据，并清理已上传单据文件与二维码图片，然后回到空白演示起点。"
            }
          />

          {setupStatus ? (
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: "scenario",
                  label: "恢复后的标准场景",
                  children: setupStatus.standardDemoScenario.scenarioName
                },
                {
                  key: "storyline",
                  label: "默认主线",
                  children:
                    setupStatus.standardDemoScenario.storyline ??
                    `${setupStatus.standardDemoScenario.origin} → ${setupStatus.standardDemoScenario.destinationWarehouse}`
                },
                {
                  key: "result",
                  label: "重置后状态",
                  children:
                    "回到“默认无单据、无合同、无批次、无二维码、无库存，由用户手动上传 pics 目录素材开始”的空白演示状态。"
                }
              ]}
            />
          ) : null}

          <Alert
            type="error"
            showIcon
            message="仅最高权限用户可执行"
            description={`请确认你当前以最高权限角色（${setupStatus?.resetCapability.highestPrivilegeRole ?? "OWNER"}）操作。未完成下方确认前，系统不会执行重新测试或重置。`}
          />

          <Checkbox
            checked={highestPrivilegeConfirmed}
            onChange={(event) => setHighestPrivilegeConfirmed(event.target.checked)}
          >
            我确认当前是最高权限用户，并且了解这会清空当前演示业务数据
          </Checkbox>

          <div>
            <Typography.Text strong>请输入确认短语</Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              value={resetConfirmationText}
              onChange={(event) => setResetConfirmationText(event.target.value)}
              placeholder={resetConfirmationPhrase}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              需要完整输入：{resetConfirmationPhrase}
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>
    </div>
  );
}
