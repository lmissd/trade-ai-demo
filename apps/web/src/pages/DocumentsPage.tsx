import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { DescriptionsProps } from "antd";
import {
  BarsOutlined,
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  InboxOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, requestJson, resolveApiUrl } from "../lib/api";

type DocumentType = "CONTRACT" | "PACKING_LIST" | "BILL_OF_LADING" | "INVOICE" | "OTHER";
type DocumentAiStatus = "PENDING" | "EXTRACTED" | "FAILED";

type DocumentContractSummary = {
  id: string;
  contractNo: string;
  status: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
  destinationWarehouse: string;
  createdAt: string;
};

type DocumentBatchSummary = {
  id: string;
  batchNo: string;
  status: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  destinationWarehouse: string;
  createdAt: string;
  contractId: string;
};

type DocumentRecord = {
  id: string;
  documentType: DocumentType;
  fileName: string;
  originalName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  mimeType: string | null;
  size: number | null;
  aiStatus: DocumentAiStatus;
  extractedJson: Record<string, unknown> | null;
  contractNoDraft: string | null;
  batchNoDraft: string | null;
  createdAt: string;
  updatedAt: string;
  sourceContracts: DocumentContractSummary[];
  sourceBatches: DocumentBatchSummary[];
};

type ExtractionFormValues = {
  contractNoDraft?: string;
  batchNoDraft?: string;
  productName?: string;
  customerName?: string;
  supplierName?: string;
  destinationWarehouse?: string;
  totalQuantity?: number;
  unit?: string;
  amount?: number;
  currency?: string;
};

type ConfirmBusinessDataResponse = {
  created: boolean;
  inventoryNotice: string;
  document: DocumentRecord | null;
  contract: {
    id: string;
    contractNo: string;
    status: string;
    customerName: string;
    supplierName: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    amount: number;
    currency: string;
    destinationWarehouse: string;
    createdAt: string;
  } | null;
  batch: {
    id: string;
    batchNo: string;
    contractId: string;
    status: string;
    sku: string;
    productName: string;
    totalQuantity: number;
    unit: string;
    destinationWarehouse: string;
    createdAt: string;
  } | null;
  purchaseOrder: {
    id: string;
    purchaseNo: string;
    contractId: string | null;
    batchId: string | null;
    status: string;
    supplierName: string;
    skuName: string;
    quantity: number;
    unit: string;
    createdAt: string;
  } | null;
  payment: {
    id: string;
    contractId: string;
    receivableAmount: number;
    receivedAmount: number;
    currency: string;
    status: string;
    dueDate: string | null;
    createdAt: string;
  } | null;
  receivable: {
    id: string;
    contractId: string | null;
    amount: number;
    currency: string;
    receivedAmount: number;
    status: string;
    dueDate: string | null;
    createdAt: string;
  } | null;
};

const documentTypeOptions: Array<{ label: string; value: DocumentType }> = [
  { label: "合同", value: "CONTRACT" },
  { label: "箱单", value: "PACKING_LIST" },
  { label: "提单", value: "BILL_OF_LADING" },
  { label: "发票", value: "INVOICE" },
  { label: "其他", value: "OTHER" }
];

const documentTypeLabelMap: Record<DocumentType, string> = {
  CONTRACT: "合同",
  PACKING_LIST: "箱单",
  BILL_OF_LADING: "提单",
  INVOICE: "发票",
  OTHER: "其他"
};

const aiStatusConfig: Record<DocumentAiStatus, { label: string; color: string }> = {
  PENDING: { label: "待识别", color: "default" },
  EXTRACTED: { label: "已识别", color: "success" },
  FAILED: { label: "识别失败", color: "error" }
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function formatFileSize(size: number | null) {
  if (!size || size <= 0) {
    return "未知";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatAmount(amount?: number | null, currency?: string | null) {
  if (typeof amount !== "number") {
    return "-";
  }

  return `${amount.toLocaleString("zh-CN")} ${currency ?? ""}`.trim();
}

function toExtractionValues(document: DocumentRecord | null): ExtractionFormValues {
  if (!document?.extractedJson) {
    return {
      contractNoDraft: document?.contractNoDraft ?? undefined,
      batchNoDraft: document?.batchNoDraft ?? undefined
    };
  }

  const source = document.extractedJson;

  return {
    contractNoDraft:
      typeof source.contractNoDraft === "string"
        ? source.contractNoDraft
        : (document.contractNoDraft ?? undefined),
    batchNoDraft:
      typeof source.batchNoDraft === "string"
        ? source.batchNoDraft
        : (document.batchNoDraft ?? undefined),
    productName: typeof source.productName === "string" ? source.productName : undefined,
    customerName: typeof source.customerName === "string" ? source.customerName : undefined,
    supplierName: typeof source.supplierName === "string" ? source.supplierName : undefined,
    destinationWarehouse:
      typeof source.destinationWarehouse === "string" ? source.destinationWarehouse : undefined,
    totalQuantity: typeof source.totalQuantity === "number" ? source.totalQuantity : undefined,
    unit: typeof source.unit === "string" ? source.unit : undefined,
    amount: typeof source.amount === "number" ? source.amount : undefined,
    currency: typeof source.currency === "string" ? source.currency : undefined
  };
}

function readNotes(document: DocumentRecord | null) {
  const notes = document?.extractedJson?.notes;
  if (!Array.isArray(notes)) {
    return [];
  }

  return notes.filter((item): item is string => typeof item === "string");
}

function getBusinessStatus(document: DocumentRecord) {
  return document.sourceContracts.length > 0 || document.sourceBatches.length > 0;
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ExtractionFormValues>();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingBusinessData, setIsConfirmingBusinessData] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("CONTRACT");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);
  const [latestBusinessResult, setLatestBusinessResult] = useState<ConfirmBusinessDataResponse | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const selectedBusinessResult =
    latestBusinessResult?.document?.id === selectedDocument?.id ? latestBusinessResult : null;

  const extractedCount = documents.filter((item) => item.aiStatus === "EXTRACTED").length;
  const generatedCount = documents.filter((item) => getBusinessStatus(item)).length;
  const pendingCount = documents.filter((item) => item.aiStatus === "PENDING").length;
  const notes = useMemo(() => readNotes(selectedDocument), [selectedDocument]);

  async function loadDocuments() {
    setIsLoading(true);

    try {
      const nextDocuments = await requestJson<DocumentRecord[]>("/api/documents");
      setDocuments(nextDocuments);

      if (!selectedDocumentId && nextDocuments.length > 0) {
        setSelectedDocumentId(nextDocuments[0].id);
      }

      if (selectedDocumentId && !nextDocuments.some((item) => item.id === selectedDocumentId)) {
        setSelectedDocumentId(nextDocuments[0]?.id ?? null);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载单据列表失败。");
    } finally {
      setIsLoading(false);
    }
  }

  function upsertDocument(document: DocumentRecord) {
    setDocuments((current) => {
      const exists = current.some((item) => item.id === document.id);
      const next = exists
        ? current.map((item) => (item.id === document.id ? document : item))
        : [document, ...current];

      return next.sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
    setSelectedDocumentId(document.id);
  }

  async function handleUpload(file: File) {
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", uploadType);

      const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "上传失败。");
      }

      const document = (await response.json()) as DocumentRecord;
      upsertDocument(document);
      message.success("单据上传成功。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传失败。");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleExtract(documentId: string) {
    setExtractingDocumentId(documentId);

    try {
      const document = await requestJson<DocumentRecord>(`/api/documents/${documentId}/extract`, {
        method: "POST"
      });
      upsertDocument(document);
      message.success("AI Mock 识别完成。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "识别失败。");
    } finally {
      setExtractingDocumentId(null);
    }
  }

  async function handleSave(values: ExtractionFormValues) {
    if (!selectedDocument) {
      return;
    }

    setIsSaving(true);

    try {
      const document = await requestJson<DocumentRecord>(
        `/api/documents/${selectedDocument.id}/extracted-fields`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(values)
        }
      );

      upsertDocument(document);
      setLatestBusinessResult(null);
      message.success("识别字段已保存。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmBusinessData() {
    if (!selectedDocument) {
      return;
    }

    setIsConfirmingBusinessData(true);

    try {
      const result = await requestJson<ConfirmBusinessDataResponse>(
        `/api/documents/${selectedDocument.id}/confirm`,
        {
          method: "POST"
        }
      );

      if (result.document) {
        upsertDocument(result.document);
      }

      setLatestBusinessResult(result);
      message.success(result.created ? "正式业务数据已生成。" : "该单据已经生成过正式业务数据。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "生成业务数据失败。");
    } finally {
      setIsConfirmingBusinessData(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    form.setFieldsValue(toExtractionValues(selectedDocument));
  }, [form, selectedDocument]);

  useEffect(() => {
    if (latestBusinessResult?.document?.id !== selectedDocumentId) {
      setLatestBusinessResult((current) =>
        current?.document?.id === selectedDocumentId ? current : null
      );
    }
  }, [latestBusinessResult, selectedDocumentId]);

  const columns: ColumnsType<DocumentRecord> = [
    {
      title: "单据",
      key: "document",
      render: (_, record) => (
        <div>
          <div className="documents-primary-text">{record.originalName ?? record.fileName}</div>
          <div className="documents-secondary-text">
            {documentTypeLabelMap[record.documentType]} · {formatFileSize(record.size)}
          </div>
        </div>
      )
    },
    {
      title: "识别状态",
      dataIndex: "aiStatus",
      width: 120,
      render: (value: DocumentAiStatus) => (
        <Tag color={aiStatusConfig[value].color}>{aiStatusConfig[value].label}</Tag>
      )
    },
    {
      title: "业务状态",
      key: "businessStatus",
      width: 150,
      render: (_, record) =>
        getBusinessStatus(record) ? (
          <Tag color="success">已生成正式数据</Tag>
        ) : (
          <Tag color="default">仍是草稿</Tag>
        )
    },
    {
      title: "合同草稿",
      dataIndex: "contractNoDraft",
      width: 180,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "批次草稿",
      dataIndex: "batchNoDraft",
      width: 180,
      render: (value: string | null) => value ?? "-"
    },
    {
      title: "上传时间",
      dataIndex: "createdAt",
      width: 180,
      render: (value: string) => formatDateTime(value)
    },
    {
      title: "操作",
      key: "actions",
      width: 260,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" onClick={() => setSelectedDocumentId(record.id)}>
            查看
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<RobotOutlined />}
            loading={extractingDocumentId === record.id}
            disabled={getBusinessStatus(record)}
            onClick={() => void handleExtract(record.id)}
          >
            AI 识别
          </Button>
          {record.fileUrl ? (
            <Button size="small" href={resolveApiUrl(record.fileUrl)} target="_blank">
              原文件
            </Button>
          ) : null}
        </Space>
      )
    }
  ];

  const generatedContract = selectedDocument?.sourceContracts[0] ?? null;
  const generatedBatch = selectedDocument?.sourceBatches[0] ?? null;
  const isBusinessGenerated = selectedDocument ? getBusinessStatus(selectedDocument) : false;

  const generatedItems: DescriptionsProps["items"] = [
    generatedContract
      ? {
          key: "contract",
          label: "正式合同",
          children: `${generatedContract.contractNo} · ${generatedContract.totalQuantity}${generatedContract.unit} · ${formatAmount(generatedContract.amount, generatedContract.currency)}`
        }
      : null,
    generatedBatch
      ? {
          key: "batch",
          label: "正式批次",
          children: `${generatedBatch.batchNo} · ${generatedBatch.totalQuantity}${generatedBatch.unit} · ${generatedBatch.status}`
        }
      : null,
    selectedBusinessResult?.purchaseOrder
      ? {
          key: "purchaseOrder",
          label: "采购草稿",
          children: `${selectedBusinessResult.purchaseOrder.purchaseNo} · ${selectedBusinessResult.purchaseOrder.quantity}${selectedBusinessResult.purchaseOrder.unit} · ${selectedBusinessResult.purchaseOrder.status}`
        }
      : null,
    selectedBusinessResult?.payment
      ? {
          key: "payment",
          label: "应收草稿",
          children: `${formatAmount(
            selectedBusinessResult.payment.receivableAmount,
            selectedBusinessResult.payment.currency
          )} · ${selectedBusinessResult.payment.status}`
        }
      : null
  ].filter(Boolean) as DescriptionsProps["items"];

  return (
    <div className="document-workspace">
      <section className="page-hero">
        <h2>合同与单据真实闭环入口</h2>
        <p>
          本页现在已经区分了“单据识别草稿层”和“正式业务数据层”。上传、识别、人工修正都属于草稿流程；
          只有点击“确认生成业务数据”后，系统才会正式创建合同、合同明细、批次、采购草稿和应收草稿。
        </p>
      </section>

      <Row gutter={[20, 20]}>
        <Col xs={24} xl={10}>
          <Card className="placeholder-card">
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              <div>
                <Typography.Title level={4} style={{ marginBottom: 8 }}>
                  上传合同 / 箱单
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  先选择单据类型，再上传文件。当前阶段只会把原始文件和识别草稿写入数据库，不会直接形成库存。
                </Typography.Paragraph>
              </div>

              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={uploadType}
                options={documentTypeOptions}
                onChange={(event) => setUploadType(event.target.value as DocumentType)}
              />

              <Upload
                multiple={false}
                showUploadList={false}
                beforeUpload={(file) => {
                  void handleUpload(file);
                  return false;
                }}
              >
                <div className="documents-upload-dropzone">
                  <InboxOutlined className="documents-upload-icon" />
                  <Typography.Title level={5} style={{ marginBottom: 8 }}>
                    {isUploading ? "正在上传单据..." : `点击上传${documentTypeLabelMap[uploadType]}`}
                  </Typography.Title>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    第一版先保存原文件与元数据，随后通过 AI Mock 生成可编辑识别草稿。
                  </Typography.Paragraph>
                </div>
              </Upload>

              <Alert
                type="info"
                showIcon
                message="当前规则"
                description="AI 识别结果默认来自后端 DemoConfig。你可以在识别后手工修正商品、客户、供应商、仓库、数量、单位、金额和币种；只有人工确认后才允许生成正式业务数据。"
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="已上传单据" value={documents.length} suffix="份" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已完成识别" value={extractedCount} suffix="份" />
            </Card>
            <Card className="stat-card">
              <Statistic title="待识别" value={pendingCount} suffix="份" />
            </Card>
            <Card className="stat-card">
              <Statistic title="已生成正式数据" value={generatedCount} suffix="份" />
            </Card>
          </div>
        </Col>
      </Row>

      <Row gutter={[20, 20]} align="top">
        <Col xs={24} xxl={14}>
          <Card
            className="placeholder-card"
            title="单据列表"
            extra={
              <Button icon={<ReloadOutlined />} onClick={() => void loadDocuments()}>
                刷新
              </Button>
            }
          >
            <Table<DocumentRecord>
              rowKey="id"
              loading={isLoading}
              columns={columns}
              dataSource={documents}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 1200 }}
              rowClassName={(record) =>
                record.id === selectedDocumentId ? "documents-table-row-selected" : ""
              }
              onRow={(record) => ({
                onClick: () => setSelectedDocumentId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有上传任何单据。" />
              }}
            />
          </Card>
        </Col>

        <Col xs={24} xxl={10}>
          <Card className="placeholder-card" title="识别结果与人工修正">
            {selectedDocument ? (
              <Space direction="vertical" size="large" style={{ width: "100%" }}>
                <Descriptions
                  bordered
                  size="small"
                  column={1}
                  items={[
                    {
                      key: "file",
                      label: "原文件",
                      children: selectedDocument.originalName ?? selectedDocument.fileName
                    },
                    {
                      key: "type",
                      label: "单据类型",
                      children: documentTypeLabelMap[selectedDocument.documentType]
                    },
                    {
                      key: "status",
                      label: "识别状态",
                      children: (
                        <Tag color={aiStatusConfig[selectedDocument.aiStatus].color}>
                          {aiStatusConfig[selectedDocument.aiStatus].label}
                        </Tag>
                      )
                    },
                    {
                      key: "business",
                      label: "业务状态",
                      children: getBusinessStatus(selectedDocument) ? (
                        <Tag color="success">已生成正式业务数据</Tag>
                      ) : (
                        <Tag color="default">仍是识别草稿</Tag>
                      )
                    },
                    {
                      key: "updatedAt",
                      label: "最近更新",
                      children: formatDateTime(selectedDocument.updatedAt)
                    }
                  ]}
                />

                {selectedDocument.aiStatus !== "EXTRACTED" ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="该单据还没有识别结果"
                    description={
                      <Space direction="vertical" size="middle">
                        <span>点击下方按钮执行 AI Mock 识别，系统会先生成一份可编辑草稿。</span>
                        <Button
                          type="primary"
                          icon={<RobotOutlined />}
                          loading={extractingDocumentId === selectedDocument.id}
                          disabled={isBusinessGenerated}
                          onClick={() => void handleExtract(selectedDocument.id)}
                        >
                          立即执行 AI Mock 识别
                        </Button>
                      </Space>
                    }
                  />
                ) : (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      message={isBusinessGenerated ? "正式业务数据已生成，草稿已锁定" : "当前仍是识别草稿"}
                      description={
                        isBusinessGenerated
                          ? "这份单据已经生成正式合同和批次。为避免草稿与正式数据不一致，当前演示版会先锁定草稿编辑；如需变更，后续应进入正式业务编辑流程。"
                          : "这里展示的字段还只是识别草稿。你可以先人工修正，再点击“确认生成业务数据”。这一动作会正式创建合同、合同明细、批次、采购草稿和应收草稿，但仍然不会增加库存。"
                      }
                    />

                    <Form<ExtractionFormValues>
                      form={form}
                      layout="vertical"
                      disabled={isBusinessGenerated}
                      onFinish={(values) => void handleSave(values)}
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="合同草稿号"
                            name="contractNoDraft"
                            rules={[{ required: true, message: "请输入合同草稿号。" }]}
                          >
                            <Input placeholder="例如 CTR-20260608-ABC123" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="批次草稿号"
                            name="batchNoDraft"
                            rules={[{ required: true, message: "请输入批次草稿号。" }]}
                          >
                            <Input placeholder="例如 BAT-20260608-ABC123" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="商品名称"
                        name="productName"
                        rules={[{ required: true, message: "请输入商品名称。" }]}
                      >
                        <Input placeholder="请输入商品名称" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="客户名称"
                            name="customerName"
                            rules={[{ required: true, message: "请输入客户名称。" }]}
                          >
                            <Input placeholder="请输入客户名称" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label="供应商名称"
                            name="supplierName"
                            rules={[{ required: true, message: "请输入供应商名称。" }]}
                          >
                            <Input placeholder="请输入供应商名称" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="目的仓库"
                        name="destinationWarehouse"
                        rules={[{ required: true, message: "请输入目的仓库。" }]}
                      >
                        <Input placeholder="请输入目的仓库" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="总数量"
                            name="totalQuantity"
                            rules={[{ required: true, message: "请输入总数量。" }]}
                          >
                            <InputNumber min={1} precision={0} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="单位"
                            name="unit"
                            rules={[
                              { required: true, message: "请输入实际单位。" },
                              {
                                validator: async (_, value) => {
                                  if (typeof value === "string" && value.trim() === "?") {
                                    throw new Error("单位不能保存为 ?，请输入真实单位。");
                                  }
                                }
                              }
                            ]}
                          >
                            <Input placeholder="例如 箱" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item
                            label="币种"
                            name="currency"
                            rules={[{ required: true, message: "请输入币种。" }]}
                          >
                            <Input placeholder="例如 USD" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item
                        label="合同金额"
                        name="amount"
                        rules={[{ required: true, message: "请输入合同金额。" }]}
                      >
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>

                      <Space wrap>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={isSaving}
                          disabled={isBusinessGenerated}
                        >
                          保存人工修正
                        </Button>
                        {selectedDocument.fileUrl ? (
                          <Button href={resolveApiUrl(selectedDocument.fileUrl)} target="_blank">
                            查看原文件
                          </Button>
                        ) : null}
                      </Space>
                    </Form>

                    {notes.length > 0 ? (
                      <div className="documents-notes">
                        <Typography.Text strong>AI Mock 说明</Typography.Text>
                        <ul className="placeholder-list">
                          {notes.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <Card
                      className="placeholder-card"
                      title="正式业务数据生成"
                      size="small"
                    >
                      {getBusinessStatus(selectedDocument) ? (
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                          <Alert
                            type="success"
                            showIcon
                            message="这份单据已经生成正式业务数据"
                            description="正式合同、批次和采购草稿已经落库，但当前仍然没有库存。库存要等后续二维码生成并扫码入库后才会增加。"
                          />

                          <Descriptions bordered size="small" column={1} items={generatedItems} />

                          <Space wrap>
                            <Button icon={<BarsOutlined />} onClick={() => navigate("/contracts")}>
                              查看合同数据
                            </Button>
                            <Button icon={<DeploymentUnitOutlined />} onClick={() => navigate("/batches")}>
                              查看批次数据
                            </Button>
                          </Space>
                        </Space>
                      ) : (
                        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                          <Alert
                            type="warning"
                            showIcon
                            message="还没有生成正式业务数据"
                            description="请先确认草稿字段无误，再执行正式生成。系统会创建合同、合同明细、批次、采购草稿和应收草稿，但不会创建库存。"
                          />

                          <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            loading={isConfirmingBusinessData}
                            onClick={() => void handleConfirmBusinessData()}
                          >
                            确认生成业务数据
                          </Button>

                          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            生成后可在“合同数据”和“批次数据”中查看正式记录。
                          </Typography.Paragraph>
                        </Space>
                      )}

                      {selectedBusinessResult ? (
                        <Alert
                          style={{ marginTop: 16 }}
                          type="info"
                          showIcon
                          message="库存提示"
                          description={selectedBusinessResult.inventoryNotice}
                        />
                      ) : null}
                    </Card>
                  </>
                )}
              </Space>
            ) : (
              <Empty description="从左侧上传第一份合同或箱单后，这里会显示识别结果和正式业务数据生成入口。" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
