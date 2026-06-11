import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Grid,
  Input,
  List,
  Row,
  Select,
  Segmented,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ReloadOutlined,
  RightCircleOutlined,
  SearchOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type Tone = "default" | "processing" | "success" | "warning" | "error";

type WorkOrderRecord = {
  id: string;
  workOrderNo: string;
  type: string;
  typeMeta: {
    code: string;
    label: string;
    moduleLabel: string;
    moduleRoute: string;
    color: Tone;
    description: string;
    attachmentRequirements: string[];
    executionChecklist: string[];
  };
  title: string;
  content: string | null;
  status: string;
  statusMeta: {
    code: string;
    label: string;
    color: Tone;
    isClosed: boolean;
  };
  priority: string;
  priorityMeta: {
    code: string;
    label: string;
    color: Tone;
    rank: number;
  };
  reminderMeta: {
    code: string;
    label: string;
    color: Tone;
    isOverdue: boolean;
    daysOverdue: number;
    daysUntilDue: number | null;
    rank: number;
  };
  responsibleDepartment: string | null;
  responsiblePerson: string | null;
  startTime: string | null;
  dueTime: string | null;
  createdAt: string;
  updatedAt: string;
  completionCondition: string | null;
  aiSummary: {
    title: string;
    summary: string;
    nextAction: string;
    risk: string;
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
    status: string;
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
    qrSummary: {
      total: number;
      pendingInbound: number;
      inStock: number;
      outbound: number;
      frozen: number;
      damaged: number;
      lost: number;
    };
  } | null;
  mainDocument: {
    id: string;
    documentType: string;
    documentTypeLabel: string;
    originalName: string | null;
    fileName: string;
    status: string;
    aiStatus: string;
    businessCreated: boolean;
    createdAt: string;
    updatedAt: string;
  } | null;
  relatedEntity: {
    entityType: string;
    entityId: string;
    label: string;
    recordNo: string;
    status: string;
    summary: string;
  } | null;
  linkedDocuments: Array<{
    id: string;
    roleLabel: string;
    documentType: string;
    originalName: string | null;
    fileName: string;
    status: string;
    aiStatus: string;
    businessCreated: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  payment: {
    id: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
    receivedAt: string | null;
    paidAt: string | null;
  } | null;
  receivable: {
    id: string;
    amount: number;
    receivedAmount: number;
    currency: string;
    dueDate: string | null;
    status: string;
  } | null;
  traceability: {
    contractId: string | null;
    batchId: string | null;
    documentId: string | null;
    relatedEntityType: string | null;
    relatedEntityId: string | null;
  };
};

type WorkOrderDetail = WorkOrderRecord & {
  moduleNarrative: {
    role: string;
    boundary: string;
  };
  documentRequirements: string[];
  executionChecklist: string[];
  history: Array<{
    id: string;
    action: string;
    operator: string;
    occurredAt: string;
    summary: string;
  }>;
};

type WorkOrdersResponse = {
  summary: {
    total: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completed: number;
    dueSoon: number;
    highPriority: number;
    departments: number;
  };
  filters: {
    statusOptions: Array<{ value: string; label: string; count: number }>;
    typeOptions: Array<{ value: string; label: string; count: number }>;
    departmentOptions: Array<{ value: string; label: string; count: number }>;
  };
  workOrders: WorkOrderRecord[];
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatMoney(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  if (typeof quantity !== "number" || !unit) {
    return "-";
  }

  return `${quantity.toLocaleString("zh-CN")}${unit}`;
}

function formatDocumentType(documentType: string) {
  switch (documentType) {
    case "CONTRACT":
      return "合同";
    case "PACKING_LIST":
      return "箱单";
    case "BILL_OF_LADING":
      return "提单";
    case "INVOICE":
      return "发票";
    default:
      return "其他单据";
  }
}

export function WorkOrdersPage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<WorkOrdersResponse["summary"] | null>(null);
  const [filters, setFilters] = useState<WorkOrdersResponse["filters"] | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderRecord[]>([]);
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null);
  const [selectedWorkOrderDetail, setSelectedWorkOrderDetail] = useState<WorkOrderDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const deferredKeyword = useDeferredValue(keyword.trim().toLowerCase());

  const selectedWorkOrder = useMemo(
    () => workOrders.find((item) => item.id === selectedWorkOrderId) ?? null,
    [selectedWorkOrderId, workOrders]
  );

  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((item) => {
      if (statusFilter === "PENDING" && item.status !== "PENDING") {
        return false;
      }

      if (statusFilter === "IN_PROGRESS" && item.status !== "IN_PROGRESS") {
        return false;
      }

      if (statusFilter === "OVERDUE" && !item.reminderMeta.isOverdue) {
        return false;
      }

      if (statusFilter === "COMPLETED" && !item.statusMeta.isClosed) {
        return false;
      }

      if (typeFilter !== "ALL" && item.type !== typeFilter) {
        return false;
      }

      if (departmentFilter !== "ALL" && item.responsibleDepartment !== departmentFilter) {
        return false;
      }

      if (!deferredKeyword) {
        return true;
      }

      const haystack = [
        item.workOrderNo,
        item.title,
        item.typeMeta.label,
        item.typeMeta.moduleLabel,
        item.responsibleDepartment,
        item.responsiblePerson,
        item.contract?.contractNo,
        item.batch?.batchNo,
        item.relatedEntity?.recordNo,
        item.mainDocument?.originalName,
        ...item.linkedDocuments.map((document) => document.originalName ?? document.fileName)
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredKeyword);
    });
  }, [departmentFilter, deferredKeyword, statusFilter, typeFilter, workOrders]);

  async function loadWorkOrders() {
    setIsLoading(true);

    try {
      const payload = await requestJson<WorkOrdersResponse>("/api/work-orders");
      setSummary(payload.summary);
      setFilters(payload.filters);
      setWorkOrders(payload.workOrders);

      if (selectedWorkOrderId && !payload.workOrders.some((item) => item.id === selectedWorkOrderId)) {
        setSelectedWorkOrderId(null);
        setSelectedWorkOrderDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载自动工单失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadWorkOrderDetail(workOrderId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<WorkOrderDetail>(`/api/work-orders/${workOrderId}`);
      setSelectedWorkOrderDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载工单详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  function openWorkOrderDetail(workOrderId: string) {
    setSelectedWorkOrderId(workOrderId);
    setSelectedWorkOrderDetail(null);
    void loadWorkOrderDetail(workOrderId);
  }

  useEffect(() => {
    void loadWorkOrders();
  }, []);

  const columns: ColumnsType<WorkOrderRecord> = [
    {
      title: "工单",
      key: "workOrder",
      width: 250,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Button type="link" style={{ padding: 0 }} onClick={() => openWorkOrderDetail(record.id)}>
            {record.workOrderNo}
          </Button>
          <Typography.Text strong>{record.title}</Typography.Text>
          <Typography.Text type="secondary">{record.typeMeta.moduleLabel}</Typography.Text>
        </Space>
      )
    },
    {
      title: "类型 / 优先级",
      key: "type",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.typeMeta.color}>{record.typeMeta.label}</Tag>
          <Tag color={record.priorityMeta.color}>{record.priorityMeta.label}</Tag>
        </Space>
      )
    },
    {
      title: "状态 / 提醒",
      key: "status",
      width: 180,
      render: (_, record) => (
        <Space direction="vertical" size={6}>
          <Tag color={record.statusMeta.color}>{record.statusMeta.label}</Tag>
          <Tag color={record.reminderMeta.color}>{record.reminderMeta.label}</Tag>
        </Space>
      )
    },
    {
      title: "责任部门 / 人",
      key: "owner",
      width: 180,
      render: (_, record) => `${record.responsibleDepartment ?? "-"} / ${record.responsiblePerson ?? "-"}`
    },
    {
      title: "关联合同 / 批次",
      key: "business",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{record.contract?.contractNo ?? "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.batch?.batchNo ?? "-"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "关联任务",
      key: "relatedEntity",
      width: 220,
      render: (_, record) =>
        record.relatedEntity ? (
          <Space direction="vertical" size={2}>
            <Typography.Text>{record.relatedEntity.label}</Typography.Text>
            <Typography.Text type="secondary">{record.relatedEntity.recordNo}</Typography.Text>
          </Space>
        ) : (
          "-"
        )
    },
    {
      title: "截止时间",
      dataIndex: "dueTime",
      key: "dueTime",
      width: 180,
      render: (value: string | null) => formatDateTime(value)
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => openWorkOrderDetail(record.id)}>
            查看详情
          </Button>
          <Button type="link" onClick={() => navigate(record.typeMeta.moduleRoute)}>
            前往模块
          </Button>
        </Space>
      )
    }
  ];

  const quickRules = [
    "采购下单后，系统应自动跟进供应商发货与国内集货。",
    "国内集货完成后，系统自动把任务交给国际物流安排。",
    "货物到港后，系统自动生成清关任务并要求核对单据。",
    "清关完成后，系统自动推送境外陆运与仓库预收货。",
    "销售与回款阶段的工单继续承接出库、配送与财务闭环。"
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: "100%" }}>
      <Alert
        showIcon
        type="info"
        message="自动工单模块是系统核心"
        description="这一页不只是展示任务列表，而是把采购、物流、清关、仓储、销售、财务这些环节里的真实任务统一收口，让每个节点都能做到责任到人、截止可提醒、结果可追溯。"
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card">
            <Statistic title="工单总数" value={summary?.total ?? 0} suffix="张" />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card">
            <Statistic title="待办 / 处理中" value={`${summary?.pending ?? 0} / ${summary?.inProgress ?? 0}`} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card">
            <Statistic title="已逾期 / 即将到期" value={`${summary?.overdue ?? 0} / ${summary?.dueSoon ?? 0}`} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="stat-card">
            <Statistic title="已完成 / 高优先级" value={`${summary?.completed ?? 0} / ${summary?.highPriority ?? 0}`} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
          <Card
            className="placeholder-card"
            title="统一工单中心"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadWorkOrders()}>
                刷新
              </Button>
            }
          >
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Segmented
                  block={!screens.md}
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(String(value))}
                  options={
                    filters?.statusOptions.map((item) => ({
                      label: `${item.label} (${item.count})`,
                      value: item.value
                    })) ?? []
                  }
                />

                <Space wrap>
                  <Input
                    allowClear
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="搜索工单号、标题、合同号、批次号"
                    prefix={<SearchOutlined />}
                    style={{ width: screens.md ? 320 : "100%" }}
                  />
                  <Select
                    value={typeFilter}
                    onChange={setTypeFilter}
                    style={{ minWidth: 220 }}
                    options={[
                      { value: "ALL", label: "全部工单类型" },
                      ...((filters?.typeOptions ?? []).map((item) => ({
                        value: item.value,
                        label: `${item.label} (${item.count})`
                      })) as Array<{ value: string; label: string }>)
                    ]}
                  />
                  <Select
                    value={departmentFilter}
                    onChange={setDepartmentFilter}
                    style={{ minWidth: 180 }}
                    options={[
                      { value: "ALL", label: "全部责任部门" },
                      ...((filters?.departmentOptions ?? []).map((item) => ({
                        value: item.value,
                        label: `${item.label} (${item.count})`
                      })) as Array<{ value: string; label: string }>)
                    ]}
                  />
                </Space>
              </Space>

              <Table<WorkOrderRecord>
                rowKey="id"
                loading={isLoading}
                columns={columns}
                dataSource={filteredWorkOrders}
                pagination={{ pageSize: 8, showSizeChanger: false }}
                scroll={{ x: 1500 }}
                rowClassName={(record) =>
                  record.id === selectedWorkOrderId ? "documents-table-row-selected" : ""
                }
                locale={{
                  emptyText: <Empty description="当前没有符合筛选条件的工单。" />
                }}
                onRow={(record) => ({
                  onClick: () => openWorkOrderDetail(record.id)
                })}
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card className="placeholder-card" title="自动建单规则">
              <List
                dataSource={quickRules}
                renderItem={(item, index) => (
                  <List.Item>
                    <Typography.Text>
                      {index + 1}. {item}
                    </Typography.Text>
                  </List.Item>
                )}
              />
            </Card>

            <Card className="placeholder-card" title="提醒与闭环原则">
              <List
                dataSource={[
                  "待办实时提醒：优先展示未闭环任务。",
                  "即将逾期提醒：距离截止 3 天内自动高亮。",
                  "已逾期强预警：逾期任务直接归到高风险视角。",
                  "所有动作留痕：详情中保留关联业务历史。",
                  "核心目标：让系统工单代替人工口头沟通。"
                ]}
                renderItem={(item) => (
                  <List.Item>
                    <Typography.Text>{item}</Typography.Text>
                  </List.Item>
                )}
              />
            </Card>
          </Space>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedWorkOrderId)}
        onClose={() => {
          setSelectedWorkOrderId(null);
          setSelectedWorkOrderDetail(null);
        }}
        width={screens.lg ? 760 : "100%"}
        title={selectedWorkOrderDetail?.workOrderNo ?? selectedWorkOrder?.workOrderNo ?? "工单详情"}
      >
        {selectedWorkOrderDetail ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Alert
              showIcon
              type={selectedWorkOrderDetail.reminderMeta.isOverdue ? "error" : "info"}
              message={selectedWorkOrderDetail.aiSummary.title}
              description={selectedWorkOrderDetail.aiSummary.nextAction}
            />

            <Card
              className="placeholder-card"
              title={selectedWorkOrderDetail.title}
              extra={
                <Space wrap>
                  <Tag color={selectedWorkOrderDetail.typeMeta.color}>{selectedWorkOrderDetail.typeMeta.label}</Tag>
                  <Tag color={selectedWorkOrderDetail.statusMeta.color}>{selectedWorkOrderDetail.statusMeta.label}</Tag>
                  <Tag color={selectedWorkOrderDetail.priorityMeta.color}>
                    {selectedWorkOrderDetail.priorityMeta.label}
                  </Tag>
                </Space>
              }
            >
              <Descriptions
                column={1}
                items={[
                  {
                    key: "owner",
                    label: "责任部门 / 人",
                    children: `${selectedWorkOrderDetail.responsibleDepartment ?? "-"} / ${
                      selectedWorkOrderDetail.responsiblePerson ?? "-"
                    }`
                  },
                  {
                    key: "module",
                    label: "归属模块",
                    children: selectedWorkOrderDetail.typeMeta.moduleLabel
                  },
                  {
                    key: "due",
                    label: "当前提醒",
                    children: (
                      <Tag color={selectedWorkOrderDetail.reminderMeta.color}>
                        {selectedWorkOrderDetail.reminderMeta.label}
                      </Tag>
                    )
                  },
                  {
                    key: "start",
                    label: "开始时间",
                    children: formatDateTime(selectedWorkOrderDetail.startTime)
                  },
                  {
                    key: "dueAt",
                    label: "截止时间",
                    children: formatDateTime(selectedWorkOrderDetail.dueTime)
                  },
                  {
                    key: "condition",
                    label: "完成确认条件",
                    children: selectedWorkOrderDetail.completionCondition ?? "待补充"
                  },
                  {
                    key: "content",
                    label: "任务内容",
                    children: selectedWorkOrderDetail.content ?? "当前工单使用系统模板说明。"
                  }
                ]}
              />
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card className="placeholder-card" title="AI 模板说明">
                  <Space direction="vertical" size={10} style={{ width: "100%" }}>
                    <Typography.Text>{selectedWorkOrderDetail.aiSummary.summary}</Typography.Text>
                    <Alert showIcon type="warning" message="主要风险" description={selectedWorkOrderDetail.aiSummary.risk} />
                    <Alert showIcon type="success" message="建议下一步" description={selectedWorkOrderDetail.aiSummary.nextAction} />
                  </Space>
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card className="placeholder-card" title="模块作用与边界">
                  <List
                    dataSource={[
                      selectedWorkOrderDetail.moduleNarrative.role,
                      selectedWorkOrderDetail.moduleNarrative.boundary,
                      selectedWorkOrderDetail.typeMeta.description
                    ]}
                    renderItem={(item) => (
                      <List.Item>
                        <Typography.Text>{item}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card" title="业务上下文与追溯">
              <Descriptions
                column={1}
                items={[
                  {
                    key: "contract",
                    label: "关联合同",
                    children: selectedWorkOrderDetail.contract
                      ? `${selectedWorkOrderDetail.contract.contractNo} / ${selectedWorkOrderDetail.contract.productName} / ${formatQuantity(
                          selectedWorkOrderDetail.contract.totalQuantity,
                          selectedWorkOrderDetail.contract.unit
                        )}`
                      : "-"
                  },
                  {
                    key: "batch",
                    label: "关联批次",
                    children: selectedWorkOrderDetail.batch
                      ? `${selectedWorkOrderDetail.batch.batchNo} / ${selectedWorkOrderDetail.batch.destinationWarehouse}`
                      : "-"
                  },
                  {
                    key: "qrSummary",
                    label: "二维码状态",
                    children: selectedWorkOrderDetail.batch
                      ? `总 ${selectedWorkOrderDetail.batch.qrSummary.total} / 在库 ${selectedWorkOrderDetail.batch.qrSummary.inStock} / 已出库 ${selectedWorkOrderDetail.batch.qrSummary.outbound}`
                      : "-"
                  },
                  {
                    key: "entity",
                    label: "关联业务实体",
                    children: selectedWorkOrderDetail.relatedEntity
                      ? `${selectedWorkOrderDetail.relatedEntity.label} ${selectedWorkOrderDetail.relatedEntity.recordNo} / ${selectedWorkOrderDetail.relatedEntity.summary}`
                      : "-"
                  },
                  {
                    key: "receivable",
                    label: "应收 / 回款",
                    children: selectedWorkOrderDetail.receivable
                      ? `${formatMoney(
                          selectedWorkOrderDetail.receivable.amount,
                          selectedWorkOrderDetail.receivable.currency
                        )} / 已收 ${formatMoney(
                          selectedWorkOrderDetail.receivable.receivedAmount,
                          selectedWorkOrderDetail.receivable.currency
                        )}`
                      : selectedWorkOrderDetail.payment
                        ? `${formatMoney(
                            selectedWorkOrderDetail.payment.receivableAmount,
                            selectedWorkOrderDetail.payment.currency
                          )} / 已收 ${formatMoney(
                            selectedWorkOrderDetail.payment.receivedAmount,
                            selectedWorkOrderDetail.payment.currency
                          )}`
                        : "-"
                  }
                ]}
              />

              {selectedWorkOrderDetail.linkedDocuments.length > 0 ? (
                <List
                  header="关联单据"
                  dataSource={selectedWorkOrderDetail.linkedDocuments}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" size={2}>
                        <Space wrap>
                          <Tag>{item.roleLabel}</Tag>
                          <Tag color="default">{formatDocumentType(item.documentType)}</Tag>
                          <Tag color={item.businessCreated ? "success" : "warning"}>
                            {item.businessCreated ? "已生成业务" : "草稿单据"}
                          </Tag>
                        </Space>
                        <Typography.Text>{item.originalName ?? item.fileName}</Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : null}
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Card className="placeholder-card" title="附件要求">
                  <List
                    dataSource={selectedWorkOrderDetail.documentRequirements}
                    renderItem={(item) => (
                      <List.Item>
                        <Typography.Text>{item}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={12}>
                <Card className="placeholder-card" title="执行清单">
                  <List
                    dataSource={selectedWorkOrderDetail.executionChecklist}
                    renderItem={(item) => (
                      <List.Item>
                        <Typography.Text>{item}</Typography.Text>
                      </List.Item>
                    )}
                  />
                </Card>
              </Col>
            </Row>

            <Card
              className="placeholder-card"
              title="历史留痕"
              extra={
                <Button
                  icon={<RightCircleOutlined />}
                  onClick={() => navigate(selectedWorkOrderDetail.typeMeta.moduleRoute)}
                >
                  前往关联系统模块
                </Button>
              }
            >
              {selectedWorkOrderDetail.history.length > 0 ? (
                <List
                  dataSource={selectedWorkOrderDetail.history}
                  renderItem={(item) => (
                    <List.Item>
                      <Space direction="vertical" size={2}>
                        <Typography.Text strong>{item.summary}</Typography.Text>
                        <Typography.Text type="secondary">
                          {item.operator} · {formatDateTime(item.occurredAt)} · {item.action}
                        </Typography.Text>
                      </Space>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="当前工单还没有更多业务留痕。" />
              )}
            </Card>
          </Space>
        ) : (
          <Card className="placeholder-card" loading={isDetailLoading}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                selectedWorkOrderId ? "正在加载工单详情..." : "从左侧工单列表中选择一张工单，这里会展示完整上下文。"
              }
            />
          </Card>
        )}
      </Drawer>
    </Space>
  );
}
