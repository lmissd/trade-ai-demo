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
  Table,
  Tag,
  Timeline,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CarOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type LogisticsStage = "COLLECTION_COMPLETED" | "DEPARTED" | "ARRIVED_DESTINATION" | "WAREHOUSE_DELIVERED";
type LogisticsActionTarget = "DEPARTED" | "ARRIVED_DESTINATION";
type LogisticsTagColor = "default" | "processing" | "success" | "warning";

type LogisticsShipmentRecord = {
  id: string;
  shipmentNo: string;
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
  stage: LogisticsStage;
  statusMeta: {
    label: string;
    color: LogisticsTagColor;
    summary: string;
  };
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    productName: string;
    destinationWarehouse: string;
    totalQuantity: number;
    unit: string;
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
  purchaseOrder: {
    id: string;
    purchaseNo: string;
    supplierName: string;
    skuName: string;
    quantity: number;
    unit: string;
    status: string;
    deliveryDate: string | null;
  } | null;
  qrSummary: {
    total: number;
    pendingInbound: number;
    inStock: number;
    outbound: number;
  };
  timeline: Array<{
    key: string;
    label: string;
    tone: LogisticsTagColor;
    completed: boolean;
    time: string | null;
    remark: string | null;
  }>;
  linkedLogisticsWorkOrder: {
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
  linkedCustomsClearance: {
    id: string;
    clearanceNo: string;
    responsibleCompany: string | null;
    responsiblePerson: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedCustomsWorkOrder: {
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
    nextStatus: LogisticsActionTarget | null;
    buttonText: string;
    description: string;
  };
};

type LogisticsShipmentsResponse = {
  summary: {
    totalShipments: number;
    readyToDepartShipments: number;
    inTransitShipments: number;
    pendingCustomsShipments: number;
    linkedCustomsClearances: number;
  };
  shipments: LogisticsShipmentRecord[];
};

type LogisticsShipmentDetail = LogisticsShipmentRecord & {
  moduleNarrative: {
    role: string;
    boundary: string;
  };
  documents: Array<{
    id: string;
    documentType: string;
    originalName: string | null;
    status: string;
    aiStatus: string;
    businessCreated: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
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
  shipment: LogisticsShipmentRecord;
  customsLinked: boolean;
  customsClearance: {
    id: string;
    clearanceNo: string;
    status: string;
  } | null;
  customsWorkOrder: {
    id: string;
    workOrderNo: string;
    status: string;
  } | null;
};

const toneColorMap: Record<LogisticsTagColor, "default" | "processing" | "success" | "warning"> = {
  default: "default",
  processing: "processing",
  success: "success",
  warning: "warning"
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

export function LogisticsPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<LogisticsShipmentsResponse["summary"] | null>(null);
  const [shipments, setShipments] = useState<LogisticsShipmentRecord[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [selectedShipmentDetail, setSelectedShipmentDetail] = useState<LogisticsShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [progressingShipmentId, setProgressingShipmentId] = useState<string | null>(null);

  const selectedShipment = useMemo(
    () => shipments.find((item) => item.id === selectedShipmentId) ?? null,
    [shipments, selectedShipmentId]
  );

  async function loadShipments() {
    setIsLoading(true);

    try {
      const payload = await requestJson<LogisticsShipmentsResponse>("/api/logistics/shipments");
      setSummary(payload.summary);
      setShipments(payload.shipments);

      if (selectedShipmentId && !payload.shipments.some((item) => item.id === selectedShipmentId)) {
        setSelectedShipmentId(null);
        setSelectedShipmentDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载国际物流列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadShipmentDetail(shipmentId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<LogisticsShipmentDetail>(`/api/logistics/shipments/${shipmentId}`);
      setSelectedShipmentDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载运输详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleProgress(shipment: LogisticsShipmentRecord) {
    if (!shipment.recommendedAction.nextStatus) {
      return;
    }

    setProgressingShipmentId(shipment.id);

    try {
      const payload = await requestJson<ProgressResponse>(`/api/logistics/shipments/${shipment.id}/progress`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetStatus: shipment.recommendedAction.nextStatus
        })
      });

      setShipments((current) => current.map((item) => (item.id === payload.shipment.id ? payload.shipment : item)));

      if (selectedShipmentId === payload.shipment.id) {
        await loadShipmentDetail(payload.shipment.id);
      }

      if (payload.customsLinked && payload.customsClearance && payload.customsWorkOrder) {
        message.success(
          `已模拟到达目的港，并联动生成清关草稿 ${payload.customsClearance.clearanceNo} / 清关工单 ${payload.customsWorkOrder.workOrderNo}。`
        );
      } else {
        message.success(`运输状态已推进为“${payload.shipment.statusMeta.label}”。`);
      }

      await loadShipments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推进国际物流状态失败。");
    } finally {
      setProgressingShipmentId(null);
    }
  }

  useEffect(() => {
    void loadShipments();
  }, []);

  useEffect(() => {
    if (selectedShipmentId) {
      setSelectedShipmentDetail(null);
      void loadShipmentDetail(selectedShipmentId);
    } else {
      setSelectedShipmentDetail(null);
    }
  }, [selectedShipmentId]);

  const columns: ColumnsType<LogisticsShipmentRecord> = [
    {
      title: "运输批次号",
      dataIndex: "shipmentNo",
      width: 220
    },
    {
      title: "关联合同",
      key: "contractNo",
      width: 220,
      render: (_, record) => record.contract?.contractNo ?? "-"
    },
    {
      title: "关联采购单",
      key: "purchaseNo",
      width: 220,
      render: (_, record) => record.purchaseOrder?.purchaseNo ?? "-"
    },
    {
      title: "船公司 / 提单",
      key: "carrier",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.shippingCompany ?? "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.billOfLadingNo ?? "未补提单"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "柜号",
      dataIndex: "containerNo",
      width: 180,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "起运 / 目的港",
      key: "route",
      width: 260,
      render: (_, record) => `${record.originPort ?? "-"} → ${record.destinationPort ?? "-"}`
    },
    {
      title: "预计到港",
      dataIndex: "estimatedArrivalTime",
      width: 180,
      render: (value: string | null) => formatDate(value)
    },
    {
      title: "运输状态",
      key: "status",
      width: 170,
      render: (_, record) => <Tag color={toneColorMap[record.statusMeta.color]}>{record.statusMeta.label}</Tag>
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
          loading={progressingShipmentId === record.id}
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
        <h2>国际物流</h2>
        <p>
          这里承接“采购与集货”后的运输执行，真实展示运输批次、提单、柜号、起运与到港节点，并在到港后自动把业务上下文交给清关模块。
          这一阶段仍然不会直接改变库存，库存只认二维码扫码入库 / 出库。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="运输批次数" value={summary?.totalShipments ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="待离港" value={summary?.readyToDepartShipments ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="海运中" value={summary?.inTransitShipments ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已联动清关" value={summary?.linkedCustomsClearances ?? 0} suffix="条" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={14}>
          <Alert
            type="info"
            showIcon
            message="阶段 12 演示边界"
            description="国际物流模块真实读取运输批次与运输节点，允许模拟“已离港”和“到达目的港”。到港后会自动生成清关草稿与清关工单，但不会直接影响二维码状态或库存数量。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card
            className="placeholder-card document-table-card"
            title="运输批次列表"
            extra={
              <Space>
                <Button icon={<CarOutlined />} onClick={() => navigate("/procurement")}>
                  查看采购与集货
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadShipments()}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table<LogisticsShipmentRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={shipments}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1800 }}
              rowClassName={(record) => (record.id === selectedShipmentId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedShipmentId(record.id)
              })}
              locale={{
                emptyText: (
                  <Empty description="当前还没有国际物流记录。请先到“采购与集货”把采购单推进到“国内集货完成”，再回到这里查看运输批次。" />
                )
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedShipmentId)}
        onClose={() => setSelectedShipmentId(null)}
        title={selectedShipmentDetail?.shipmentNo ?? selectedShipment?.shipmentNo ?? "运输批次详情"}
        width={screens.xs ? "100%" : 760}
        destroyOnHidden={false}
      >
        {selectedShipmentDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type="success"
              showIcon
              message={selectedShipmentDetail.moduleNarrative.role}
              description={selectedShipmentDetail.moduleNarrative.boundary}
            />

            <Descriptions
              bordered
              size="small"
              column={screens.md ? 2 : 1}
              items={[
                { key: "shipmentNo", label: "运输批次号", children: selectedShipmentDetail.shipmentNo },
                {
                  key: "status",
                  label: "运输状态",
                  children: <Tag color={toneColorMap[selectedShipmentDetail.statusMeta.color]}>{selectedShipmentDetail.statusMeta.label}</Tag>
                },
                {
                  key: "contractNo",
                  label: "合同号",
                  children: selectedShipmentDetail.contract?.contractNo ?? "-"
                },
                {
                  key: "purchaseNo",
                  label: "采购单号",
                  children: selectedShipmentDetail.purchaseOrder?.purchaseNo ?? "-"
                },
                {
                  key: "batchNo",
                  label: "批次号",
                  children: selectedShipmentDetail.batch?.batchNo ?? "-"
                },
                {
                  key: "containerNo",
                  label: "柜号",
                  children: selectedShipmentDetail.containerNo ?? "-"
                },
                {
                  key: "shippingCompany",
                  label: "船公司",
                  children: selectedShipmentDetail.shippingCompany ?? "-"
                },
                {
                  key: "billOfLadingNo",
                  label: "提单号",
                  children: selectedShipmentDetail.billOfLadingNo ?? "-"
                },
                {
                  key: "route",
                  label: "起运 / 目的港",
                  children: `${selectedShipmentDetail.originPort ?? "-"} → ${selectedShipmentDetail.destinationPort ?? "-"}`
                },
                {
                  key: "estimatedArrivalTime",
                  label: "预计到港",
                  children: formatDateTime(selectedShipmentDetail.estimatedArrivalTime)
                },
                {
                  key: "actualArrivalTime",
                  label: "实际到港",
                  children: formatDateTime(selectedShipmentDetail.actualArrivalTime)
                },
                {
                  key: "destinationWarehouse",
                  label: "目的仓库",
                  children: selectedShipmentDetail.contract?.destinationWarehouse ?? "-"
                }
              ]}
            />

            <Card className="placeholder-card procurement-detail-card" title="运输推进状态">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedShipmentDetail.statusMeta.summary}
                </Typography.Paragraph>
                <Alert
                  type={selectedShipmentDetail.recommendedAction.nextStatus ? "info" : "success"}
                  showIcon
                  message={selectedShipmentDetail.recommendedAction.description}
                />
                <Button
                  type="primary"
                  icon={<ScheduleOutlined />}
                  disabled={!selectedShipmentDetail.recommendedAction.nextStatus}
                  loading={progressingShipmentId === selectedShipmentDetail.id}
                  onClick={() => void handleProgress(selectedShipmentDetail)}
                >
                  {selectedShipmentDetail.recommendedAction.buttonText}
                </Button>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="运输节点时间轴">
              <Timeline
                items={selectedShipmentDetail.timeline.map((item) => ({
                  color: toneColorMap[item.tone],
                  children: (
                    <div>
                      <Space wrap>
                        <Tag color={toneColorMap[item.tone]}>{item.label}</Tag>
                        <Typography.Text type="secondary">{formatDateTime(item.time)}</Typography.Text>
                      </Space>
                      <Typography.Paragraph style={{ marginBottom: 0, marginTop: 8 }}>
                        {item.remark ?? (item.completed ? "节点已完成。" : "等待推进到该节点。")}
                      </Typography.Paragraph>
                    </div>
                  )
                }))}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="关联二维码概况">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>总二维码：{selectedShipmentDetail.qrSummary.total} 个</Typography.Text>
                    <Typography.Text>待入库：{selectedShipmentDetail.qrSummary.pendingInbound} 个</Typography.Text>
                    <Typography.Text>在库：{selectedShipmentDetail.qrSummary.inStock} 个</Typography.Text>
                    <Typography.Text>已出库：{selectedShipmentDetail.qrSummary.outbound} 个</Typography.Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="模块定位说明">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>当前模块负责承接国际运输，不直接形成库存。</Typography.Text>
                    <Typography.Text type="secondary">
                      即使运输推进到到港待清关，库存仍然不会自动增加，必须继续走后续扫码入库。
                    </Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card procurement-detail-card" title="关联系统单据">
              <List
                bordered
                dataSource={selectedShipmentDetail.documents}
                locale={{ emptyText: "当前运输批次还没有可展示的关联单据。" }}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <Space wrap>
                        <Tag>{item.documentType}</Tag>
                        <Typography.Text>{item.originalName ?? "未命名单据"}</Typography.Text>
                      </Space>
                      <div className="documents-secondary-text">
                        {item.status} / {item.aiStatus} · {formatDateTime(item.updatedAt)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="联动清关与工单">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {selectedShipmentDetail.linkedCustomsClearance ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "clearanceNo",
                        label: "清关草稿号",
                        children: selectedShipmentDetail.linkedCustomsClearance.clearanceNo
                      },
                      {
                        key: "clearanceStatus",
                        label: "清关状态",
                        children: <Tag color="warning">{selectedShipmentDetail.linkedCustomsClearance.status}</Tag>
                      },
                      {
                        key: "company",
                        label: "责任公司",
                        children: selectedShipmentDetail.linkedCustomsClearance.responsibleCompany ?? "-"
                      },
                      {
                        key: "person",
                        label: "责任人",
                        children: selectedShipmentDetail.linkedCustomsClearance.responsiblePerson ?? "-"
                      }
                    ]}
                  />
                ) : (
                  <Empty description="当前运输批次尚未到港，暂未联动清关草稿。" />
                )}

                {selectedShipmentDetail.linkedLogisticsWorkOrder ? (
                  <>
                    <Divider style={{ margin: "8px 0" }} />
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "logisticsWorkOrderNo",
                          label: "运输安排工单",
                          children: selectedShipmentDetail.linkedLogisticsWorkOrder.workOrderNo
                        },
                        {
                          key: "logisticsWorkOrderStatus",
                          label: "工单状态",
                          children: <Tag color="processing">{selectedShipmentDetail.linkedLogisticsWorkOrder.status}</Tag>
                        }
                      ]}
                    />
                  </>
                ) : null}

                {selectedShipmentDetail.linkedCustomsWorkOrder ? (
                  <>
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "customsWorkOrderNo",
                          label: "清关工单",
                          children: selectedShipmentDetail.linkedCustomsWorkOrder.workOrderNo
                        },
                        {
                          key: "customsWorkOrderStatus",
                          label: "工单状态",
                          children: <Tag color="warning">{selectedShipmentDetail.linkedCustomsWorkOrder.status}</Tag>
                        }
                      ]}
                    />
                  </>
                ) : null}

                <Space wrap>
                  <Button icon={<SafetyCertificateOutlined />} onClick={() => navigate("/customs")}>
                    查看报关清关
                  </Button>
                  <Button icon={<GlobalOutlined />} onClick={() => navigate("/work-orders")}>
                    查看自动工单
                  </Button>
                </Space>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="状态推进历史">
              <List
                bordered
                dataSource={selectedShipmentDetail.history}
                locale={{ emptyText: "当前运输批次还没有状态推进记录。" }}
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
            <Empty description="从运输批次列表中选择一条记录后，这里会显示详情。" />
          </Card>
        )}
      </Drawer>
    </div>
  );
}
