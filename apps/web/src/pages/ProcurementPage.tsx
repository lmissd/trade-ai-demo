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
  ApartmentOutlined,
  CarOutlined,
  ReloadOutlined,
  ShoppingCartOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type ProcurementStatus = "DRAFT" | "SUPPLIER_SHIPPED" | "COLLECTION_COMPLETED";

type ProcurementOrderRecord = {
  id: string;
  purchaseNo: string;
  supplierName: string;
  skuName: string;
  quantity: number;
  unit: string;
  deliveryDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: ProcurementStatus;
  statusMeta: {
    label: string;
    color: "default" | "processing" | "success";
    summary: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    productName: string;
    destinationWarehouse: string;
    amount: number;
    currency: string;
  } | null;
  batch: {
    id: string;
    batchNo: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    status: string;
    destinationWarehouse: string;
  } | null;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
  linkedShipment: {
    id: string;
    shipmentNo: string;
    status: string;
    shippingCompany: string | null;
    billOfLadingNo: string | null;
    containerNo: string | null;
    originPort: string | null;
    destinationPort: string | null;
    departureTime: string | null;
    estimatedArrivalTime: string | null;
    actualArrivalTime: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedWorkOrder: {
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
  progress: Array<{
    key: ProcurementStatus;
    state: "wait" | "process" | "finish";
  }>;
  recommendedAction: {
    nextStatus: ProcurementStatus | null;
    buttonText: string;
    description: string;
  };
};

type ProcurementOrdersResponse = {
  summary: {
    totalOrders: number;
    draftOrders: number;
    supplierShippedOrders: number;
    collectionCompletedOrders: number;
    linkedShipments: number;
  };
  orders: ProcurementOrderRecord[];
};

type ProcurementOrderDetail = ProcurementOrderRecord & {
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

type ProgressResponse = {
  progressed: true;
  order: ProcurementOrderRecord;
  logisticsLinked: boolean;
  shipment: {
    id: string;
    shipmentNo: string;
    status: string;
  } | null;
  workOrder: {
    id: string;
    workOrderNo: string;
    status: string;
  } | null;
};

const progressStepLabels: Record<ProcurementStatus, string> = {
  DRAFT: "采购下单",
  SUPPLIER_SHIPPED: "供应商已发货",
  COLLECTION_COMPLETED: "国内集货完成"
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

export function ProcurementPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ProcurementOrdersResponse["summary"] | null>(null);
  const [orders, setOrders] = useState<ProcurementOrderRecord[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<ProcurementOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [progressingOrderId, setProgressingOrderId] = useState<string | null>(null);

  const selectedOrder = useMemo(
    () => orders.find((item) => item.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  async function loadOrders() {
    setIsLoading(true);

    try {
      const payload = await requestJson<ProcurementOrdersResponse>("/api/procurement/orders");
      setSummary(payload.summary);
      setOrders(payload.orders);

      if (selectedOrderId && !payload.orders.some((item) => item.id === selectedOrderId)) {
        setSelectedOrderId(null);
        setSelectedOrderDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载采购单列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadOrderDetail(orderId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<ProcurementOrderDetail>(`/api/procurement/orders/${orderId}`);
      setSelectedOrderDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载采购单详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleProgress(order: ProcurementOrderRecord) {
    if (!order.recommendedAction.nextStatus) {
      return;
    }

    setProgressingOrderId(order.id);

    try {
      const payload = await requestJson<ProgressResponse>(`/api/procurement/orders/${order.id}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetStatus: order.recommendedAction.nextStatus
        })
      });

      setOrders((current) => current.map((item) => (item.id === payload.order.id ? payload.order : item)));

      if (selectedOrderId === payload.order.id) {
        await loadOrderDetail(payload.order.id);
      }

      if (payload.logisticsLinked && payload.shipment) {
        message.success(`已推进到国内集货完成，并联动生成物流记录 ${payload.shipment.shipmentNo}。`);
      } else {
        message.success(`采购状态已推进为“${payload.order.statusMeta.label}”。`);
      }

      await loadOrders();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推进采购状态失败。");
    } finally {
      setProgressingOrderId(null);
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

    return Math.max(selectedOrderDetail.progress.length - 1, 0);
  }, [selectedOrderDetail]);

  const columns: ColumnsType<ProcurementOrderRecord> = [
    {
      title: "采购单号",
      dataIndex: "purchaseNo",
      width: 220
    },
    {
      title: "合同号",
      key: "contractNo",
      width: 220,
      render: (_, record) => record.contract?.contractNo ?? "-"
    },
    {
      title: "供应商",
      dataIndex: "supplierName",
      width: 180
    },
    {
      title: "SKU / 商品",
      key: "skuName",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.skuName}</Typography.Text>
          <Typography.Text type="secondary">{record.contract?.productName ?? "-"}</Typography.Text>
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
      title: "批次号",
      key: "batchNo",
      width: 220,
      render: (_, record) => record.batch?.batchNo ?? "-"
    },
    {
      title: "交期",
      dataIndex: "deliveryDate",
      width: 140,
      render: (value: string | null) => formatDate(value)
    },
    {
      title: "采购状态",
      key: "status",
      width: 160,
      render: (_, record) => <Tag color={record.statusMeta.color}>{record.statusMeta.label}</Tag>
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
          disabled={!record.recommendedAction.nextStatus}
          loading={progressingOrderId === record.id}
          onClick={(event) => {
            event.stopPropagation();
            void handleProgress(record);
          }}
        >
          {record.recommendedAction.nextStatus ? record.recommendedAction.buttonText : "已完成交接"}
        </Button>
      )
    }
  ];

  return (
    <div className="document-workspace procurement-workspace">
      <section className="page-hero">
        <h2>采购与境内集货</h2>
        <p>
          这里展示正式合同确认后生成的采购单，并把供应商发货、国内集货和进入国际运输前的状态推进放在同一个工作台里。
          这一阶段只做演示版真实闭环，不做复杂审批，也不会直接改库存。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="采购单总数" value={summary?.totalOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="供应商已发货" value={summary?.supplierShippedOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="国内集货完成" value={summary?.collectionCompletedOrders ?? 0} suffix="单" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已联动物流记录" value={summary?.linkedShipments ?? 0} suffix="条" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={14}>
          <Alert
            type="info"
            showIcon
            message="阶段 11 演示边界"
            description="采购模块真实读取正式采购单，并允许模拟推进到“供应商已发货”和“国内集货完成”。推进后会自动联动国际物流记录和运输安排工单，但不会直接影响二维码状态或库存数量。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card
            className="placeholder-card document-table-card"
            title="采购单列表"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadOrders()}>
                刷新
              </Button>
            }
          >
            <Table<ProcurementOrderRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={orders}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1500 }}
              rowClassName={(record) => (record.id === selectedOrderId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedOrderId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有采购单。请先在“合同与单据”中确认生成正式业务数据。" />
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedOrderId)}
        onClose={() => setSelectedOrderId(null)}
        title={selectedOrderDetail?.purchaseNo ?? selectedOrder?.purchaseNo ?? "采购单详情"}
        width={screens.xs ? "100%" : 720}
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
                { key: "purchaseNo", label: "采购单号", children: selectedOrderDetail.purchaseNo },
                {
                  key: "status",
                  label: "采购状态",
                  children: <Tag color={selectedOrderDetail.statusMeta.color}>{selectedOrderDetail.statusMeta.label}</Tag>
                },
                { key: "contractNo", label: "合同号", children: selectedOrderDetail.contract?.contractNo ?? "-" },
                { key: "batchNo", label: "批次号", children: selectedOrderDetail.batch?.batchNo ?? "-" },
                { key: "supplier", label: "供应商", children: selectedOrderDetail.supplierName },
                { key: "customer", label: "客户", children: selectedOrderDetail.contract?.customerName ?? "-" },
                { key: "sku", label: "SKU / 商品", children: selectedOrderDetail.skuName },
                {
                  key: "quantity",
                  label: "数量",
                  children: `${selectedOrderDetail.quantity}${selectedOrderDetail.unit}`
                },
                {
                  key: "amount",
                  label: "合同金额",
                  children: selectedOrderDetail.contract
                    ? formatAmount(selectedOrderDetail.contract.amount, selectedOrderDetail.contract.currency)
                    : "-"
                },
                {
                  key: "warehouse",
                  label: "目的仓库",
                  children: selectedOrderDetail.contract?.destinationWarehouse ?? "-"
                },
                {
                  key: "deliveryDate",
                  label: "交期",
                  children: formatDate(selectedOrderDetail.deliveryDate)
                },
                {
                  key: "updatedAt",
                  label: "最近更新时间",
                  children: formatDateTime(selectedOrderDetail.updatedAt)
                }
              ]}
            />

            <Card className="placeholder-card procurement-detail-card" title="采购推进状态">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedOrderDetail.statusMeta.summary}
                </Typography.Paragraph>
                <Steps
                  size="small"
                  current={selectedProgressCurrent}
                  items={selectedOrderDetail.progress.map((item) => ({
                    title: progressStepLabels[item.key],
                    status: item.state
                  }))}
                />
                <Alert
                  type={selectedOrderDetail.recommendedAction.nextStatus ? "info" : "success"}
                  showIcon
                  message={selectedOrderDetail.recommendedAction.description}
                />
                <Button
                  type="primary"
                  icon={<ShoppingCartOutlined />}
                  disabled={!selectedOrderDetail.recommendedAction.nextStatus}
                  loading={progressingOrderId === selectedOrderDetail.id}
                  onClick={() => void handleProgress(selectedOrderDetail)}
                >
                  {selectedOrderDetail.recommendedAction.buttonText}
                </Button>
              </Space>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="关联二维码概况">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>总二维码：{selectedOrderDetail.qrSummary.total} 个</Typography.Text>
                    <Typography.Text>待入库：{selectedOrderDetail.qrSummary.pendingInbound} 个</Typography.Text>
                    <Typography.Text>在库：{selectedOrderDetail.qrSummary.inStock} 个</Typography.Text>
                    <Typography.Text>已出库：{selectedOrderDetail.qrSummary.outbound} 个</Typography.Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="模块定位说明">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      当前模块负责把采购动作交接给后续国际运输，而不是直接形成库存。
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      真正库存变化仍然只能发生在二维码生成后并经过扫码入库 / 扫码出库。
                    </Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card procurement-detail-card" title="联动后的国际物流与工单">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {selectedOrderDetail.linkedShipment ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "shipmentNo",
                        label: "运输批次号",
                        children: selectedOrderDetail.linkedShipment.shipmentNo
                      },
                      {
                        key: "shipmentStatus",
                        label: "运输状态",
                        children: <Tag color="processing">{selectedOrderDetail.linkedShipment.status}</Tag>
                      },
                      {
                        key: "shippingCompany",
                        label: "船公司",
                        children: selectedOrderDetail.linkedShipment.shippingCompany ?? "-"
                      },
                      {
                        key: "billOfLadingNo",
                        label: "提单号",
                        children: selectedOrderDetail.linkedShipment.billOfLadingNo ?? "-"
                      },
                      {
                        key: "containerNo",
                        label: "柜号",
                        children: selectedOrderDetail.linkedShipment.containerNo ?? "-"
                      },
                      {
                        key: "route",
                        label: "起运 / 目的",
                        children: `${selectedOrderDetail.linkedShipment.originPort ?? "-"} → ${selectedOrderDetail.linkedShipment.destinationPort ?? "-"}`
                      },
                      {
                        key: "eta",
                        label: "预计到港",
                        children: formatDateTime(selectedOrderDetail.linkedShipment.estimatedArrivalTime)
                      }
                    ]}
                  />
                ) : (
                  <Empty description="当前采购单还没有联动出国际物流记录。推进到“国内集货完成”后，这里会自动出现。" />
                )}

                {selectedOrderDetail.linkedWorkOrder ? (
                  <>
                    <Divider style={{ margin: "8px 0" }} />
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "workOrderNo",
                          label: "运输安排工单号",
                          children: selectedOrderDetail.linkedWorkOrder.workOrderNo
                        },
                        {
                          key: "workOrderStatus",
                          label: "工单状态",
                          children: <Tag color="warning">{selectedOrderDetail.linkedWorkOrder.status}</Tag>
                        },
                        {
                          key: "department",
                          label: "责任部门",
                          children: selectedOrderDetail.linkedWorkOrder.responsibleDepartment ?? "-"
                        },
                        {
                          key: "owner",
                          label: "责任人",
                          children: selectedOrderDetail.linkedWorkOrder.responsiblePerson ?? "-"
                        },
                        {
                          key: "dueTime",
                          label: "截止时间",
                          children: formatDateTime(selectedOrderDetail.linkedWorkOrder.dueTime)
                        }
                      ]}
                    />
                  </>
                ) : null}

                <Space wrap>
                  <Button icon={<CarOutlined />} onClick={() => navigate("/logistics")}>
                    查看国际物流
                  </Button>
                  <Button icon={<ApartmentOutlined />} onClick={() => navigate("/work-orders")}>
                    查看自动工单
                  </Button>
                </Space>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="状态推进历史">
              <List
                bordered
                dataSource={selectedOrderDetail.history}
                locale={{ emptyText: "当前采购单还没有状态推进记录。" }}
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
            <Empty description="从采购单列表中选择一条记录后，这里会显示详情。" />
          </Card>
        )}
      </Drawer>
    </div>
  );
}
