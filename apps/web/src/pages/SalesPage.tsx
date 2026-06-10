import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Grid,
  List,
  Row,
  Space,
  Statistic,
  Steps,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CarOutlined,
  DollarCircleOutlined,
  ReloadOutlined,
  ShoppingOutlined,
  SolutionOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type SalesStage = "READY" | "IN_TRANSIT" | "DELIVERED";

type SalesOrderRecord = {
  id: string;
  salesNo: string;
  customerName: string;
  skuName: string;
  quantity: number;
  unit: string;
  amount: number;
  currency: string;
  deliveryMethod: string | null;
  rawDeliveryStatus: string;
  rawSignStatus: string;
  salesStatus: string;
  createdAt: string;
  updatedAt: string;
  stage: SalesStage;
  statusMeta: {
    label: string;
    color: "default" | "processing" | "success";
    summary: string;
  };
  signStatusMeta: {
    label: string;
    color: "warning" | "success";
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    amount: number;
    currency: string;
    destinationWarehouse: string;
    paymentStatus: string;
  } | null;
  batch: {
    id: string;
    batchNo: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    status: string;
    destinationWarehouse: string;
    warehouseId: string | null;
  } | null;
  outboundOrder: {
    id: string;
    outboundNo: string;
    status: string;
    quantity: number;
    unit: string;
    warehouseId: string | null;
    warehouseName: string | null;
    updatedAt: string;
  } | null;
  deliveryOrder: {
    id: string;
    deliveryNo: string;
    status: string;
    quantity: number;
    unit: string;
    warehouseId: string | null;
    warehouseName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
    frozen: number;
  };
  progress: Array<{
    key: string;
    title: string;
    state: "wait" | "process" | "finish";
  }>;
  receivable: {
    id: string;
    status: string;
    statusLabel: string;
    statusColor: "warning" | "processing" | "success";
    amount: number;
    currency: string;
    receivedAmount: number;
    openAmount: number;
    dueDate: string | null;
    scope: "SALES_ORDER" | "CONTRACT";
    scopeLabel: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedFinanceWorkOrder: {
    id: string;
    workOrderNo: string;
    title: string;
    status: string;
    priority: string;
    responsibleDepartment: string | null;
    responsiblePerson: string | null;
    startTime: string | null;
    dueTime: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  recommendedAction: {
    canComplete: boolean;
    buttonText: string;
    description: string;
  };
};

type SalesOrdersResponse = {
  summary: {
    totalOrders: number;
    readyOrders: number;
    inTransitOrders: number;
    deliveredOrders: number;
    pendingReceivables: number;
  };
  orders: SalesOrderRecord[];
};

type SalesOrderDetail = SalesOrderRecord & {
  moduleNarrative: {
    role: string;
    boundary: string;
  };
  history: Array<{
    id: string;
    action: string;
    operator: string;
    occurredAt: string;
    summary: string;
  }>;
};

type CompleteDeliveryResponse = {
  completed: true;
  order: SalesOrderRecord;
  deliveryOrder: {
    id: string;
    deliveryNo: string;
    status: string;
  } | null;
  receivable: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    dueDate: string | null;
    receivedAmount: number;
  } | null;
  financeWorkOrder: {
    id: string;
    workOrderNo: string;
    status: string;
  } | null;
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

export function SalesPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<SalesOrdersResponse["summary"] | null>(null);
  const [orders, setOrders] = useState<SalesOrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<SalesOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  async function loadOrders() {
    setIsLoading(true);

    try {
      const payload = await requestJson<SalesOrdersResponse>("/api/sales/orders");
      setSummary(payload.summary);
      setOrders(payload.orders);

      if (selectedOrderId && !payload.orders.some((item) => item.id === selectedOrderId)) {
        setSelectedOrderId(null);
        setSelectedOrderDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载销售与配送列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOrderDetail(orderId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<SalesOrderDetail>(`/api/sales/orders/${orderId}`);
      setSelectedOrderDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载销售单详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleCompleteDelivery(order: SalesOrderRecord) {
    if (!order.recommendedAction.canComplete) {
      return;
    }

    setCompletingOrderId(order.id);

    try {
      const payload = await requestJson<CompleteDeliveryResponse>(`/api/sales/orders/${order.id}/complete-delivery`, {
        method: "POST"
      });

      setOrders((current) => current.map((item) => (item.id === payload.order.id ? payload.order : item)));

      if (selectedOrderId === payload.order.id) {
        await loadOrderDetail(payload.order.id);
      }

      message.success(
        `已模拟配送完成，并联动 ${
          payload.receivable ? `${payload.receivable.currency} 应收待回款` : "财务待回款"
        }${payload.financeWorkOrder ? ` / 工单 ${payload.financeWorkOrder.workOrderNo}` : ""}。`
      );

      await loadOrders();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推进配送状态失败。");
    } finally {
      setCompletingOrderId(null);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      setSelectedOrderDetail(null);
      void loadOrderDetail(selectedOrderId);
    } else {
      setSelectedOrderDetail(null);
    }
  }, [selectedOrderId]);

  const selectedProgressCurrent = useMemo(() => {
    if (!selectedOrderDetail) {
      return 0;
    }

    const processingIndex = selectedOrderDetail.progress.findIndex((item) => item.state === "process");

    if (processingIndex >= 0) {
      return processingIndex;
    }

    const finishedCount = selectedOrderDetail.progress.filter((item) => item.state === "finish").length;
    return Math.max(finishedCount - 1, 0);
  }, [selectedOrderDetail]);

  const columns: ColumnsType<SalesOrderRecord> = [
    {
      title: "销售单号",
      dataIndex: "salesNo",
      width: 220
    },
    {
      title: "客户",
      dataIndex: "customerName",
      width: 180
    },
    {
      title: "商品 / SKU",
      key: "skuName",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.skuName}</Typography.Text>
          <Typography.Text type="secondary">{record.batch?.productName ?? "-"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "数量",
      key: "quantity",
      width: 140,
      render: (_, record) => `${record.quantity}${record.unit}`
    },
    {
      title: "配送方式",
      dataIndex: "deliveryMethod",
      width: 150,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "配送状态",
      key: "deliveryStatus",
      width: 160,
      render: (_, record) => <Tag color={record.statusMeta.color}>{record.statusMeta.label}</Tag>
    },
    {
      title: "签收状态",
      key: "signStatus",
      width: 140,
      render: (_, record) => <Tag color={record.signStatusMeta.color}>{record.signStatusMeta.label}</Tag>
    },
    {
      title: "关联合同 / 批次",
      key: "references",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.contract?.contractNo ?? "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.batch?.batchNo ?? "-"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "操作",
      key: "actions",
      width: 180,
      fixed: "right",
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          disabled={!record.recommendedAction.canComplete}
          loading={completingOrderId === record.id}
          onClick={(event) => {
            event.stopPropagation();
            void handleCompleteDelivery(record);
          }}
        >
          {record.recommendedAction.buttonText}
        </Button>
      )
    }
  ];

  return (
    <div className="document-workspace procurement-workspace">
      <section className="page-hero">
        <h2>销售与配送</h2>
        <p>
          这里承接仓储出库后的销售执行，真实展示销售单、配送单、签收状态，以及配送完成后如何联动财务进入待回款。
          这一阶段只推进销售与财务展示链路，不直接改变二维码或库存。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="销售单总数" value={summary?.totalOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="待配送" value={summary?.readyOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="配送中" value={summary?.inTransitOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="待回款记录" value={summary?.pendingReceivables ?? 0} suffix="笔" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={14}>
          <Alert
            type="info"
            showIcon
            message="阶段 15 演示边界"
            description="销售与配送模块真实读取销售单、出库单与应收记录，允许模拟配送完成。配送完成后会把应收推进到待回款并生成或刷新财务跟进工单，但不会直接改写库存，库存仍以二维码真实状态为准。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card
            className="placeholder-card document-table-card"
            title="销售单列表"
            extra={
              <Space>
                <Button icon={<ShoppingOutlined />} onClick={() => navigate("/warehouse")}>
                  查看仓储管理
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table<SalesOrderRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={orders}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1760 }}
              rowClassName={(record) => (record.id === selectedOrderId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedOrderId(record.id)
              })}
              locale={{
                emptyText: (
                  <Empty description="当前还没有销售单。请先完成前面的合同、采购、物流、清关和仓储链路，系统才会在这里承接销售与配送。" />
                )
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrderDetail?.salesNo ?? selectedOrder?.salesNo ?? "销售单详情"}
        width={screens.xs ? "100%" : 760}
        destroyOnHidden={false}
      >
        {selectedOrderDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type="success"
              showIcon
              message={selectedOrderDetail.moduleNarrative.role}
              description={selectedOrderDetail.moduleNarrative.boundary}
            />

            <Descriptions
              bordered
              size="small"
              column={screens.md ? 2 : 1}
              items={[
                { key: "salesNo", label: "销售单号", children: selectedOrderDetail.salesNo },
                {
                  key: "stage",
                  label: "配送状态",
                  children: <Tag color={selectedOrderDetail.statusMeta.color}>{selectedOrderDetail.statusMeta.label}</Tag>
                },
                {
                  key: "signStatus",
                  label: "签收状态",
                  children: (
                    <Tag color={selectedOrderDetail.signStatusMeta.color}>{selectedOrderDetail.signStatusMeta.label}</Tag>
                  )
                },
                {
                  key: "contractNo",
                  label: "关联合同",
                  children: selectedOrderDetail.contract?.contractNo ?? "-"
                },
                {
                  key: "batchNo",
                  label: "关联批次",
                  children: selectedOrderDetail.batch?.batchNo ?? "-"
                },
                { key: "customerName", label: "客户", children: selectedOrderDetail.customerName },
                { key: "skuName", label: "商品", children: selectedOrderDetail.skuName },
                {
                  key: "quantity",
                  label: "销售数量",
                  children: `${selectedOrderDetail.quantity}${selectedOrderDetail.unit}`
                },
                {
                  key: "amount",
                  label: "销售金额",
                  children: formatAmount(selectedOrderDetail.amount, selectedOrderDetail.currency)
                },
                {
                  key: "deliveryMethod",
                  label: "配送方式",
                  children: selectedOrderDetail.deliveryMethod ?? "-"
                },
                {
                  key: "deliveryNo",
                  label: "配送单号",
                  children: selectedOrderDetail.deliveryOrder?.deliveryNo ?? "尚未生成配送单"
                },
                {
                  key: "outboundNo",
                  label: "出库单号",
                  children: selectedOrderDetail.outboundOrder?.outboundNo ?? "-"
                },
                {
                  key: "warehouse",
                  label: "发货仓库",
                  children:
                    selectedOrderDetail.deliveryOrder?.warehouseName ??
                    selectedOrderDetail.outboundOrder?.warehouseName ??
                    selectedOrderDetail.contract?.destinationWarehouse ??
                    "-"
                },
                {
                  key: "updatedAt",
                  label: "最近更新时间",
                  children: formatDateTime(selectedOrderDetail.updatedAt)
                }
              ]}
            />

            <Card className="placeholder-card procurement-detail-card" title="配送推进状态">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedOrderDetail.statusMeta.summary}
                </Typography.Paragraph>
                <Steps
                  size="small"
                  current={selectedProgressCurrent}
                  items={selectedOrderDetail.progress.map((item) => ({
                    title: item.title,
                    status: item.state
                  }))}
                />
                <Alert
                  type={selectedOrderDetail.recommendedAction.canComplete ? "info" : "success"}
                  showIcon
                  message={selectedOrderDetail.recommendedAction.description}
                />
                <Button
                  type="primary"
                  icon={<CarOutlined />}
                  disabled={!selectedOrderDetail.recommendedAction.canComplete}
                  loading={completingOrderId === selectedOrderDetail.id}
                  onClick={() => void handleCompleteDelivery(selectedOrderDetail)}
                >
                  {selectedOrderDetail.recommendedAction.buttonText}
                </Button>
              </Space>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="关联合同与二维码概况">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      合同总量：{selectedOrderDetail.contract?.totalQuantity ?? 0}
                      {selectedOrderDetail.contract?.unit ?? selectedOrderDetail.unit}
                    </Typography.Text>
                    <Typography.Text>批次二维码总数：{selectedOrderDetail.qrSummary.total} 个</Typography.Text>
                    <Typography.Text>已出库：{selectedOrderDetail.qrSummary.outbound} 个</Typography.Text>
                    <Typography.Text>当前在库：{selectedOrderDetail.qrSummary.inStock} 个</Typography.Text>
                    <Typography.Text>冻结库存：{selectedOrderDetail.qrSummary.frozen} 个</Typography.Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="模块定位说明">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      当前模块负责把“仓储已出库”交接给“配送签收”和“财务待回款”。
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      即使这里已经完成配送，库存也不会再次减少，因为库存变化只认二维码扫码出库。
                    </Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card procurement-detail-card" title="配送与财务联动">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {selectedOrderDetail.deliveryOrder ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "deliveryNo",
                        label: "配送单号",
                        children: selectedOrderDetail.deliveryOrder.deliveryNo
                      },
                      {
                        key: "deliveryStatus",
                        label: "配送单状态",
                        children: <Tag color={selectedOrderDetail.stage === "DELIVERED" ? "success" : "processing"}>{selectedOrderDetail.deliveryOrder.status}</Tag>
                      },
                      {
                        key: "deliveryWarehouse",
                        label: "发货仓库",
                        children: selectedOrderDetail.deliveryOrder.warehouseName ?? "-"
                      },
                      {
                        key: "deliveryQuantity",
                        label: "配送数量",
                        children: `${selectedOrderDetail.deliveryOrder.quantity}${selectedOrderDetail.deliveryOrder.unit}`
                      }
                    ]}
                  />
                ) : (
                  <Empty description="当前销售单还没有配送单。第一次推进配送完成时，系统会自动补齐配送单记录。" />
                )}

                <Divider style={{ margin: "8px 0" }} />

                {selectedOrderDetail.receivable ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "receivableScope",
                        label: "应收口径",
                        children: selectedOrderDetail.receivable.scopeLabel
                      },
                      {
                        key: "receivableStatus",
                        label: "回款状态",
                        children: (
                          <Tag color={selectedOrderDetail.receivable.statusColor}>
                            {selectedOrderDetail.receivable.statusLabel}
                          </Tag>
                        )
                      },
                      {
                        key: "receivableAmount",
                        label: "应收金额",
                        children: formatAmount(selectedOrderDetail.receivable.amount, selectedOrderDetail.receivable.currency)
                      },
                      {
                        key: "receivedAmount",
                        label: "已收金额",
                        children: formatAmount(
                          selectedOrderDetail.receivable.receivedAmount,
                          selectedOrderDetail.receivable.currency
                        )
                      },
                      {
                        key: "openAmount",
                        label: "待回款金额",
                        children: formatAmount(selectedOrderDetail.receivable.openAmount, selectedOrderDetail.receivable.currency)
                      },
                      {
                        key: "dueDate",
                        label: "账期截止",
                        children: formatDate(selectedOrderDetail.receivable.dueDate)
                      }
                    ]}
                  />
                ) : (
                  <Empty description="当前还没有联动出应收记录。模拟配送完成后，这里会进入待回款状态。" />
                )}

                {selectedOrderDetail.linkedFinanceWorkOrder ? (
                  <>
                    <Divider style={{ margin: "8px 0" }} />
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "financeWorkOrderNo",
                          label: "财务跟进工单",
                          children: selectedOrderDetail.linkedFinanceWorkOrder.workOrderNo
                        },
                        {
                          key: "financeWorkOrderStatus",
                          label: "工单状态",
                          children: <Tag color="warning">{selectedOrderDetail.linkedFinanceWorkOrder.status}</Tag>
                        },
                        {
                          key: "financeOwner",
                          label: "责任部门 / 人",
                          children: `${selectedOrderDetail.linkedFinanceWorkOrder.responsibleDepartment ?? "-"} / ${selectedOrderDetail.linkedFinanceWorkOrder.responsiblePerson ?? "-"}`
                        },
                        {
                          key: "financeDue",
                          label: "截止时间",
                          children: formatDateTime(selectedOrderDetail.linkedFinanceWorkOrder.dueTime)
                        }
                      ]}
                    />
                  </>
                ) : null}

                <Space wrap>
                  <Button icon={<ShoppingOutlined />} onClick={() => navigate("/warehouse")}>
                    查看仓储管理
                  </Button>
                  <Button icon={<DollarCircleOutlined />} onClick={() => navigate("/finance")}>
                    查看财务回款
                  </Button>
                  <Button icon={<SolutionOutlined />} onClick={() => navigate("/work-orders")}>
                    查看自动工单
                  </Button>
                </Space>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="状态推进历史">
              <List
                bordered
                dataSource={selectedOrderDetail.history}
                locale={{ emptyText: "当前销售单还没有配送推进历史。" }}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <div>{item.summary}</div>
                      <div className="documents-secondary-text">
                        {item.operator} · {formatDateTime(item.occurredAt)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        ) : (
          <Card className="placeholder-card" loading={isDetailLoading}>
            <Empty description="从销售单列表中选择一条记录后，这里会显示详情。" />
          </Card>
        )}
      </Drawer>
    </div>
  );
}
