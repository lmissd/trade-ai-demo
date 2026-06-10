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
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  GlobalOutlined,
  InboxOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type CustomsStatus = "PENDING" | "COMPLETED";
type CustomsTagColor = "default" | "success";

type LinkedDocument = {
  id: string;
  documentType: string;
  originalName: string | null;
  status: string;
  aiStatus: string;
  businessCreated: boolean;
  createdAt: string;
  updatedAt: string;
} | null;

type LinkedWorkOrder = {
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

type CustomsClearanceRecord = {
  id: string;
  clearanceNo: string;
  status: CustomsStatus;
  statusMeta: {
    label: string;
    color: CustomsTagColor;
    summary: string;
  };
  responsibleCompany: string | null;
  responsiblePerson: string | null;
  createdAt: string;
  updatedAt: string;
  contract: {
    id: string;
    contractNo: string;
    customerName: string;
    supplierName: string;
    productName: string;
    totalQuantity: number;
    unit: string;
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
    warehouseId: string | null;
  } | null;
  shipment: {
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
    status: string;
  } | null;
  documents: {
    packingList: LinkedDocument;
    invoice: LinkedDocument;
    billOfLading: LinkedDocument;
    certificate: LinkedDocument;
  };
  aiCheckResult: {
    packingListQuantity: string | null;
    invoiceQuantity: string | null;
    billOfLadingContainerNo: string | null;
    aiConclusion: string;
  };
  linkedCustomsWorkOrder: LinkedWorkOrder;
  linkedLandTransportWorkOrder: LinkedWorkOrder;
  linkedPreReceiveOrder: {
    id: string;
    preReceiveNo: string;
    expectedArrivalTime: string | null;
    skuName: string;
    quantity: number;
    unit: string;
    suggestedLocation: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedWarehousePreReceiveWorkOrder: LinkedWorkOrder;
  recommendedAction: {
    canComplete: boolean;
    buttonText: string;
    description: string;
  };
};

type CustomsClearancesResponse = {
  summary: {
    totalClearances: number;
    pendingClearances: number;
    completedClearances: number;
    linkedPreReceiveOrders: number;
  };
  clearances: CustomsClearanceRecord[];
};

type CustomsClearanceDetail = CustomsClearanceRecord & {
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

type CompleteResponse = {
  completed: true;
  clearance: CustomsClearanceRecord;
  preReceiveOrder: {
    id: string;
    preReceiveNo: string;
    status: string;
  } | null;
  landTransportWorkOrder: {
    id: string;
    workOrderNo: string;
    status: string;
  } | null;
  warehousePreReceiveWorkOrder: {
    id: string;
    workOrderNo: string;
    status: string;
  } | null;
};

const toneColorMap: Record<CustomsTagColor, "default" | "success"> = {
  default: "default",
  success: "success"
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

function resolveDocumentTypeLabel(documentType?: string | null) {
  switch (documentType) {
    case "CONTRACT":
      return "合同";
    case "PACKING_LIST":
      return "箱单";
    case "INVOICE":
      return "发票";
    case "BILL_OF_LADING":
      return "提单";
    case "CERTIFICATE":
      return "产地证";
    default:
      return documentType ?? "单据";
  }
}

function getAiCheckAlertType(record: CustomsClearanceRecord): "success" | "warning" {
  const packingListQuantity = record.aiCheckResult.packingListQuantity;
  const invoiceQuantity = record.aiCheckResult.invoiceQuantity;

  if (packingListQuantity && invoiceQuantity && packingListQuantity === invoiceQuantity) {
    return "success";
  }

  return "warning";
}

export function CustomsPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CustomsClearancesResponse["summary"] | null>(null);
  const [clearances, setClearances] = useState<CustomsClearanceRecord[]>([]);
  const [selectedClearanceId, setSelectedClearanceId] = useState<string | null>(null);
  const [selectedClearanceDetail, setSelectedClearanceDetail] = useState<CustomsClearanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [completingClearanceId, setCompletingClearanceId] = useState<string | null>(null);

  const selectedClearance = useMemo(
    () => clearances.find((item) => item.id === selectedClearanceId) ?? null,
    [clearances, selectedClearanceId]
  );

  async function loadClearances() {
    setIsLoading(true);

    try {
      const payload = await requestJson<CustomsClearancesResponse>("/api/customs/clearances");
      setSummary(payload.summary);
      setClearances(payload.clearances);

      if (selectedClearanceId && !payload.clearances.some((item) => item.id === selectedClearanceId)) {
        setSelectedClearanceId(null);
        setSelectedClearanceDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载报关清关列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadClearanceDetail(clearanceId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<CustomsClearanceDetail>(`/api/customs/clearances/${clearanceId}`);
      setSelectedClearanceDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载清关详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleComplete(clearance: CustomsClearanceRecord) {
    if (!clearance.recommendedAction.canComplete) {
      return;
    }

    setCompletingClearanceId(clearance.id);

    try {
      const payload = await requestJson<CompleteResponse>(`/api/customs/clearances/${clearance.id}/complete`, {
        method: "POST"
      });

      setClearances((current) => current.map((item) => (item.id === payload.clearance.id ? payload.clearance : item)));

      if (selectedClearanceId === payload.clearance.id) {
        await loadClearanceDetail(payload.clearance.id);
      }

      message.success(
        `已模拟清关完成，并联动生成 ${payload.preReceiveOrder?.preReceiveNo ?? "预收货单"}、${payload.landTransportWorkOrder?.workOrderNo ?? "境外陆运工单"} 与 ${payload.warehousePreReceiveWorkOrder?.workOrderNo ?? "仓库预收货工单"}。`
      );

      await loadClearances();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "推进清关状态失败。");
    } finally {
      setCompletingClearanceId(null);
    }
  }

  useEffect(() => {
    void loadClearances();
  }, []);

  useEffect(() => {
    if (selectedClearanceId) {
      setSelectedClearanceDetail(null);
      void loadClearanceDetail(selectedClearanceId);
    } else {
      setSelectedClearanceDetail(null);
    }
  }, [selectedClearanceId]);

  const columns: ColumnsType<CustomsClearanceRecord> = [
    {
      title: "清关工单号",
      dataIndex: "clearanceNo",
      width: 220
    },
    {
      title: "关联合同",
      key: "contractNo",
      width: 220,
      render: (_, record) => record.contract?.contractNo ?? "-"
    },
    {
      title: "关联批次",
      key: "batchNo",
      width: 220,
      render: (_, record) => record.batch?.batchNo ?? "-"
    },
    {
      title: "责任公司 / 人",
      key: "owner",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.responsibleCompany ?? "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.responsiblePerson ?? "待分配"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "提单 / 柜号",
      key: "bl",
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.shipment?.billOfLadingNo ?? "待补提单"}</Typography.Text>
          <Typography.Text type="secondary">{record.shipment?.containerNo ?? "待补柜号"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "AI 一致性结论",
      key: "aiConclusion",
      width: 260,
      render: (_, record) => record.aiCheckResult.aiConclusion
    },
    {
      title: "清关状态",
      key: "status",
      width: 160,
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
          disabled={!record.recommendedAction.canComplete}
          loading={completingClearanceId === record.id}
          onClick={(event) => {
            event.stopPropagation();
            void handleComplete(record);
          }}
        >
          {record.recommendedAction.buttonText}
        </Button>
      )
    }
  ];

  const documentList = selectedClearanceDetail
    ? [
        selectedClearanceDetail.documents.packingList,
        selectedClearanceDetail.documents.invoice,
        selectedClearanceDetail.documents.billOfLading,
        selectedClearanceDetail.documents.certificate
      ].filter((item): item is Exclude<typeof item, null> => Boolean(item))
    : [];

  return (
    <div className="document-workspace procurement-workspace">
      <section className="page-hero">
        <h2>报关清关</h2>
        <p>
          这里承接国际物流“到港待清关”后的业务动作，真实展示清关草稿、责任主体、单据一致性检查结果，以及清关完成后联动出的境外陆运与仓库预收货任务。
          这一阶段依旧不会直接改库存，库存只认二维码扫码入库 / 出库。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="清关记录总数" value={summary?.totalClearances ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="待清关" value={summary?.pendingClearances ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已完成清关" value={summary?.completedClearances ?? 0} suffix="条" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已联动预收货" value={summary?.linkedPreReceiveOrders ?? 0} suffix="条" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={14}>
          <Alert
            type="info"
            showIcon
            message="阶段 13 演示边界"
            description="报关清关模块真实读取清关记录与 AI 单据一致性结果，允许“模拟清关完成”，并自动生成境外陆运任务、仓库预收货单与预收货工单。第一版不接真实海关接口，也不会直接写入 QrItem 或 StockMovement。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card
            className="placeholder-card document-table-card"
            title="清关记录列表"
            extra={
              <Space>
                <Button icon={<GlobalOutlined />} onClick={() => navigate("/logistics")}>
                  查看国际物流
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadClearances()}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table<CustomsClearanceRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={clearances}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1760 }}
              rowClassName={(record) => (record.id === selectedClearanceId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedClearanceId(record.id)
              })}
              locale={{
                emptyText: (
                  <Empty description="当前还没有清关记录。请先到“国际物流”把运输批次推进到“到港待清关”，系统才会自动生成这里的清关草稿。" />
                )
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedClearanceId)}
        onClose={() => setSelectedClearanceId(null)}
        title={selectedClearanceDetail?.clearanceNo ?? selectedClearance?.clearanceNo ?? "清关详情"}
        width={screens.xs ? "100%" : 760}
        destroyOnHidden={false}
      >
        {selectedClearanceDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type="success"
              showIcon
              message={selectedClearanceDetail.moduleNarrative.role}
              description={selectedClearanceDetail.moduleNarrative.boundary}
            />

            <Descriptions
              bordered
              size="small"
              column={screens.md ? 2 : 1}
              items={[
                { key: "clearanceNo", label: "清关工单号", children: selectedClearanceDetail.clearanceNo },
                {
                  key: "status",
                  label: "清关状态",
                  children: (
                    <Tag color={toneColorMap[selectedClearanceDetail.statusMeta.color]}>
                      {selectedClearanceDetail.statusMeta.label}
                    </Tag>
                  )
                },
                {
                  key: "contractNo",
                  label: "关联合同",
                  children: selectedClearanceDetail.contract?.contractNo ?? "-"
                },
                {
                  key: "batchNo",
                  label: "关联批次",
                  children: selectedClearanceDetail.batch?.batchNo ?? "-"
                },
                {
                  key: "responsibleCompany",
                  label: "责任公司",
                  children: selectedClearanceDetail.responsibleCompany ?? "-"
                },
                {
                  key: "responsiblePerson",
                  label: "责任人",
                  children: selectedClearanceDetail.responsiblePerson ?? "-"
                },
                {
                  key: "shipmentNo",
                  label: "运输批次号",
                  children: selectedClearanceDetail.shipment?.shipmentNo ?? "-"
                },
                {
                  key: "route",
                  label: "起运 / 目的港",
                  children: `${selectedClearanceDetail.shipment?.originPort ?? "-"} -> ${selectedClearanceDetail.shipment?.destinationPort ?? "-"}`
                },
                {
                  key: "warehouse",
                  label: "目标仓库",
                  children: selectedClearanceDetail.contract?.destinationWarehouse ?? "-"
                },
                {
                  key: "bl",
                  label: "提单号",
                  children: selectedClearanceDetail.shipment?.billOfLadingNo ?? "-"
                },
                {
                  key: "containerNo",
                  label: "柜号",
                  children:
                    selectedClearanceDetail.aiCheckResult.billOfLadingContainerNo ??
                    selectedClearanceDetail.shipment?.containerNo ??
                    "-"
                },
                {
                  key: "amount",
                  label: "合同金额",
                  children: selectedClearanceDetail.contract
                    ? formatAmount(selectedClearanceDetail.contract.amount, selectedClearanceDetail.contract.currency)
                    : "-"
                }
              ]}
            />

            <Card className="placeholder-card procurement-detail-card" title="清关推进状态">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  {selectedClearanceDetail.statusMeta.summary}
                </Typography.Paragraph>
                <Alert
                  type={selectedClearanceDetail.recommendedAction.canComplete ? "info" : "success"}
                  showIcon
                  message={selectedClearanceDetail.recommendedAction.description}
                />
                <Button
                  type="primary"
                  icon={<SafetyCertificateOutlined />}
                  disabled={!selectedClearanceDetail.recommendedAction.canComplete}
                  loading={completingClearanceId === selectedClearanceDetail.id}
                  onClick={() => void handleComplete(selectedClearanceDetail)}
                >
                  {selectedClearanceDetail.recommendedAction.buttonText}
                </Button>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="AI 单据一致性检查结果">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: "packingListQuantity",
                      label: "箱单数量",
                      children: selectedClearanceDetail.aiCheckResult.packingListQuantity ?? "-"
                    },
                    {
                      key: "invoiceQuantity",
                      label: "发票数量",
                      children: selectedClearanceDetail.aiCheckResult.invoiceQuantity ?? "-"
                    },
                    {
                      key: "billOfLadingContainerNo",
                      label: "提单柜号",
                      children:
                        selectedClearanceDetail.aiCheckResult.billOfLadingContainerNo ??
                        selectedClearanceDetail.shipment?.containerNo ??
                        "-"
                    }
                  ]}
                />
                <Alert
                  type={getAiCheckAlertType(selectedClearanceDetail)}
                  showIcon
                  message={selectedClearanceDetail.aiCheckResult.aiConclusion}
                />
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="关联系统单据">
              <List
                bordered
                dataSource={documentList}
                locale={{ emptyText: "当前清关记录还没有关联系统单据。" }}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <Space wrap>
                        <Tag>{resolveDocumentTypeLabel(item.documentType)}</Tag>
                        <Typography.Text>{item.originalName ?? "未命名单据"}</Typography.Text>
                      </Space>
                      <div className="documents-secondary-text">
                        {item.status} / {item.aiStatus} / {item.businessCreated ? "已生成业务数据" : "草稿"} /{" "}
                        {formatDateTime(item.updatedAt)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="预收货承接">
                  {selectedClearanceDetail.linkedPreReceiveOrder ? (
                    <Space direction="vertical" size="small" style={{ width: "100%" }}>
                      <Typography.Text>
                        预收货单号：{selectedClearanceDetail.linkedPreReceiveOrder.preReceiveNo}
                      </Typography.Text>
                      <Typography.Text>
                        SKU / 数量：{selectedClearanceDetail.linkedPreReceiveOrder.skuName} /{" "}
                        {selectedClearanceDetail.linkedPreReceiveOrder.quantity}
                        {selectedClearanceDetail.linkedPreReceiveOrder.unit}
                      </Typography.Text>
                      <Typography.Text>
                        预计到仓：{formatDateTime(selectedClearanceDetail.linkedPreReceiveOrder.expectedArrivalTime)}
                      </Typography.Text>
                      <Typography.Text>
                        建议库位：{selectedClearanceDetail.linkedPreReceiveOrder.suggestedLocation ?? "-"}
                      </Typography.Text>
                      <Typography.Text>
                        状态：{selectedClearanceDetail.linkedPreReceiveOrder.status}
                      </Typography.Text>
                    </Space>
                  ) : (
                    <Empty description="当前还没有联动预收货单。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  )}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="模块定位说明">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      当前模块负责把“到港待清关”推进到“已完成清关”，并把业务上下文交给后续陆运与仓储承接。
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      即使这里已经完成清关，系统库存仍然不会自动增加；必须等仓库扫码入库以后，库存才会发生真实变化。
                    </Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card procurement-detail-card" title="联动工单与后续任务">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {selectedClearanceDetail.linkedCustomsWorkOrder ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "customsWorkOrderNo",
                        label: "清关工单",
                        children: selectedClearanceDetail.linkedCustomsWorkOrder.workOrderNo
                      },
                      {
                        key: "customsWorkOrderStatus",
                        label: "工单状态",
                        children: <Tag color="processing">{selectedClearanceDetail.linkedCustomsWorkOrder.status}</Tag>
                      }
                    ]}
                  />
                ) : null}

                {selectedClearanceDetail.linkedLandTransportWorkOrder ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "landWorkOrderNo",
                        label: "境外陆运任务",
                        children: selectedClearanceDetail.linkedLandTransportWorkOrder.workOrderNo
                      },
                      {
                        key: "landWorkOrderStatus",
                        label: "任务状态",
                        children: <Tag color="warning">{selectedClearanceDetail.linkedLandTransportWorkOrder.status}</Tag>
                      },
                      {
                        key: "landWorkOrderOwner",
                        label: "责任部门 / 人",
                        children: `${selectedClearanceDetail.linkedLandTransportWorkOrder.responsibleDepartment ?? "-"} / ${selectedClearanceDetail.linkedLandTransportWorkOrder.responsiblePerson ?? "-"}`
                      }
                    ]}
                  />
                ) : null}

                {selectedClearanceDetail.linkedWarehousePreReceiveWorkOrder ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "warehouseWorkOrderNo",
                        label: "仓库预收货工单",
                        children: selectedClearanceDetail.linkedWarehousePreReceiveWorkOrder.workOrderNo
                      },
                      {
                        key: "warehouseWorkOrderStatus",
                        label: "工单状态",
                        children: (
                          <Tag color="warning">
                            {selectedClearanceDetail.linkedWarehousePreReceiveWorkOrder.status}
                          </Tag>
                        )
                      },
                      {
                        key: "warehouseDueTime",
                        label: "截止时间",
                        children: formatDateTime(selectedClearanceDetail.linkedWarehousePreReceiveWorkOrder.dueTime)
                      }
                    ]}
                  />
                ) : null}

                {!selectedClearanceDetail.linkedLandTransportWorkOrder &&
                !selectedClearanceDetail.linkedWarehousePreReceiveWorkOrder ? (
                  <Empty description="当前清关尚未联动出后续任务。" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : null}

                <Divider style={{ margin: "8px 0" }} />

                <Space wrap>
                  <Button icon={<GlobalOutlined />} onClick={() => navigate("/logistics")}>
                    回看国际物流
                  </Button>
                  <Button icon={<InboxOutlined />} onClick={() => navigate("/warehouse")}>
                    查看仓储管理
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
                dataSource={selectedClearanceDetail.history}
                locale={{ emptyText: "当前清关记录还没有状态推进历史。" }}
                renderItem={(item) => (
                  <List.Item>
                    <div style={{ width: "100%" }}>
                      <div>{item.summary}</div>
                      <div className="documents-secondary-text">
                        {item.operator} / {formatDateTime(item.occurredAt)}
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        ) : (
          <Card className="placeholder-card" loading={isDetailLoading}>
            <Empty description="从清关记录列表中选择一条记录后，这里会显示详情。" />
          </Card>
        )}
      </Drawer>
    </div>
  );
}
