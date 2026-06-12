import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  List,
  Progress,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined } from "@ant-design/icons";
import { requestJson } from "../lib/api";

type ExecutionControl = {
  executionStatus: string;
  executionProgress: number;
  isOverdue: boolean;
  overdueDays: number;
  breachStatus: string;
  breachNote: string | null;
  plannedReceiptAmount: number;
  actualReceiptAmount: number;
  receiptGap: number;
  plannedPaymentAmount: number;
  actualPaymentAmount: number;
  paymentGap: number;
  currency: string;
  receiptPaymentPlan: unknown;
  warning: string;
};

type DocumentPackageItem = {
  documentType: string;
  label: string;
  stage: string;
  level: "required" | "customs_required" | "recommended";
  purpose: string;
  status: string;
  isSatisfied: boolean;
  historyCount: number;
  document: {
    id: string;
    originalName: string | null;
    fileName: string;
    status: string;
    aiStatus: string;
    businessCreated: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
  } | null;
};

type DocumentPackageStatus = {
  items: DocumentPackageItem[];
  summary: {
    total: number;
    satisfied: number;
    completionRate: number;
    coreReady: boolean;
    customsReady: boolean;
    requiredMissing: string[];
    customsMissing: string[];
    message: string;
  };
};

type ContractListRecord = {
  id: string;
  contractNo: string;
  contractType: string;
  status: string;
  paymentStatus: string;
  executionStatus: string;
  executionProgress: number;
  isOverdue: boolean;
  overdueDays: number;
  breachStatus: string;
  customerName: string;
  supplierName: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
  destinationWarehouse: string;
  sourceDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
  executionControl: ExecutionControl;
  sourceDocument: {
    id: string;
    originalName: string | null;
  } | null;
  batches: Array<{
    id: string;
    batchNo: string;
    status: string;
    sourceDocumentId: string | null;
  }>;
  payments: Array<{
    id: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
  }>;
  receivable: {
    id: string;
    amount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
  } | null;
};

type ContractDetail = ContractListRecord & {
  parentContractId: string | null;
  customerId: string | null;
  supplierId: string | null;
  companyId: string | null;
  parentContract: {
    id: string;
    contractNo: string;
    contractType: string;
  } | null;
  supplementalContracts: Array<{
    id: string;
    contractNo: string;
    contractType: string;
    status: string;
    amount: number;
    currency: string;
  }>;
  sourceDocument: {
    id: string;
    originalName: string | null;
    fileUrl: string | null;
  } | null;
  batches: Array<{
    id: string;
    batchNo: string;
    status: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
    sourceDocumentId: string | null;
    createdAt: string;
  }>;
  items: Array<{
    id: string;
    skuCode: string;
    skuName: string;
    quantity: number;
    unit: string;
    unitPrice: number | null;
    amount: number | null;
    currency: string | null;
  }>;
  purchaseOrders: Array<{
    id: string;
    purchaseNo: string;
    status: string;
    supplierName: string;
    skuName: string;
    quantity: number;
    unit: string;
    deliveryDate: string | null;
    createdAt: string;
  }>;
  receivables: Array<{
    id: string;
    amount: number;
    currency: string;
    receivedAmount: number;
    status: string;
    dueDate: string | null;
    createdAt: string;
  }>;
  documentPackage: DocumentPackageStatus;
};

const contractTypeLabelMap: Record<string, string> = {
  PURCHASE: "采购合同",
  SALES: "销售合同",
  INTER_COMPANY: "公司间协议",
  SUPPLEMENTAL: "补充协议",
  TRADE: "综合贸易合同"
};

const executionStatusLabelMap: Record<string, string> = {
  DOCUMENT_CONFIRMED: "单据已确认",
  PROCUREMENT_STARTED: "采购执行中",
  LOGISTICS_STARTED: "物流执行中",
  WAREHOUSE_PROCESSING: "仓储执行中",
  WAITING_RECEIPT: "等待回款",
  READY_TO_ARCHIVE: "可归档",
  FULL_CHAIN_COMPLETED: "全链路完成"
};

const packageStatusConfig: Record<string, { label: string; color: string }> = {
  MISSING: { label: "缺少", color: "default" },
  UPLOADED: { label: "已上传待识别", color: "warning" },
  RECOGNIZED: { label: "已识别", color: "processing" },
  BUSINESS_CREATED: { label: "已成为业务依据", color: "success" },
  ARCHIVED: { label: "已归档", color: "blue" },
  VOIDED: { label: "已作废", color: "error" },
  REPLACED: { label: "已替换", color: "default" }
};

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

function getContractTypeLabel(value: string) {
  return contractTypeLabelMap[value] ?? value;
}

function getExecutionStatusLabel(value: string) {
  return executionStatusLabelMap[value] ?? value;
}

function renderPackageStatus(status: string) {
  const config = packageStatusConfig[status] ?? { label: status, color: "default" };

  return <Tag color={config.color}>{config.label}</Tag>;
}

export function ContractsPage() {
  const [contracts, setContracts] = useState<ContractListRecord[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedContractDetail, setSelectedContractDetail] = useState<ContractDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const selectedContract = useMemo(
    () => contracts.find((item) => item.id === selectedContractId) ?? null,
    [contracts, selectedContractId]
  );
  const overdueCount = contracts.filter((item) => item.executionControl.isOverdue).length;
  const averageProgress =
    contracts.length > 0
      ? Math.round(contracts.reduce((sum, item) => sum + item.executionControl.executionProgress, 0) / contracts.length)
      : 0;

  async function loadContracts() {
    setIsLoading(true);

    try {
      const data = await requestJson<ContractListRecord[]>("/api/contracts");
      setContracts(data);

      if (!selectedContractId && data.length > 0) {
        setSelectedContractId(data[0].id);
      }

      if (selectedContractId && !data.some((item) => item.id === selectedContractId)) {
        setSelectedContractId(data[0]?.id ?? null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载合同列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadContractDetail(contractId: string) {
    setIsDetailLoading(true);

    try {
      const detail = await requestJson<ContractDetail>(`/api/contracts/${contractId}`);
      setSelectedContractDetail(detail);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载合同详情失败。");
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadContracts();
  }, []);

  useEffect(() => {
    if (selectedContractId) {
      void loadContractDetail(selectedContractId);
    } else {
      setSelectedContractDetail(null);
    }
  }, [selectedContractId]);

  const columns: ColumnsType<ContractListRecord> = [
    {
      title: "合同号",
      dataIndex: "contractNo",
      width: 220
    },
    {
      title: "类型",
      dataIndex: "contractType",
      width: 140,
      render: (value: string) => <Tag color="blue">{getContractTypeLabel(value)}</Tag>
    },
    {
      title: "客户 / 供应商",
      key: "parties",
      width: 240,
      render: (_, record) => (
        <div>
          <div>{record.customerName}</div>
          <div className="documents-secondary-text">供应商：{record.supplierName}</div>
        </div>
      )
    },
    {
      title: "商品",
      dataIndex: "productName",
      width: 180
    },
    {
      title: "数量",
      key: "quantity",
      width: 120,
      render: (_, record) => `${record.totalQuantity}${record.unit}`
    },
    {
      title: "执行进度",
      key: "execution",
      width: 180,
      render: (_, record) => (
        <div>
          <Progress percent={record.executionControl.executionProgress} size="small" />
          <Typography.Text type="secondary">
            {getExecutionStatusLabel(record.executionControl.executionStatus)}
          </Typography.Text>
        </div>
      )
    },
    {
      title: "收款缺口",
      key: "receiptGap",
      width: 160,
      render: (_, record) => formatAmount(record.executionControl.receiptGap, record.currency)
    },
    {
      title: "风险",
      key: "risk",
      width: 140,
      render: (_, record) =>
        record.executionControl.isOverdue ? (
          <Tag color="error">逾期 {record.executionControl.overdueDays} 天</Tag>
        ) : (
          <Tag color="success">正常</Tag>
        )
    }
  ];

  return (
    <div className="document-workspace">
      <section className="page-hero">
        <h2>正式合同数据</h2>
        <p>
          这里展示的是人工确认后写入数据库的正式合同层。阶段 22 已补充合同类型分层、执行进度、
          逾期/违约状态、收付款计划对比和单据包完整性，但库存仍然只由二维码状态和库存流水计算。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={8}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="正式合同数" value={contracts.length} suffix="份" />
            </Card>
            <Card className="stat-card">
              <Statistic title="平均执行进度" value={averageProgress} suffix="%" />
            </Card>
            <Card className="stat-card">
              <Statistic title="逾期风险合同" value={overdueCount} suffix="份" />
            </Card>
          </div>
        </Col>
        <Col xs={24} xl={16}>
          <Alert
            type="info"
            showIcon
            message="阶段 22 规则"
            description="合同层可以展示计划数量、合同金额、执行进度和收付款计划；但这仍不等于库存。真实库存只在二维码生成并扫码入库/出库后变化。"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} xl={14}>
          <Card
            className="placeholder-card document-table-card"
            title="合同列表"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadContracts()}>
                刷新
              </Button>
            }
          >
            <Table<ContractListRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={contracts}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1240 }}
              rowClassName={(record) => (record.id === selectedContractId ? "documents-table-row-selected" : "")}
              onRow={(record) => ({
                onClick: () => setSelectedContractId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有正式合同。请先在“合同与单据”中确认生成业务数据。" />
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xl={10}>
          <Card className="placeholder-card document-detail-card" title="合同详情" loading={isDetailLoading}>
            {selectedContractDetail && selectedContract ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    { key: "contractNo", label: "合同号", children: selectedContractDetail.contractNo },
                    {
                      key: "contractType",
                      label: "合同类型",
                      children: getContractTypeLabel(selectedContractDetail.contractType)
                    },
                    { key: "customer", label: "客户", children: selectedContractDetail.customerName },
                    { key: "supplier", label: "供应商", children: selectedContractDetail.supplierName },
                    { key: "product", label: "商品", children: selectedContractDetail.productName },
                    {
                      key: "quantity",
                      label: "合同数量",
                      children: `${selectedContractDetail.totalQuantity}${selectedContractDetail.unit}`
                    },
                    {
                      key: "amount",
                      label: "合同金额",
                      children: formatAmount(selectedContractDetail.amount, selectedContractDetail.currency)
                    },
                    {
                      key: "warehouse",
                      label: "目的仓库",
                      children: selectedContractDetail.destinationWarehouse
                    },
                    {
                      key: "document",
                      label: "来源合同单据",
                      children: selectedContractDetail.sourceDocument?.originalName ?? "-"
                    }
                  ]}
                />

                <Card size="small" className="placeholder-card" title="合同执行控制">
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Progress percent={selectedContractDetail.executionControl.executionProgress} />
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "status",
                          label: "执行状态",
                          children: getExecutionStatusLabel(selectedContractDetail.executionControl.executionStatus)
                        },
                        {
                          key: "receipt",
                          label: "应收计划 / 已收",
                          children: `${formatAmount(
                            selectedContractDetail.executionControl.plannedReceiptAmount,
                            selectedContractDetail.currency
                          )} / ${formatAmount(
                            selectedContractDetail.executionControl.actualReceiptAmount,
                            selectedContractDetail.currency
                          )}`
                        },
                        {
                          key: "payment",
                          label: "应付计划 / 已付",
                          children: `${formatAmount(
                            selectedContractDetail.executionControl.plannedPaymentAmount,
                            selectedContractDetail.currency
                          )} / ${formatAmount(
                            selectedContractDetail.executionControl.actualPaymentAmount,
                            selectedContractDetail.currency
                          )}`
                        },
                        {
                          key: "risk",
                          label: "逾期 / 违约",
                          children: selectedContractDetail.executionControl.isOverdue
                            ? `逾期 ${selectedContractDetail.executionControl.overdueDays} 天 / ${selectedContractDetail.executionControl.breachStatus}`
                            : `未逾期 / ${selectedContractDetail.executionControl.breachStatus}`
                        }
                      ]}
                    />
                    <Alert
                      type={selectedContractDetail.executionControl.isOverdue ? "warning" : "success"}
                      showIcon
                      message={selectedContractDetail.executionControl.warning}
                    />
                  </Space>
                </Card>

                <Card size="small" className="placeholder-card" title="单据包完整性">
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Progress percent={selectedContractDetail.documentPackage.summary.completionRate} size="small" />
                    <Alert
                      type={selectedContractDetail.documentPackage.summary.coreReady ? "success" : "warning"}
                      showIcon
                      message={selectedContractDetail.documentPackage.summary.message}
                      description={
                        selectedContractDetail.documentPackage.summary.customsReady
                          ? "清关资料包已满足当前 Demo 校验口径。"
                          : `清关资料包仍缺：${
                              selectedContractDetail.documentPackage.summary.customsMissing.join("、") || "无"
                            }。`
                      }
                    />
                    <List
                      size="small"
                      bordered
                      dataSource={selectedContractDetail.documentPackage.items}
                      renderItem={(item) => (
                        <List.Item>
                          <div style={{ width: "100%" }}>
                            <Space wrap>
                              <Typography.Text strong>{item.label}</Typography.Text>
                              {renderPackageStatus(item.status)}
                              <Tag>{item.stage}</Tag>
                            </Space>
                            <div className="documents-secondary-text">
                              {item.document
                                ? `${item.document.originalName ?? item.document.fileName} · V${item.document.version}`
                                : item.purpose}
                            </div>
                          </div>
                        </List.Item>
                      )}
                    />
                  </Space>
                </Card>

                <Card size="small" className="placeholder-card" title="合同分层关系">
                  <Space direction="vertical" size="small" style={{ width: "100%" }}>
                    <Typography.Text>
                      主合同：{selectedContractDetail.parentContract?.contractNo ?? "当前合同为主合同或独立合同"}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      补充协议数：{selectedContractDetail.supplementalContracts.length}
                    </Typography.Text>
                    {selectedContractDetail.supplementalContracts.length > 0 ? (
                      <List
                        size="small"
                        bordered
                        dataSource={selectedContractDetail.supplementalContracts}
                        renderItem={(item) => (
                          <List.Item>
                            {item.contractNo} · {getContractTypeLabel(item.contractType)} ·{" "}
                            {formatAmount(item.amount, item.currency)}
                          </List.Item>
                        )}
                      />
                    ) : (
                      <Typography.Text type="secondary">
                        当前 Demo 没有补充协议。正式版可在这里挂采购合同、销售合同、公司间协议和补充协议链。
                      </Typography.Text>
                    )}
                  </Space>
                </Card>

                <Alert
                  type="warning"
                  showIcon
                  message="库存仍未由合同直接决定"
                  description="合同数量是计划或约定数量，不能直接当成库存。库存只由二维码状态和 StockMovement 计算。"
                />

                <div>
                  <Typography.Text strong>合同明细</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无合同明细。" }}
                    dataSource={selectedContractDetail.items}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.skuName}</div>
                          <div className="documents-secondary-text">
                            {item.skuCode} · {item.quantity}
                            {item.unit} · {formatAmount(item.amount, item.currency)}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Text strong>关联批次</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无关联批次。" }}
                    dataSource={selectedContractDetail.batches}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.batchNo}</div>
                          <div className="documents-secondary-text">
                            {item.productName} · {item.totalQuantity}
                            {item.unit} · {item.status}
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Text strong>采购草稿与应收草稿</Typography.Text>
                  <List
                    style={{ marginTop: 12 }}
                    bordered
                    locale={{ emptyText: "暂无采购或应收草稿。" }}
                    dataSource={[
                      ...selectedContractDetail.purchaseOrders.map((item) => ({
                        id: item.id,
                        title: `采购草稿 ${item.purchaseNo}`,
                        subtitle: `${item.skuName} · ${item.quantity}${item.unit} · ${item.status}`
                      })),
                      ...selectedContractDetail.receivables.map((item) => ({
                        id: item.id,
                        title: `应收草稿 ${formatAmount(item.amount, item.currency)}`,
                        subtitle: `${item.status} · 到期 ${formatDateTime(item.dueDate)}`
                      }))
                    ]}
                    renderItem={(item) => (
                      <List.Item>
                        <div style={{ width: "100%" }}>
                          <div>{item.title}</div>
                          <div className="documents-secondary-text">{item.subtitle}</div>
                        </div>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            ) : (
              <Empty description="从左侧选择一份合同后，这里会展示合同详情、执行控制、单据包和采购草稿。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
