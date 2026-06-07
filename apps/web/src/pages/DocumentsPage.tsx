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
import { InboxOutlined, ReloadOutlined, RobotOutlined, SaveOutlined } from "@ant-design/icons";
import { API_BASE_URL, requestJson, resolveApiUrl } from "../lib/api";

type DocumentType = "CONTRACT" | "PACKING_LIST" | "BILL_OF_LADING" | "INVOICE" | "OTHER";
type DocumentAiStatus = "PENDING" | "EXTRACTED" | "FAILED";

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

export function DocumentsPage() {
  const [form] = Form.useForm<ExtractionFormValues>();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("CONTRACT");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const extractedCount = documents.filter((item) => item.aiStatus === "EXTRACTED").length;
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
      message.success("识别字段已保存。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
  }, []);

  useEffect(() => {
    form.setFieldsValue(toExtractionValues(selectedDocument));
  }, [form, selectedDocument]);

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
      width: 250,
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

  return (
    <div className="document-workspace">
      <section className="page-hero">
        <h2>合同与单据真实闭环入口</h2>
        <p>
          本页已经接入真实上传、单据列表、AI Mock 识别与人工修正。
          阶段 4 将直接复用这里的识别草稿生成合同和批次。
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
                  先选择单据类型，再上传文件。当前支持把合同、箱单、提单、发票等单据录入到真实数据库。
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
                    Demo 第一版先保存原文件与元数据，随后通过 AI Mock 生成可编辑识别结果。
                  </Typography.Paragraph>
                </div>
              </Upload>

              <Alert
                type="info"
                showIcon
                message="当前演示策略"
                description="识别结果默认来自后端 DemoConfig，不写死在前端。你可以在识别后手工修正商品、客户、供应商、仓库、数量、单位、金额和币种。"
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
              scroll={{ x: 1100 }}
              rowClassName={(record) =>
                record.id === selectedDocumentId ? "documents-table-row-selected" : ""
              }
              onRow={(record) => ({
                onClick: () => setSelectedDocumentId(record.id)
              })}
              locale={{
                emptyText: <Empty description="还没有上传任何单据" />
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
                        <span>点击下方按钮执行 AI Mock 识别，系统会从当前 DemoConfig 生成一份可编辑草稿。</span>
                        <Button
                          type="primary"
                          icon={<RobotOutlined />}
                          loading={extractingDocumentId === selectedDocument.id}
                          onClick={() => void handleExtract(selectedDocument.id)}
                        >
                          立即执行 AI Mock 识别
                        </Button>
                      </Space>
                    }
                  />
                ) : (
                  <>
                    <Form<ExtractionFormValues>
                      form={form}
                      layout="vertical"
                      onFinish={(values) => void handleSave(values)}
                    >
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item label="合同草稿号" name="contractNoDraft">
                            <Input placeholder="例如 CTR-20260607-ABC123" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="批次草稿号" name="batchNoDraft">
                            <Input placeholder="例如 BAT-20260607-ABC123" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label="商品名称" name="productName">
                        <Input placeholder="请输入商品名称" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item label="客户名称" name="customerName">
                            <Input placeholder="请输入客户名称" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="供应商名称" name="supplierName">
                            <Input placeholder="请输入供应商名称" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label="目的仓库" name="destinationWarehouse">
                        <Input placeholder="请输入目的仓库" />
                      </Form.Item>

                      <Row gutter={16}>
                        <Col xs={24} md={8}>
                          <Form.Item label="总数量" name="totalQuantity">
                            <InputNumber min={0} style={{ width: "100%" }} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item label="单位" name="unit">
                            <Input placeholder="例如 箱" />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={8}>
                          <Form.Item label="币种" name="currency">
                            <Input placeholder="例如 USD" />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Form.Item label="合同金额" name="amount">
                        <InputNumber min={0} style={{ width: "100%" }} />
                      </Form.Item>

                      <Space wrap>
                        <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={isSaving}>
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
                  </>
                )}
              </Space>
            ) : (
              <Empty
                description="从左侧上传第一份合同或箱单后，这里会显示识别结果与人工修正表单。"
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
