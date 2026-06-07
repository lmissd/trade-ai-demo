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
  List,
  Modal,
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
import type { UploadFile } from "antd/es/upload/interface";
import {
  BarsOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  HistoryOutlined,
  InboxOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  StopOutlined,
  SwapOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, requestJson, resolveApiUrl } from "../lib/api";

type DocumentType = "CONTRACT" | "PACKING_LIST" | "BILL_OF_LADING" | "INVOICE" | "OTHER";
type DocumentAiStatus = "PENDING" | "EXTRACTED" | "FAILED";
type DocumentStatus = "ACTIVE" | "VOIDED" | "REPLACED" | "ARCHIVED" | "DELETED";

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

type DocumentReplacementSummary = {
  id: string;
  fileName: string;
  originalName: string | null;
  status: DocumentStatus;
  version: number;
  createdAt: string;
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
  status: DocumentStatus;
  aiStatus: DocumentAiStatus;
  extractedJson: Record<string, unknown> | null;
  contractNoDraft: string | null;
  batchNoDraft: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletedBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  replacedByDocumentId: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  businessCreated: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  replacedByDocument: DocumentReplacementSummary | null;
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

type DocumentMutationResponse = {
  document: DocumentRecord | null;
};

type DocumentReplaceResponse = {
  document: DocumentRecord | null;
  previousDocument: DocumentRecord | null;
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

const documentStatusConfig: Record<DocumentStatus, { label: string; color: string }> = {
  ACTIVE: { label: "当前有效", color: "processing" },
  VOIDED: { label: "已作废", color: "error" },
  REPLACED: { label: "已替换", color: "default" },
  ARCHIVED: { label: "已归档", color: "warning" },
  DELETED: { label: "已删除", color: "default" }
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

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
  return document.businessCreated;
}

function canDeleteDocument(document: DocumentRecord) {
  return document.status === "ACTIVE" && !document.businessCreated;
}

function canEditDraft(document: DocumentRecord) {
  return document.status === "ACTIVE" && !document.businessCreated && document.aiStatus === "EXTRACTED";
}

function canReExtractDocument(document: DocumentRecord) {
  return document.status === "ACTIVE" && !document.businessCreated;
}

function canConfirmBusinessData(document: DocumentRecord) {
  return document.status === "ACTIVE" && !document.businessCreated && document.aiStatus === "EXTRACTED";
}

function canVoidDocument(document: DocumentRecord) {
  return document.status === "ACTIVE" && document.businessCreated;
}

function canReplaceDocument(document: DocumentRecord) {
  return document.status === "ACTIVE" && document.businessCreated;
}

function getBusinessStatusTag(document: DocumentRecord) {
  if (document.status === "VOIDED") {
    return <Tag color="error">已作废</Tag>;
  }

  if (document.status === "REPLACED") {
    return <Tag color="default">旧版本已替换</Tag>;
  }

  if (document.businessCreated) {
    return <Tag color="success">已生成正式数据</Tag>;
  }

  if (document.aiStatus === "EXTRACTED") {
    return <Tag color="processing">识别草稿</Tag>;
  }

  return <Tag color="default">仍是草稿</Tag>;
}

function getHistoryLabel(document: DocumentRecord) {
  const name = document.originalName ?? document.fileName;
  return `V${document.version} · ${name}`;
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ExtractionFormValues>();
  const [voidForm] = Form.useForm<{ reason: string }>();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingBusinessData, setIsConfirmingBusinessData] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("CONTRACT");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);
  const [latestBusinessResult, setLatestBusinessResult] = useState<ConfirmBusinessDataResponse | null>(null);
  const [voidTarget, setVoidTarget] = useState<DocumentRecord | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<DocumentRecord | null>(null);
  const [replaceFileList, setReplaceFileList] = useState<UploadFile[]>([]);
  const [historyTarget, setHistoryTarget] = useState<DocumentRecord | null>(null);
  const [historyDocuments, setHistoryDocuments] = useState<DocumentRecord[]>([]);

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );

  const selectedBusinessResult =
    latestBusinessResult?.document?.id === selectedDocument?.id ? latestBusinessResult : null;

  const activeDocuments = documents.filter((item) => item.status === "ACTIVE");
  const extractedCount = activeDocuments.filter((item) => item.aiStatus === "EXTRACTED").length;
  const generatedCount = activeDocuments.filter((item) => item.businessCreated).length;
  const pendingCount = activeDocuments.filter((item) => item.aiStatus === "PENDING").length;
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

  function removeDocument(documentId: string) {
    setDocuments((current) => current.filter((item) => item.id !== documentId));
    setSelectedDocumentId((current) => (current === documentId ? null : current));
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

  async function handleConfirmBusinessData(documentId?: string) {
    const targetDocumentId = documentId ?? selectedDocument?.id;

    if (!targetDocumentId) {
      return;
    }

    setIsConfirmingBusinessData(true);

    try {
      const result = await requestJson<ConfirmBusinessDataResponse>(
        `/api/documents/${targetDocumentId}/confirm`,
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

  function openDeleteConfirm(document: DocumentRecord) {
    Modal.confirm({
      title: "删除这份单据？",
      content: "当前单据还没有生成正式业务数据，删除后会从工作台列表中移除，并写入审计日志。",
      okText: "确认删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          const result = await requestJson<DocumentMutationResponse>(`/api/documents/${document.id}`, {
            method: "DELETE"
          });

          removeDocument(document.id);
          setLatestBusinessResult(null);
          message.success("单据已删除。");

          if (result.document?.id === selectedDocumentId) {
            void loadDocuments();
          }
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除失败。");
        }
      }
    });
  }

  function openVoidModal(document: DocumentRecord) {
    setVoidTarget(document);
    voidForm.setFieldsValue({
      reason: document.voidReason ?? ""
    });
  }

  async function handleVoidSubmit() {
    if (!voidTarget) {
      return;
    }

    try {
      const values = await voidForm.validateFields();
      setIsVoiding(true);

      const result = await requestJson<DocumentMutationResponse>(`/api/documents/${voidTarget.id}/void`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });

      if (result.document) {
        upsertDocument(result.document);
      }

      setLatestBusinessResult(null);
      setVoidTarget(null);
      voidForm.resetFields();
      message.success("单据已作废。");
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setIsVoiding(false);
    }
  }

  function openReplaceModal(document: DocumentRecord) {
    setReplaceTarget(document);
    setReplaceFileList([]);
  }

  async function handleReplaceSubmit() {
    if (!replaceTarget) {
      return;
    }

    const file = replaceFileList[0]?.originFileObj;

    if (!file) {
      message.warning("请先选择要替换上传的新单据文件。");
      return;
    }

    setIsReplacing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/api/documents/${replaceTarget.id}/replace`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message ?? "替换失败。");
      }

      const result = (await response.json()) as DocumentReplaceResponse;

      if (result.previousDocument) {
        upsertDocument(result.previousDocument);
      }

      if (result.document) {
        upsertDocument(result.document);
      }

      setLatestBusinessResult(null);
      setReplaceTarget(null);
      setReplaceFileList([]);
      message.success("新版本单据已上传，旧版本已标记为已替换。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "替换失败。");
    } finally {
      setIsReplacing(false);
    }
  }

  async function openHistoryModal(document: DocumentRecord) {
    setHistoryTarget(document);
    setIsHistoryLoading(true);

    try {
      const history = await requestJson<DocumentRecord[]>(`/api/documents/${document.id}/history`);
      setHistoryDocuments(history);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载版本历史失败。");
      setHistoryDocuments([]);
    } finally {
      setIsHistoryLoading(false);
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
      width: 220,
      render: (_, record) => (
        <div>
          <div className="documents-primary-text">{record.originalName ?? record.fileName}</div>
          <div className="documents-secondary-text">
            {documentTypeLabelMap[record.documentType]} · {formatFileSize(record.size)} · V{record.version}
          </div>
        </div>
      )
    },
    {
      title: "生命周期",
      dataIndex: "status",
      width: 120,
      render: (value: DocumentStatus) => (
        <Tag color={documentStatusConfig[value].color}>{documentStatusConfig[value].label}</Tag>
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
      render: (_, record) => getBusinessStatusTag(record)
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
      width: 380,
      render: (_, record) => (
        <Space wrap>
          <Button size="small" onClick={() => setSelectedDocumentId(record.id)}>
            查看
          </Button>

          {record.status === "REPLACED" ? (
            <Button size="small" icon={<HistoryOutlined />} onClick={() => void openHistoryModal(record)}>
              查看历史
            </Button>
          ) : null}

          {canReExtractDocument(record) ? (
            <Button
              size="small"
              type="primary"
              icon={<RobotOutlined />}
              loading={extractingDocumentId === record.id}
              onClick={() => void handleExtract(record.id)}
            >
              {record.aiStatus === "EXTRACTED" ? "重新识别" : "AI 识别"}
            </Button>
          ) : null}

          {canConfirmBusinessData(record) ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              loading={isConfirmingBusinessData && selectedDocument?.id === record.id}
              onClick={() => void handleConfirmBusinessData(record.id)}
            >
              确认生成业务
            </Button>
          ) : null}

          {canDeleteDocument(record) ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => openDeleteConfirm(record)}
            >
              删除
            </Button>
          ) : null}

          {canVoidDocument(record) ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={() => openVoidModal(record)}
            >
              作废
            </Button>
          ) : null}

          {canReplaceDocument(record) ? (
            <Button size="small" icon={<SwapOutlined />} onClick={() => openReplaceModal(record)}>
              替换
            </Button>
          ) : null}

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
  const isDraftEditable = selectedDocument ? canEditDraft(selectedDocument) : false;

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
          本页现在已经区分了“单据识别草稿层”和“正式业务数据层”，并补充了删除、作废、替换和版本历史。
          草稿单据可以删除；一旦生成正式业务数据，就只能作废或替换，不能再误删，也不会影响库存。
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
                description="AI 识别结果默认来自后端 DemoConfig。删除与作废都会进入 AuditLog；已生成业务数据的单据不能删除，只能作废或替换，且不会影响合同、批次、二维码和库存流水。"
              />
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={14}>
          <div className="document-summary-grid">
            <Card className="stat-card">
              <Statistic title="当前有效单据" value={activeDocuments.length} suffix="份" />
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
        <Col xs={24} xl={14}>
          <Card
            className="placeholder-card document-table-card"
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
              scroll={{ x: 1580 }}
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

        <Col xs={24} xl={10}>
          <Card className="placeholder-card document-detail-card" title="识别结果与人工修正">
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
                      key: "version",
                      label: "版本",
                      children: `V${selectedDocument.version}`
                    },
                    {
                      key: "documentStatus",
                      label: "生命周期",
                      children: (
                        <Tag color={documentStatusConfig[selectedDocument.status].color}>
                          {documentStatusConfig[selectedDocument.status].label}
                        </Tag>
                      )
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
                      children: getBusinessStatusTag(selectedDocument)
                    },
                    {
                      key: "updatedAt",
                      label: "最近更新",
                      children: formatDateTime(selectedDocument.updatedAt)
                    }
                  ]}
                />

                <Space wrap>
                  {selectedDocument.fileUrl ? (
                    <Button href={resolveApiUrl(selectedDocument.fileUrl)} target="_blank">
                      查看原文件
                    </Button>
                  ) : null}

                  {canReExtractDocument(selectedDocument) ? (
                    <Button
                      type="primary"
                      icon={<RobotOutlined />}
                      loading={extractingDocumentId === selectedDocument.id}
                      onClick={() => void handleExtract(selectedDocument.id)}
                    >
                      {selectedDocument.aiStatus === "EXTRACTED" ? "重新识别" : "立即执行 AI Mock 识别"}
                    </Button>
                  ) : null}

                  {canDeleteDocument(selectedDocument) ? (
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => openDeleteConfirm(selectedDocument)}
                    >
                      删除单据
                    </Button>
                  ) : null}

                  {canVoidDocument(selectedDocument) ? (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => openVoidModal(selectedDocument)}
                    >
                      作废单据
                    </Button>
                  ) : null}

                  {canReplaceDocument(selectedDocument) ? (
                    <Button icon={<SwapOutlined />} onClick={() => openReplaceModal(selectedDocument)}>
                      替换新版本
                    </Button>
                  ) : null}

                  {selectedDocument.status === "REPLACED" ? (
                    <>
                      <Button
                        icon={<HistoryOutlined />}
                        onClick={() => void openHistoryModal(selectedDocument)}
                      >
                        查看历史
                      </Button>
                      {selectedDocument.replacedByDocumentId ? (
                        <Button onClick={() => setSelectedDocumentId(selectedDocument.replacedByDocumentId)}>
                          查看当前版本
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </Space>

                {selectedDocument.status === "VOIDED" ? (
                  <Alert
                    type="error"
                    showIcon
                    message="这份单据已经作废"
                    description={`作废原因：${selectedDocument.voidReason ?? "未填写"}；作废时间：${formatDateTime(
                      selectedDocument.voidedAt
                    )}；作废人：${selectedDocument.voidedBy ?? "-"}`}
                  />
                ) : null}

                {selectedDocument.status === "REPLACED" ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="这份单据已经被新版本替换"
                    description={
                      selectedDocument.replacedByDocument
                        ? `当前有效版本：V${selectedDocument.replacedByDocument.version} · ${
                            selectedDocument.replacedByDocument.originalName ??
                            selectedDocument.replacedByDocument.fileName
                          }`
                        : "当前版本链已更新，可点击“查看历史”了解完整变更。"
                    }
                  />
                ) : null}

                {selectedDocument.aiStatus !== "EXTRACTED" && selectedDocument.status === "ACTIVE" ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="该单据还没有识别结果"
                    description="点击上方“AI 识别”后，系统会先生成一份可编辑草稿。"
                  />
                ) : null}

                {selectedDocument.aiStatus === "EXTRACTED" && !selectedDocument.businessCreated && selectedDocument.status === "ACTIVE" ? (
                  <Alert
                    type="info"
                    showIcon
                    message="当前仍是识别草稿"
                    description="这里展示的字段还只是识别草稿。你可以先人工修正，再确认生成业务数据。删除草稿单据不会影响任何库存。"
                  />
                ) : null}

                {selectedDocument.businessCreated && selectedDocument.status === "ACTIVE" ? (
                  <Alert
                    type="success"
                    showIcon
                    message="正式业务数据已生成，草稿已锁定"
                    description="这份单据已经生成正式合同、批次、采购草稿和应收草稿。后续若需失效处理，只能作废或替换，不能误删，也不会改变库存。"
                  />
                ) : null}

                <Form<ExtractionFormValues>
                  form={form}
                  layout="vertical"
                  disabled={!isDraftEditable}
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
                      disabled={!isDraftEditable}
                    >
                      保存人工修正
                    </Button>
                    {canConfirmBusinessData(selectedDocument) ? (
                      <Button
                        icon={<CheckCircleOutlined />}
                        loading={isConfirmingBusinessData}
                        onClick={() => void handleConfirmBusinessData()}
                      >
                        确认生成业务数据
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

                <Card className="placeholder-card" title="正式业务数据生成" size="small">
                  {selectedDocument.businessCreated ? (
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Descriptions bordered size="small" column={1} items={generatedItems} />

                      <Space wrap>
                        <Button icon={<BarsOutlined />} onClick={() => navigate("/contracts")}>
                          查看合同数据
                        </Button>
                        <Button icon={<DeploymentUnitOutlined />} onClick={() => navigate("/batches")}>
                          查看批次数据
                        </Button>
                        {selectedDocument.status === "REPLACED" ? (
                          <Button icon={<HistoryOutlined />} onClick={() => void openHistoryModal(selectedDocument)}>
                            查看版本历史
                          </Button>
                        ) : null}
                      </Space>

                      {selectedDocument.voidReason ? (
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          当前作废原因：{selectedDocument.voidReason}
                        </Typography.Paragraph>
                      ) : null}
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
                        disabled={!canConfirmBusinessData(selectedDocument)}
                        onClick={() => void handleConfirmBusinessData()}
                      >
                        确认生成业务数据
                      </Button>

                      <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        草稿删除不会影响库存；只有在生成二维码并扫码入库后，库存才会变化。
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
              </Space>
            ) : (
              <Empty description="从左侧上传第一份合同或箱单后，这里会显示识别结果、删除/作废动作和正式业务数据入口。" />
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="作废单据"
        open={Boolean(voidTarget)}
        onCancel={() => {
          setVoidTarget(null);
          voidForm.resetFields();
        }}
        onOk={() => void handleVoidSubmit()}
        confirmLoading={isVoiding}
        okText="确认作废"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="作废不会删除业务数据"
            description="作废后会保留原文件、合同、批次和采购/应收草稿，仅把该单据标记为失效，并写入 AuditLog。"
          />
          <Form form={voidForm} layout="vertical">
            <Form.Item
              label="作废原因"
              name="reason"
              rules={[{ required: true, message: "请填写作废原因。" }]}
            >
              <Input.TextArea rows={4} placeholder="例如：上传了错误版本合同，需要替换为新文件。" />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        title="替换新版本单据"
        open={Boolean(replaceTarget)}
        onCancel={() => {
          setReplaceTarget(null);
          setReplaceFileList([]);
        }}
        onOk={() => void handleReplaceSubmit()}
        confirmLoading={isReplacing}
        okText="上传替换"
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="info"
            showIcon
            message="替换不会删除业务数据"
            description="旧单据会标记为“已替换”，新单据成为当前有效版本。原合同、批次、二维码和库存流水不会被删除。"
          />
          <Upload
            beforeUpload={(file) => {
              setReplaceFileList([
                {
                  uid: file.uid,
                  name: file.name,
                  status: "done",
                  originFileObj: file
                }
              ]);
              return false;
            }}
            fileList={replaceFileList}
            maxCount={1}
            onRemove={() => {
              setReplaceFileList([]);
            }}
          >
            <Button icon={<InboxOutlined />}>选择新版本文件</Button>
          </Upload>
        </Space>
      </Modal>

      <Modal
        title={historyTarget ? `${historyTarget.originalName ?? historyTarget.fileName} 的版本历史` : "版本历史"}
        open={Boolean(historyTarget)}
        footer={null}
        onCancel={() => {
          setHistoryTarget(null);
          setHistoryDocuments([]);
        }}
      >
        <List<DocumentRecord>
          loading={isHistoryLoading}
          dataSource={historyDocuments}
          locale={{ emptyText: "暂无版本历史。" }}
          renderItem={(item) => (
            <List.Item
              actions={[
                <Button key="view" size="small" onClick={() => setSelectedDocumentId(item.id)}>
                  查看
                </Button>
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <span>{getHistoryLabel(item)}</span>
                    <Tag color={documentStatusConfig[item.status].color}>
                      {documentStatusConfig[item.status].label}
                    </Tag>
                    {item.businessCreated ? <Tag color="success">正式业务依据</Tag> : <Tag>草稿</Tag>}
                  </Space>
                }
                description={
                  <>
                    <div>创建时间：{formatDateTime(item.createdAt)}</div>
                    {item.voidReason ? <div>作废原因：{item.voidReason}</div> : null}
                  </>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
