import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
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
import { DollarCircleOutlined, ReloadOutlined, SolutionOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { requestJson } from "../lib/api";

type FinanceRecord = {
  id: string;
  amount: number;
  currency: string;
  dueDate: string | null;
  receivedAmount: number;
  openAmount: number;
  createdAt: string;
  updatedAt: string;
  scope: "SALES_ORDER" | "CONTRACT";
  scopeLabel: string;
  status: string;
  statusMeta: {
    code: string;
    label: string;
    color: "default" | "processing" | "success" | "warning" | "error";
    openAmount: number;
  };
  overdueMeta: {
    code: string;
    label: string;
    color: "default" | "processing" | "success" | "warning" | "error";
    daysOverdue: number;
    daysUntilDue: number | null;
  };
  reconciliationMeta: {
    code: string;
    label: string;
    color: "default" | "processing" | "success";
  };
  recommendedAction: {
    canCollectPartial: boolean;
    canCollectFull: boolean;
    partialAmount: number;
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
    contractStatus: string;
  } | null;
  salesOrder: {
    id: string;
    salesNo: string;
    customerName: string;
    skuName: string;
    quantity: number;
    unit: string;
    amount: number;
    currency: string;
    deliveryStatus: string;
    signStatus: string;
    status: string;
  } | null;
  batch: {
    id: string;
    batchNo: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
    status: string;
  } | null;
  payment: {
    id: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
    receivedAt: string | null;
    paidAt: string | null;
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
};

type FinanceSummary = {
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

type FinanceListResponse = {
  summary: FinanceSummary;
  receivables: FinanceRecord[];
};

type FinanceDetail = FinanceRecord & {
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

type FinanceCollectionResponse = {
  mode: "partial" | "full";
  appliedAmount: number;
  receivable: FinanceRecord;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

export function FinancePage() {
  const screens = Grid.useBreakpoint();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [receivables, setReceivables] = useState<FinanceRecord[]>([]);
  const [selectedReceivableId, setSelectedReceivableId] = useState<string | null>(null);
  const [selectedReceivableDetail, setSelectedReceivableDetail] = useState<FinanceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);

  const selectedReceivable = useMemo(
    () => receivables.find((item) => item.id === selectedReceivableId) ?? null,
    [receivables, selectedReceivableId]
  );

  async function loadReceivables() {
    setIsLoading(true);

    try {
      const payload = await requestJson<FinanceListResponse>("/api/finance/receivables");
      setSummary(payload.summary);
      setReceivables(payload.receivables);

      if (selectedReceivableId && !payload.receivables.some((item) => item.id === selectedReceivableId)) {
        setSelectedReceivableId(null);
        setSelectedReceivableDetail(null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载财务回款列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadReceivableDetail(receivableId: string) {
    setIsDetailLoading(true);

    try {
      const payload = await requestJson<FinanceDetail>(`/api/finance/receivables/${receivableId}`);
      setSelectedReceivableDetail(payload);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载应收详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleCollection(record: FinanceRecord, mode: "partial" | "full") {
    const actionKey = `${record.id}-${mode}`;
    setActingKey(actionKey);

    try {
      const payload = await requestJson<FinanceCollectionResponse>(
        `/api/finance/receivables/${record.id}/${mode === "partial" ? "collect-partial" : "collect-full"}`,
        {
          method: "POST"
        }
      );

      setReceivables((current) => current.map((item) => (item.id === payload.receivable.id ? payload.receivable : item)));

      if (selectedReceivableId === payload.receivable.id) {
        await loadReceivableDetail(payload.receivable.id);
      }

      message.success(
        `${
          mode === "partial" ? "已模拟部分回款" : "已模拟全部回款"
        }，本次回款 ${formatAmount(payload.appliedAmount, payload.receivable.currency)}。`
      );

      await loadReceivables();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "更新回款状态失败。");
    } finally {
      setActingKey(null);
    }
  }

  useEffect(() => {
    void loadReceivables();
  }, []);

  useEffect(() => {
    if (selectedReceivableId) {
      setSelectedReceivableDetail(null);
      void loadReceivableDetail(selectedReceivableId);
    } else {
      setSelectedReceivableDetail(null);
    }
  }, [selectedReceivableId]);

  const columns: ColumnsType<FinanceRecord> = [
    {
      title: "关联合同",
      key: "contractNo",
      width: 220,
      render: (_, record) => record.contract?.contractNo ?? "-"
    },
    {
      title: "客户 / 口径",
      key: "customer",
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.contract?.customerName ?? record.salesOrder?.customerName ?? "-"}</Typography.Text>
          <Typography.Text type="secondary">{record.scopeLabel}</Typography.Text>
        </Space>
      )
    },
    {
      title: "销售 / 批次",
      key: "references",
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.salesOrder?.salesNo ?? "合同级应收"}</Typography.Text>
          <Typography.Text type="secondary">{record.batch?.batchNo ?? "-"}</Typography.Text>
        </Space>
      )
    },
    {
      title: "应收金额",
      key: "amount",
      width: 180,
      render: (_, record) => formatAmount(record.amount, record.currency)
    },
    {
      title: "已收金额",
      key: "receivedAmount",
      width: 180,
      render: (_, record) => formatAmount(record.receivedAmount, record.currency)
    },
    {
      title: "待回款",
      key: "openAmount",
      width: 180,
      render: (_, record) => formatAmount(record.openAmount, record.currency)
    },
    {
      title: "回款状态",
      key: "status",
      width: 140,
      render: (_, record) => <Tag color={record.statusMeta.color}>{record.statusMeta.label}</Tag>
    },
    {
      title: "逾期状态",
      key: "overdue",
      width: 170,
      render: (_, record) => <Tag color={record.overdueMeta.color}>{record.overdueMeta.label}</Tag>
    },
    {
      title: "核销状态",
      key: "reconciliation",
      width: 140,
      render: (_, record) => <Tag color={record.reconciliationMeta.color}>{record.reconciliationMeta.label}</Tag>
    },
    {
      title: "账期",
      key: "dueDate",
      width: 140,
      render: (_, record) => formatDate(record.dueDate)
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      fixed: "right",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            disabled={!record.recommendedAction.canCollectPartial}
            loading={actingKey === `${record.id}-partial`}
            onClick={(event) => {
              event.stopPropagation();
              void handleCollection(record, "partial");
            }}
          >
            模拟部分回款
          </Button>
          <Button
            type="primary"
            size="small"
            disabled={!record.recommendedAction.canCollectFull}
            loading={actingKey === `${record.id}-full`}
            onClick={(event) => {
              event.stopPropagation();
              void handleCollection(record, "full");
            }}
          >
            模拟全部回款
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div className="document-workspace procurement-workspace">
      <section className="page-hero">
        <h2>财务回款</h2>
        <p>
          这里承接销售完成后的应收跟进，真实读取现有 `Receivable`、`Payment`、合同与财务工单数据，
          展示应收、已收、账期、逾期和核销状态。第一版允许用“模拟部分回款 / 模拟全部回款”来跑通演示，
          但不会生成真实凭证，也不会改动库存。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="应收记录" value={summary?.totalReceivables ?? 0} suffix="笔" />
            </Card>
            <Card className="stat-card">
              <Statistic title="未回款" value={summary?.pendingCount ?? 0} suffix="笔" />
            </Card>
            <Card className="stat-card">
              <Statistic title="部分回款" value={summary?.partialCount ?? 0} suffix="笔" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已逾期" value={summary?.overdueCount ?? 0} suffix="笔" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={12}>
          <Alert
            type="info"
            showIcon
            message="阶段 16 演示边界"
            description="财务页本次只做真实应收读取与模拟回款。回款后会同步更新 Receivable、Payment、合同回款状态与财务工单，并写入审计日志；不会接银行接口，不会生成凭证，也不会反向影响二维码或库存。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <Card className="stat-card">
            <Statistic
              title="待回款总额"
              value={summary?.openAmount ?? 0}
              precision={2}
              suffix={summary?.currency ?? "USD"}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="stat-card">
            <Statistic
              title="已回款累计"
              value={summary?.receivedAmount ?? 0}
              precision={2}
              suffix={summary?.currency ?? "USD"}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card className="stat-card">
            <Statistic title="财务工单" value={summary?.linkedWorkOrders ?? 0} suffix="张" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card
            className="placeholder-card document-table-card"
            title="应收与回款列表"
            extra={
              <Space>
                <Button icon={<SolutionOutlined />} onClick={() => navigate("/work-orders")}>
                  查看自动工单
                </Button>
                <Button icon={<ReloadOutlined />} onClick={() => void loadReceivables()}>
                  刷新
                </Button>
              </Space>
            }
          >
            <Table<FinanceRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={receivables}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 2100 }}
              rowClassName={(record) => (record.id === selectedReceivableId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedReceivableId(record.id)
              })}
              locale={{
                emptyText: (
                  <Empty description="当前还没有应收记录。请先从合同与单据、销售与配送链路生成业务数据并推进到待回款状态。" />
                )
              }}
            />
          </Card>
        </Col>
      </Row>

      <Drawer
        open={Boolean(selectedReceivableId)}
        onClose={() => setSelectedReceivableId(null)}
        title={
          selectedReceivableDetail?.contract?.contractNo ??
          selectedReceivable?.contract?.contractNo ??
          "应收详情"
        }
        width={screens.xs ? "100%" : 780}
        destroyOnHidden={false}
      >
        {selectedReceivableDetail ? (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Alert
              type="success"
              showIcon
              message={selectedReceivableDetail.moduleNarrative.role}
              description={selectedReceivableDetail.moduleNarrative.boundary}
            />

            <Descriptions
              bordered
              size="small"
              column={screens.md ? 2 : 1}
              items={[
                {
                  key: "contractNo",
                  label: "关联合同",
                  children: selectedReceivableDetail.contract?.contractNo ?? "-"
                },
                {
                  key: "scope",
                  label: "应收口径",
                  children: selectedReceivableDetail.scopeLabel
                },
                {
                  key: "salesNo",
                  label: "销售单号",
                  children: selectedReceivableDetail.salesOrder?.salesNo ?? "合同级应收"
                },
                {
                  key: "batchNo",
                  label: "关联批次",
                  children: selectedReceivableDetail.batch?.batchNo ?? "-"
                },
                {
                  key: "customerName",
                  label: "客户",
                  children:
                    selectedReceivableDetail.contract?.customerName ??
                    selectedReceivableDetail.salesOrder?.customerName ??
                    "-"
                },
                {
                  key: "productName",
                  label: "商品",
                  children:
                    selectedReceivableDetail.contract?.productName ??
                    selectedReceivableDetail.salesOrder?.skuName ??
                    "-"
                },
                {
                  key: "quantity",
                  label: "数量",
                  children:
                    selectedReceivableDetail.salesOrder
                      ? `${selectedReceivableDetail.salesOrder.quantity}${selectedReceivableDetail.salesOrder.unit}`
                      : selectedReceivableDetail.contract
                        ? `${selectedReceivableDetail.contract.totalQuantity}${selectedReceivableDetail.contract.unit}`
                        : "-"
                },
                {
                  key: "amount",
                  label: "应收金额",
                  children: formatAmount(selectedReceivableDetail.amount, selectedReceivableDetail.currency)
                },
                {
                  key: "receivedAmount",
                  label: "已收金额",
                  children: formatAmount(
                    selectedReceivableDetail.receivedAmount,
                    selectedReceivableDetail.currency
                  )
                },
                {
                  key: "openAmount",
                  label: "待回款",
                  children: formatAmount(selectedReceivableDetail.openAmount, selectedReceivableDetail.currency)
                },
                {
                  key: "status",
                  label: "回款状态",
                  children: (
                    <Tag color={selectedReceivableDetail.statusMeta.color}>
                      {selectedReceivableDetail.statusMeta.label}
                    </Tag>
                  )
                },
                {
                  key: "dueDate",
                  label: "账期截止",
                  children: formatDate(selectedReceivableDetail.dueDate)
                },
                {
                  key: "overdue",
                  label: "逾期状态",
                  children: (
                    <Tag color={selectedReceivableDetail.overdueMeta.color}>
                      {selectedReceivableDetail.overdueMeta.label}
                    </Tag>
                  )
                },
                {
                  key: "reconciliation",
                  label: "核销状态",
                  children: (
                    <Tag color={selectedReceivableDetail.reconciliationMeta.color}>
                      {selectedReceivableDetail.reconciliationMeta.label}
                    </Tag>
                  )
                },
                {
                  key: "updatedAt",
                  label: "最近更新时间",
                  children: formatDateTime(selectedReceivableDetail.updatedAt)
                }
              ]}
            />

            <Card className="placeholder-card procurement-detail-card" title="本次演示可执行动作">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                <Alert
                  type={selectedReceivableDetail.openAmount > 0 ? "info" : "success"}
                  showIcon
                  message={
                    selectedReceivableDetail.openAmount > 0
                      ? `建议先模拟部分回款 ${formatAmount(
                          selectedReceivableDetail.recommendedAction.partialAmount,
                          selectedReceivableDetail.currency
                        )}，再模拟全部回款。`
                      : "当前应收已经全部回款，可直接向甲方演示“可核销”结果。"
                  }
                />
                <Space wrap>
                  <Button
                    disabled={!selectedReceivableDetail.recommendedAction.canCollectPartial}
                    loading={actingKey === `${selectedReceivableDetail.id}-partial`}
                    onClick={() => void handleCollection(selectedReceivableDetail, "partial")}
                  >
                    模拟部分回款
                  </Button>
                  <Button
                    type="primary"
                    disabled={!selectedReceivableDetail.recommendedAction.canCollectFull}
                    loading={actingKey === `${selectedReceivableDetail.id}-full`}
                    onClick={() => void handleCollection(selectedReceivableDetail, "full")}
                  >
                    模拟全部回款
                  </Button>
                </Space>
              </Space>
            </Card>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="合同与销售上下文">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>合同回款状态：{selectedReceivableDetail.contract?.paymentStatus ?? "-"}</Typography.Text>
                    <Typography.Text>合同业务状态：{selectedReceivableDetail.contract?.contractStatus ?? "-"}</Typography.Text>
                    <Typography.Text>销售单：{selectedReceivableDetail.salesOrder?.salesNo ?? "合同级应收"}</Typography.Text>
                    <Typography.Text>销售配送状态：{selectedReceivableDetail.salesOrder?.deliveryStatus ?? "-"}</Typography.Text>
                    <Typography.Text>客户签收状态：{selectedReceivableDetail.salesOrder?.signStatus ?? "-"}</Typography.Text>
                  </Space>
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card className="stat-card" title="Payment 与核销口径">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      Payment 应收：{formatAmount(
                        selectedReceivableDetail.payment?.receivableAmount,
                        selectedReceivableDetail.payment?.currency ?? selectedReceivableDetail.currency
                      )}
                    </Typography.Text>
                    <Typography.Text>
                      Payment 已收：{formatAmount(
                        selectedReceivableDetail.payment?.receivedAmount,
                        selectedReceivableDetail.payment?.currency ?? selectedReceivableDetail.currency
                      )}
                    </Typography.Text>
                    <Typography.Text>Payment 状态：{selectedReceivableDetail.payment?.status ?? "-"}</Typography.Text>
                    <Typography.Text>核销状态：{selectedReceivableDetail.reconciliationMeta.label}</Typography.Text>
                  </Space>
                </Card>
              </Col>
            </Row>

            <Card className="placeholder-card procurement-detail-card" title="财务工单与后续动作">
              <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                {selectedReceivableDetail.linkedFinanceWorkOrder ? (
                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "workOrderNo",
                        label: "财务工单",
                        children: selectedReceivableDetail.linkedFinanceWorkOrder.workOrderNo
                      },
                      {
                        key: "workOrderStatus",
                        label: "工单状态",
                        children: selectedReceivableDetail.linkedFinanceWorkOrder.status
                      },
                      {
                        key: "workOrderOwner",
                        label: "责任部门 / 人",
                        children: `${selectedReceivableDetail.linkedFinanceWorkOrder.responsibleDepartment ?? "-"} / ${selectedReceivableDetail.linkedFinanceWorkOrder.responsiblePerson ?? "-"}`
                      },
                      {
                        key: "workOrderDue",
                        label: "截止时间",
                        children: formatDateTime(selectedReceivableDetail.linkedFinanceWorkOrder.dueTime)
                      }
                    ]}
                  />
                ) : (
                  <Empty description="当前还没有绑定财务工单。" />
                )}

                <Space wrap>
                  <Button
                    icon={<DollarCircleOutlined />}
                    onClick={() => void loadReceivableDetail(selectedReceivableDetail.id)}
                  >
                    刷新当前详情
                  </Button>
                  <Button icon={<SolutionOutlined />} onClick={() => navigate("/work-orders")}>
                    查看自动工单
                  </Button>
                  <Button onClick={() => navigate("/sales")}>查看销售与配送</Button>
                  <Button onClick={() => navigate("/contracts")}>查看合同数据</Button>
                </Space>
              </Space>
            </Card>

            <Card className="placeholder-card procurement-detail-card" title="状态变化历史">
              <List
                bordered
                dataSource={selectedReceivableDetail.history}
                locale={{ emptyText: "当前应收还没有状态变化历史。" }}
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
            <Empty description="从应收列表中选择一条记录后，这里会显示合同、销售、Payment、工单和回款历史。" />
          </Card>
        )}
      </Drawer>
    </div>
  );
}
