import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
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
  Steps,
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
  FileDoneOutlined,
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
import { isCustomerDemo } from "../lib/runtime";

type DocumentType =
  | "CONTRACT"
  | "PACKING_LIST"
  | "BILL_OF_LADING"
  | "INVOICE"
  | "CERTIFICATE_OF_ORIGIN"
  | "CUSTOMS_ATTACHMENT"
  | "OTHER";
type DocumentAiStatus = "PENDING" | "EXTRACTED" | "FAILED";
type DocumentStatus = "ACTIVE" | "VOIDED" | "REPLACED" | "ARCHIVED" | "DELETED";
type DocumentMatchStatus =
  | "UNMATCHED"
  | "AUTO_MATCHED"
  | "NEEDS_CONFIRMATION"
  | "MANUAL_CONFIRMED"
  | "CONFLICTED"
  | "IGNORED";

type DocumentPackageDraftItem = {
  id: string;
  assignmentType: string;
  note: string | null;
  createdAt: string;
  document: {
    id: string;
    documentType: DocumentType;
    originalName: string | null;
    fileName: string;
    status: DocumentStatus;
    aiStatus: DocumentAiStatus;
    contractNoDraft: string | null;
    batchNoDraft: string | null;
    matchStatus: DocumentMatchStatus;
    matchConfidence: number;
    matchReason: string | null;
    manualMatchLocked: boolean;
    businessCreated: boolean;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
};

type DocumentPackageDraft = {
  id: string;
  packageNo: string;
  contractNoDraft: string | null;
  batchNoDraft: string | null;
  customerName: string | null;
  supplierName: string | null;
  productName: string | null;
  destinationWarehouse: string | null;
  status: string;
  source: string;
  matchSummary: string | null;
  createdAt: string;
  updatedAt: string;
  packageItems?: DocumentPackageDraftItem[];
};

type DocumentPackageItemSummary = {
  id: string;
  assignmentType: string;
  note: string | null;
  packageDraft: DocumentPackageDraft;
};

type DocumentContractSummary = {
  id: string;
  contractNo: string;
  contractType: string;
  status: string;
  executionStatus: string;
  executionProgress: number;
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
  matchStatus: DocumentMatchStatus;
  matchConfidence: number;
  matchReason: string | null;
  manualMatchLocked: boolean;
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
  packageItem: DocumentPackageItemSummary | null;
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
    contractType: string;
    status: string;
    executionStatus: string;
    executionProgress: number;
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

type DocumentChangeLog = {
  id: string;
  documentId: string;
  eventType: string;
  fieldName: string | null;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  diffJson: {
    changedFields?: Array<{
      field: string;
      before: unknown;
      after: unknown;
    }>;
    changedFieldCount?: number;
    [key: string]: unknown;
  } | null;
  reason: string | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
};

type DocumentMatchLog = {
  id: string;
  documentId: string;
  packageDraftId: string | null;
  eventType: string;
  matchStatus: DocumentMatchStatus;
  confidence: number;
  reason: string | null;
  detailJson: Record<string, unknown> | null;
  actorId: string | null;
  actorName: string | null;
  createdAt: string;
};

type DocumentPackageCandidate = {
  packageDraft: DocumentPackageDraft;
  status: "EXACT" | "HIGH_CONFIDENCE" | "CONFLICT" | "LOW_CONFIDENCE";
  confidence: number;
  reason: string;
};

type DocumentMatchInfoResponse = {
  document: DocumentRecord;
  currentPackage: DocumentPackageDraft | null;
  candidates: DocumentPackageCandidate[];
  logs: DocumentMatchLog[];
};

type DemoScenarioSummary = {
  scenarioName: string;
  origin: string;
  destinationWarehouse: string;
  customerName: string;
  supplierName: string;
  productName: string;
  totalQuantity: number;
  unit: string;
  plannedOutboundQuantity: number;
  amount: number;
  currency: string;
  expectedRemainingQuantity?: number;
  storyline?: string;
  updatedAt?: string;
  status?: string;
};

type SetupStatusResponse = {
  resetCapability: {
    enabled: boolean;
    action: string;
    scope: string;
    confirmationRequired?: boolean;
    confirmationPhrase?: string;
    highestPrivilegeRole?: string;
  };
  standardDemoScenario: DemoScenarioSummary;
  demoScenario: DemoScenarioSummary;
};

type ResetDemoResponse = {
  ok: boolean;
  message: string;
  fileWarnings: string[];
  preserved: {
    aiAssistantRuntimeConfig: boolean;
  };
  standardScenario: DemoScenarioSummary;
  activeScenario: DemoScenarioSummary | null;
  countsAfter: {
    documents: number;
    contracts: number;
    batches: number;
    qrItems: number;
    stockMovements: number;
    purchaseOrders: number;
    shipments: number;
    workOrders: number;
  };
};

type DocumentPreparedStatus = "missing" | "uploaded" | "recognized";
type BusinessDocumentGate = {
  pairKey: string | null;
  hasContract: boolean;
  hasPackingList: boolean;
  isReady: boolean;
  message: string;
};

type SpreadsheetExtraction = {
  sourceFormat?: string;
  sheets?: Array<{
    name: string;
    rowCount: number;
    columnCount: number;
  }>;
  activeSheetName?: string | null;
  headerMap?: Record<string, unknown>;
  summaryFields?: Record<string, unknown>;
  lineItems?: Array<Record<string, unknown>>;
  previewRows?: Array<Record<string, unknown>>;
  warnings?: string[];
};

const DEFAULT_RESET_CONFIRMATION_PHRASE = "我是最高权限用户";
const supportedDocumentExtensions = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".csv"];
const supportedUploadAccept = supportedDocumentExtensions.join(",");
const unsupportedFileTypeMessage = "上传文件格式不支持，请上传 PDF、Word、图片或 Excel/CSV 文件。";

const supportedFormatGroups = [
  {
    title: "合同正文 / 扫描件",
    formats: "PDF、Word、PNG、JPG、JPEG",
    note: "适合盖章合同、扫描件、图片单据"
  },
  {
    title: "结构化明细",
    formats: "XLSX、XLS、CSV",
    note: "适合合同明细、箱单、发票明细"
  }
];

const documentTypeOptions: Array<{ label: string; value: DocumentType }> = [
  { label: "合同", value: "CONTRACT" },
  { label: "箱单", value: "PACKING_LIST" },
  { label: "提单", value: "BILL_OF_LADING" },
  { label: "发票", value: "INVOICE" },
  { label: "产地证", value: "CERTIFICATE_OF_ORIGIN" },
  { label: "清关附件", value: "CUSTOMS_ATTACHMENT" },
  { label: "其他", value: "OTHER" }
];

const documentTypeLabelMap: Record<DocumentType, string> = {
  CONTRACT: "合同",
  PACKING_LIST: "箱单",
  BILL_OF_LADING: "提单",
  INVOICE: "发票",
  CERTIFICATE_OF_ORIGIN: "产地证",
  CUSTOMS_ATTACHMENT: "清关附件",
  OTHER: "其他"
};

const documentChangeEventLabelMap: Record<string, string> = {
  UPLOAD: "上传",
  AI_EXTRACT: "AI识别",
  FIELD_CORRECTION: "人工修正",
  BUSINESS_CREATE: "确认生成业务",
  BUSINESS_CREATE_RECHECK: "业务状态补齐",
  DELETE: "删除",
  VOID: "作废",
  REPLACE: "替换旧版本",
  CREATE_REPLACEMENT: "生成新版本",
  ARCHIVE: "归档"
};

const contractTypeLabelMap: Record<string, string> = {
  PURCHASE: "采购合同",
  SALES: "销售合同",
  INTER_COMPANY: "公司间协议",
  SUPPLEMENTAL: "补充协议",
  TRADE: "综合贸易合同"
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

const matchStatusConfig: Record<DocumentMatchStatus, { label: string; color: string }> = {
  UNMATCHED: { label: "未归组", color: "default" },
  AUTO_MATCHED: { label: "自动归组", color: "success" },
  NEEDS_CONFIRMATION: { label: "待人工确认", color: "warning" },
  MANUAL_CONFIRMED: { label: "人工确认", color: "processing" },
  CONFLICTED: { label: "冲突待处理", color: "error" },
  IGNORED: { label: "已忽略", color: "default" }
};

const packageCandidateStatusConfig: Record<
  DocumentPackageCandidate["status"],
  { label: string; color: string }
> = {
  EXACT: { label: "精确匹配", color: "success" },
  HIGH_CONFIDENCE: { label: "高置信候选", color: "processing" },
  LOW_CONFIDENCE: { label: "低置信候选", color: "warning" },
  CONFLICT: { label: "冲突候选", color: "error" }
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

function formatDraftQuantity(quantity?: number | null, unit?: string | null) {
  if (typeof quantity !== "number") {
    return "-";
  }

  return `${quantity}${unit ?? ""}`.trim();
}

function formatChangeValue(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getFileExtension(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
}

function validateDocumentUploadFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!supportedDocumentExtensions.includes(extension)) {
    message.error(unsupportedFileTypeMessage);
    return false;
  }

  return true;
}

function looksLikePackingListFileName(fileName: string) {
  const normalizedName = fileName.normalize("NFKC").toLowerCase();

  return (
    normalizedName.includes("箱单") ||
    normalizedName.includes("装箱单") ||
    /packing[\s._-]*list/.test(normalizedName) ||
    normalizedName.includes("packinglist")
  );
}

function readObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readSpreadsheetExtraction(document: DocumentRecord | null): SpreadsheetExtraction | null {
  const extracted = readObject(document?.extractedJson);
  const spreadsheet = readObject(extracted?.spreadsheet);

  if (!spreadsheet) {
    return null;
  }

  return spreadsheet as SpreadsheetExtraction;
}

function buildSpreadsheetPreviewColumns(rows: Array<Record<string, unknown>>): ColumnsType<Record<string, unknown>> {
  const columnKeys = Array.from(
    rows.reduce((keys, row) => {
      Object.keys(row).forEach((key) => keys.add(key));
      return keys;
    }, new Set<string>())
  ).slice(0, 8);

  return columnKeys.map((key) => ({
    title: key,
    dataIndex: key,
    key,
    ellipsis: true,
    render: (value: unknown) => formatChangeValue(value)
  }));
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

function canArchiveDocument(document: DocumentRecord) {
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

function getPreparedStatus(
  documents: DocumentRecord[],
  documentType: DocumentType
): DocumentPreparedStatus {
  const typedDocuments = documents.filter((item) => item.documentType === documentType);

  if (typedDocuments.some((item) => item.aiStatus === "EXTRACTED")) {
    return "recognized";
  }

  if (typedDocuments.length > 0) {
    return "uploaded";
  }

  return "missing";
}

function renderPreparedStatusTag(label: string, status: DocumentPreparedStatus) {
  const config: Record<DocumentPreparedStatus, { color: string; text: string }> = {
    missing: { color: "default", text: "缺少" },
    uploaded: { color: "warning", text: "已上传待识别" },
    recognized: { color: "success", text: "已识别" }
  };

  return (
    <Tag color={config[status].color}>
      {label}：{config[status].text}
    </Tag>
  );
}

function readDraftValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getDocumentDraftPairKey(document: DocumentRecord) {
  const extracted =
    document.extractedJson && typeof document.extractedJson === "object" && !Array.isArray(document.extractedJson)
      ? document.extractedJson
      : null;

  const contractNoDraft =
    readDraftValue(extracted?.contractNoDraft) ?? readDraftValue(document.contractNoDraft);
  const batchNoDraft =
    readDraftValue(extracted?.batchNoDraft) ?? readDraftValue(document.batchNoDraft);

  if (!contractNoDraft || !batchNoDraft) {
    return null;
  }

  return `${contractNoDraft}::${batchNoDraft}`;
}

function getActivePackageDocuments(packageDraft: DocumentPackageDraft | null | undefined) {
  return (
    packageDraft?.packageItems
      ?.map((item) => item.document)
      .filter((item) => item.status === "ACTIVE" && item.aiStatus === "EXTRACTED") ?? []
  );
}

function getBusinessDocumentGateForPackage(
  packageDraft: DocumentPackageDraft | null | undefined
): BusinessDocumentGate | null {
  if (!packageDraft?.packageItems?.length) {
    return null;
  }

  const packageDocuments = getActivePackageDocuments(packageDraft);
  const hasContract = packageDocuments.some((item) => item.documentType === "CONTRACT");
  const hasPackingList = packageDocuments.some((item) => item.documentType === "PACKING_LIST");

  if (hasContract && hasPackingList) {
    return {
      pairKey: packageDraft.packageNo,
      hasContract: true,
      hasPackingList: true,
      isReady: true,
      message: "当前资料包内已具备已识别的合同和箱单，可以确认生成正式业务数据。"
    };
  }

  const missingParts = [
    hasContract ? null : "合同",
    hasPackingList ? null : "箱单"
  ].filter((item): item is string => Boolean(item));

  return {
    pairKey: packageDraft.packageNo,
    hasContract,
    hasPackingList,
    isReady: false,
    message: `当前资料包缺少已识别的${missingParts.join(" + ")}，暂不能生成正式业务数据。`
  };
}

function getBusinessDocumentGateForDocument(
  documents: DocumentRecord[],
  document: DocumentRecord
): BusinessDocumentGate {
  const packageGate = getBusinessDocumentGateForPackage(document.packageItem?.packageDraft);

  if (packageGate) {
    return packageGate;
  }

  const pairKey = getDocumentDraftPairKey(document);

  if (!pairKey) {
    return {
      pairKey: null,
      hasContract: false,
      hasPackingList: false,
      isReady: false,
      message: "请先补全这票业务的合同草稿号和批次草稿号，再准备合同与箱单。"
    };
  }

  const pairDocuments = documents.filter(
    (item) =>
      item.status === "ACTIVE" &&
      item.aiStatus === "EXTRACTED" &&
      getDocumentDraftPairKey(item) === pairKey
  );

  const hasContract = pairDocuments.some((item) => item.documentType === "CONTRACT");
  const hasPackingList = pairDocuments.some((item) => item.documentType === "PACKING_LIST");

  if (hasContract && hasPackingList) {
    return {
      pairKey,
      hasContract: true,
      hasPackingList: true,
      isReady: true,
      message: "当前这票业务已具备已识别的合同和箱单，可以确认生成正式业务数据。"
    };
  }

  const missingParts = [
    hasContract ? null : "合同",
    hasPackingList ? null : "箱单"
  ].filter((item): item is string => Boolean(item));

  return {
    pairKey,
    hasContract,
    hasPackingList,
    isReady: false,
    message: `当前这票业务缺少已识别的${missingParts.join(" + ")}，暂不能生成正式业务数据。`
  };
}

function renderMatchStatusTag(status: DocumentMatchStatus) {
  const config = matchStatusConfig[status];

  return <Tag color={config.color}>{config.label}</Tag>;
}

function getPackageDisplayName(packageDraft: DocumentPackageDraft | null | undefined) {
  if (!packageDraft) {
    return "未归入资料包";
  }

  return `${packageDraft.packageNo}${packageDraft.batchNoDraft ? ` · ${packageDraft.batchNoDraft}` : ""}`;
}

function hasAnyReadyBusinessDocumentPair(documents: DocumentRecord[]) {
  const seenPairs = new Set<string>();

  for (const document of documents) {
    const pairKey = getDocumentDraftPairKey(document);
    if (!pairKey || seenPairs.has(pairKey)) {
      continue;
    }

    seenPairs.add(pairKey);

    if (getBusinessDocumentGateForDocument(documents, document).isReady) {
      return true;
    }
  }

  return false;
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
  const [setupStatus, setSetupStatus] = useState<SetupStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingBusinessData, setIsConfirmingBusinessData] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isChangeLogLoading, setIsChangeLogLoading] = useState(false);
  const [archivingDocumentId, setArchivingDocumentId] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [uploadType, setUploadType] = useState<DocumentType>("CONTRACT");
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);
  const [latestBusinessResult, setLatestBusinessResult] = useState<ConfirmBusinessDataResponse | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRecord | null>(null);
  const [voidTarget, setVoidTarget] = useState<DocumentRecord | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<DocumentRecord | null>(null);
  const [replaceFileList, setReplaceFileList] = useState<UploadFile[]>([]);
  const [historyTarget, setHistoryTarget] = useState<DocumentRecord | null>(null);
  const [historyDocuments, setHistoryDocuments] = useState<DocumentRecord[]>([]);
  const [changeLogTarget, setChangeLogTarget] = useState<DocumentRecord | null>(null);
  const [changeLogs, setChangeLogs] = useState<DocumentChangeLog[]>([]);
  const [matchInfo, setMatchInfo] = useState<DocumentMatchInfoResponse | null>(null);
  const [isMatchInfoLoading, setIsMatchInfoLoading] = useState(false);
  const [matchingAction, setMatchingAction] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [highestPrivilegeConfirmed, setHighestPrivilegeConfirmed] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState("");

  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedDocumentId) ?? null,
    [documents, selectedDocumentId]
  );
  const selectedSpreadsheetExtraction = readSpreadsheetExtraction(selectedDocument);
  const selectedSpreadsheetRows =
    selectedSpreadsheetExtraction?.previewRows?.length
      ? selectedSpreadsheetExtraction.previewRows
      : selectedSpreadsheetExtraction?.lineItems?.slice(0, 10) ?? [];
  const selectedSpreadsheetColumns = buildSpreadsheetPreviewColumns(selectedSpreadsheetRows);

  const selectedBusinessResult =
    latestBusinessResult?.document?.id === selectedDocument?.id ? latestBusinessResult : null;

  const activeDocuments = documents.filter((item) => item.status === "ACTIVE");
  const extractedCount = activeDocuments.filter((item) => item.aiStatus === "EXTRACTED").length;
  const generatedCount = activeDocuments.filter((item) => item.businessCreated).length;
  const pendingCount = activeDocuments.filter((item) => item.aiStatus === "PENDING").length;
  const contractPreparedStatus = getPreparedStatus(activeDocuments, "CONTRACT");
  const packingListPreparedStatus = getPreparedStatus(activeDocuments, "PACKING_LIST");
  const billOfLadingPreparedStatus = getPreparedStatus(activeDocuments, "BILL_OF_LADING");
  const invoicePreparedStatus = getPreparedStatus(activeDocuments, "INVOICE");
  const certificatePreparedStatus = getPreparedStatus(activeDocuments, "CERTIFICATE_OF_ORIGIN");
  const customsAttachmentPreparedStatus = getPreparedStatus(activeDocuments, "CUSTOMS_ATTACHMENT");
  const hasMinimumBusinessDocuments = hasAnyReadyBusinessDocumentPair(activeDocuments);
  const activeMatchInfo = matchInfo && matchInfo.document.id === selectedDocument?.id ? matchInfo : null;
  const selectedCurrentPackage = activeMatchInfo?.currentPackage ?? selectedDocument?.packageItem?.packageDraft ?? null;
  const selectedDocumentBusinessGate = selectedDocument
    ? getBusinessDocumentGateForPackage(selectedCurrentPackage) ??
      getBusinessDocumentGateForDocument(activeDocuments, selectedDocument)
    : null;
  const matureDocumentSteps = [
    {
      title: "正式业务数据生成前",
      status: hasMinimumBusinessDocuments ? "finish" : "process",
      description: hasMinimumBusinessDocuments
        ? "当前至少已有一份已识别合同和一份已识别箱单，成熟版通常会在这个基础上再做人工核对后生成正式合同、明细和批次。"
        : "成熟版通常建议先识别并核对“合同 + 箱单”，再确认生成正式业务数据。"
    },
    {
      title: "国际物流阶段",
      status:
        billOfLadingPreparedStatus === "recognized"
          ? "finish"
          : hasMinimumBusinessDocuments
            ? "process"
            : "wait",
      description:
        billOfLadingPreparedStatus === "recognized"
          ? "当前已识别提单，后续可以继续承接柜号、船期、港口和运输节点。"
          : "通常在货代出单后补传提单，再进入更完整的国际物流追踪。"
    },
    {
      title: "报关 / 清关阶段",
      status:
        invoicePreparedStatus === "recognized" && billOfLadingPreparedStatus === "recognized"
          ? "finish"
          : invoicePreparedStatus === "recognized" || billOfLadingPreparedStatus === "recognized"
            ? "process"
            : "wait",
      description:
        invoicePreparedStatus === "recognized"
          ? "当前已识别发票；成熟版清关时通常还会结合箱单、提单和其他资料做一致性校验。"
          : "成熟版通常会在清关前补齐发票，并与箱单、提单、其他资料一起校验。"
    },
    {
      title: "清关资料包补齐",
      status:
        certificatePreparedStatus === "recognized" && customsAttachmentPreparedStatus === "recognized"
          ? "finish"
          : invoicePreparedStatus === "recognized" || billOfLadingPreparedStatus === "recognized"
            ? "process"
            : "wait",
      description:
        certificatePreparedStatus === "recognized" || customsAttachmentPreparedStatus === "recognized"
          ? "当前已开始补充产地证或清关附件；成熟版会把这些资料纳入清关资料包完整性校验。"
          : "正式业务中常见还需要产地证、目的国清关附件、查验补充资料等。Demo 先做资料包口径展示。"
    },
    {
      title: "库存真正生效",
      status: "wait",
      description:
        "库存不会因为合同、箱单、发票或提单自动增加。只有生成二维码并完成扫码入库后，库存才会真正生效。"
    },
    {
      title: "财务真正完成",
      status: "wait",
      description:
        "应收可以先生成草稿，但真正回款、核销与财务完成，要在后续销售交付和财务回款阶段处理。"
    }
  ] as const;
  const notes = useMemo(() => readNotes(selectedDocument), [selectedDocument]);
  const selectedDraftValues = useMemo(() => toExtractionValues(selectedDocument), [selectedDocument]);
  const standardScenario = setupStatus?.standardDemoScenario ?? null;
  const activeScenario = setupStatus?.demoScenario ?? null;
  const resetConfirmationPhrase =
    setupStatus?.resetCapability.confirmationPhrase ?? DEFAULT_RESET_CONFIRMATION_PHRASE;
  const isResetConfirmationValid =
    highestPrivilegeConfirmed && resetConfirmationText.trim() === resetConfirmationPhrase;

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

  async function loadSetupStatus() {
    try {
      const nextStatus = await requestJson<SetupStatusResponse>("/api/setup/status");
      setSetupStatus(nextStatus);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载演示环境状态失败。");
    }
  }

  async function loadMatchInfo(documentId: string) {
    setIsMatchInfoLoading(true);

    try {
      const nextMatchInfo = await requestJson<DocumentMatchInfoResponse>(
        `/api/documents/${documentId}/match-candidates`
      );
      setMatchInfo(nextMatchInfo);

      if (nextMatchInfo.document) {
        upsertDocument(nextMatchInfo.document);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载单据归票信息失败。");
      setMatchInfo(null);
    } finally {
      setIsMatchInfoLoading(false);
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
    if (!validateDocumentUploadFile(file)) {
      return;
    }

    const nextDocumentType =
      uploadType === "CONTRACT" && looksLikePackingListFileName(file.name)
        ? await new Promise<DocumentType>((resolve) => {
            Modal.confirm({
              title: "文件看起来像箱单",
              content: `你当前选择的是“合同”，但文件名“${file.name}”看起来更像“箱单”。要切换为箱单上传吗？`,
              okText: "切换为箱单",
              cancelText: "保持合同",
              centered: true,
              onOk: () => resolve("PACKING_LIST"),
              onCancel: () => resolve("CONTRACT")
            });
          })
        : uploadType;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", nextDocumentType);

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

  async function handleConfirmDocumentPackage(packageDraftId?: string) {
    if (!selectedDocument) {
      return;
    }

    setMatchingAction(`confirm:${packageDraftId ?? "current"}`);

    try {
      const result = await requestJson<DocumentMatchInfoResponse>(
        `/api/documents/${selectedDocument.id}/match/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            packageDraftId: packageDraftId ?? selectedCurrentPackage?.id,
            reason: "人工确认该单据属于当前资料包。"
          })
        }
      );

      upsertDocument(result.document);
      setMatchInfo(result);
      message.success("单据归票结果已人工确认。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "人工确认归票失败。");
    } finally {
      setMatchingAction(null);
    }
  }

  async function handleCreateDocumentPackage() {
    if (!selectedDocument) {
      return;
    }

    setMatchingAction("create-package");

    try {
      const result = await requestJson<DocumentMatchInfoResponse>(
        `/api/documents/${selectedDocument.id}/match/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            createNew: true,
            reason: "人工新建资料包并确认该单据归入。"
          })
        }
      );

      upsertDocument(result.document);
      setMatchInfo(result);
      message.success("已新建资料包并完成归票。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "新建资料包失败。");
    } finally {
      setMatchingAction(null);
    }
  }

  async function handleIgnoreDocumentMatch() {
    if (!selectedDocument) {
      return;
    }

    setMatchingAction("ignore");

    try {
      const result = await requestJson<DocumentMatchInfoResponse>(
        `/api/documents/${selectedDocument.id}/match/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ignore: true,
            reason: "人工标记该单据暂不参与当前业务资料包。"
          })
        }
      );

      upsertDocument(result.document);
      setMatchInfo(result);
      message.success("该单据已标记为无关单据。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "标记无关失败。");
    } finally {
      setMatchingAction(null);
    }
  }

  async function handleRematchDocument() {
    if (!selectedDocument) {
      return;
    }

    setMatchingAction("rematch");

    try {
      const result = await requestJson<DocumentMatchInfoResponse>(
        `/api/documents/${selectedDocument.id}/match/rematch`,
        {
          method: "POST"
        }
      );

      upsertDocument(result.document);
      setMatchInfo(result);
      message.success("已重新执行自动归票。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重新归票失败。");
    } finally {
      setMatchingAction(null);
    }
  }

  async function handleConfirmBusinessData(documentId?: string) {
    const targetDocumentId = documentId ?? selectedDocument?.id;
    const targetDocument =
      documents.find((item) => item.id === targetDocumentId) ?? selectedDocument ?? null;

    if (!targetDocumentId || !targetDocument) {
      return;
    }

    const businessDocumentGate = getBusinessDocumentGateForDocument(activeDocuments, targetDocument);

    if (!businessDocumentGate.isReady) {
      message.warning(businessDocumentGate.message);
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

  function openDeleteModal(document: DocumentRecord) {
    setDeleteTarget(document);
  }

  async function handleDeleteSubmit() {
    if (!deleteTarget) {
      return;
    }

    setIsDeleting(true);

    try {
      await requestJson<DocumentMutationResponse>(`/api/documents/${deleteTarget.id}`, {
        method: "DELETE"
      });

      removeDocument(deleteTarget.id);
      setLatestBusinessResult(null);
      setDeleteTarget(null);
      message.success("单据已删除。");
      await loadDocuments();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败。");
    } finally {
      setIsDeleting(false);
    }
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

    if (!validateDocumentUploadFile(file)) {
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

  async function openChangeLogModal(document: DocumentRecord) {
    setChangeLogTarget(document);
    setIsChangeLogLoading(true);

    try {
      const logs = await requestJson<DocumentChangeLog[]>(`/api/documents/${document.id}/change-logs`);
      setChangeLogs(logs);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载变更留痕失败。");
      setChangeLogs([]);
    } finally {
      setIsChangeLogLoading(false);
    }
  }

  function handleArchiveDocument(document: DocumentRecord) {
    Modal.confirm({
      title: "归档单据",
      content:
        "归档不会删除文件、合同、批次、二维码或库存流水，只会把这份单据标记为归档留存。归档后不能再继续编辑、作废或替换。",
      okText: "确认归档",
      cancelText: "取消",
      onOk: async () => {
        setArchivingDocumentId(document.id);

        try {
          const result = await requestJson<DocumentMutationResponse>(`/api/documents/${document.id}/archive`, {
            method: "POST"
          });

          if (result.document) {
            upsertDocument(result.document);
          }

          setLatestBusinessResult(null);
          message.success("单据已归档。");
        } catch (error) {
          message.error(error instanceof Error ? error.message : "归档失败。");
        } finally {
          setArchivingDocumentId(null);
        }
      }
    });
  }

  async function handleResetDemoEnvironment() {
    if (!isResetConfirmationValid) {
      message.warning(`请先勾选最高权限确认，并输入“${resetConfirmationPhrase}”。`);
      return;
    }

    setIsResetting(true);

    try {
      const result = await requestJson<ResetDemoResponse>("/api/setup/reset-demo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          highestPrivilegeConfirmed: true,
          confirmationText: resetConfirmationText.trim()
        })
      });

      setSelectedDocumentId(null);
      setLatestBusinessResult(null);
      setDeleteTarget(null);
      setVoidTarget(null);
      setReplaceTarget(null);
      setReplaceFileList([]);
      setHistoryTarget(null);
      setHistoryDocuments([]);
      setChangeLogTarget(null);
      setChangeLogs([]);
      setMatchInfo(null);
      setIsResetModalOpen(false);
      setHighestPrivilegeConfirmed(false);
      setResetConfirmationText("");

      await Promise.all([loadDocuments(), loadSetupStatus()]);

      message.success(result.message);

      if (result.fileWarnings.length > 0) {
        message.warning(result.fileWarnings.join("；"));
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "重置演示环境失败。");
    } finally {
      setIsResetting(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    void loadSetupStatus();
  }, []);

  useEffect(() => {
    if (!selectedDocument || selectedDocument.aiStatus !== "EXTRACTED") {
      setMatchInfo(null);
      return;
    }

    void loadMatchInfo(selectedDocument.id);
  }, [selectedDocument?.id, selectedDocument?.aiStatus, selectedDocument?.updatedAt]);

  useEffect(() => {
    form.setFieldsValue(selectedDraftValues);
  }, [form, selectedDraftValues]);

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
      title: "归票状态",
      key: "matchStatus",
      width: 150,
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {renderMatchStatusTag(record.matchStatus)}
          {record.matchConfidence > 0 ? (
            <Typography.Text type="secondary">{record.matchConfidence}%</Typography.Text>
          ) : null}
        </Space>
      )
    },
    {
      title: "资料包",
      key: "packageDraft",
      width: 240,
      render: (_, record) => (
        <Typography.Text className="documents-secondary-text">
          {record.packageItem?.packageDraft
            ? getPackageDisplayName(record.packageItem.packageDraft)
            : "未归入资料包"}
        </Typography.Text>
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
      width: 380,
      render: (_, record) => {
        const recordBusinessGate = getBusinessDocumentGateForDocument(activeDocuments, record);

        return (
        <Space wrap>
          <Button size="small" onClick={() => setSelectedDocumentId(record.id)}>
            查看
          </Button>

          {record.status === "REPLACED" ? (
            <Button
              size="small"
              icon={<HistoryOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                void openHistoryModal(record);
              }}
            >
              查看历史
            </Button>
          ) : null}

          <Button
            size="small"
            icon={<HistoryOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              void openChangeLogModal(record);
            }}
          >
            留痕
          </Button>

          {canReExtractDocument(record) ? (
            <Button
              size="small"
              type="primary"
              icon={<RobotOutlined />}
              loading={extractingDocumentId === record.id}
              onClick={(event) => {
                event.stopPropagation();
                void handleExtract(record.id);
              }}
            >
              {record.aiStatus === "EXTRACTED" ? "重新识别" : "AI 识别"}
            </Button>
          ) : null}

          {canConfirmBusinessData(record) ? (
            <Button
              size="small"
              icon={<CheckCircleOutlined />}
              disabled={!recordBusinessGate.isReady}
              title={recordBusinessGate.isReady ? undefined : recordBusinessGate.message}
              loading={isConfirmingBusinessData && selectedDocument?.id === record.id}
              onClick={(event) => {
                event.stopPropagation();
                void handleConfirmBusinessData(record.id);
              }}
            >
              确认生成业务
            </Button>
          ) : null}

          {canDeleteDocument(record) ? (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                openDeleteModal(record);
              }}
            >
              删除
            </Button>
          ) : null}

          {canVoidDocument(record) ? (
            <Button
              size="small"
              danger
              icon={<StopOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                openVoidModal(record);
              }}
            >
              作废
            </Button>
          ) : null}

          {canReplaceDocument(record) ? (
            <Button
              size="small"
              icon={<SwapOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                openReplaceModal(record);
              }}
            >
              替换
            </Button>
          ) : null}

          {canArchiveDocument(record) ? (
            <Button
              size="small"
              icon={<FileDoneOutlined />}
              loading={archivingDocumentId === record.id}
              onClick={(event) => {
                event.stopPropagation();
                handleArchiveDocument(record);
              }}
            >
              归档
            </Button>
          ) : null}

          {record.fileUrl ? (
            <Button
              size="small"
              href={resolveApiUrl(record.fileUrl)}
              target="_blank"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              原文件
            </Button>
          ) : null}
        </Space>
      );
      }
    }
  ];

  const generatedContract = selectedDocument?.sourceContracts[0] ?? null;
  const generatedBatch = selectedDocument?.sourceBatches[0] ?? null;
  const isBusinessGenerated = selectedDocument ? getBusinessStatus(selectedDocument) : false;
  const isDraftEditable = selectedDocument ? canEditDraft(selectedDocument) : false;
  const selectedMatchCandidates = activeMatchInfo?.candidates ?? [];
  const selectedMatchLogs = activeMatchInfo?.logs ?? [];
  const selectedPackageDocuments = getActivePackageDocuments(selectedCurrentPackage);
  const selectedDraftPreviewItems: DescriptionsProps["items"] = [
    {
      key: "contractNoDraft",
      label: "合同草稿号",
      children: selectedDraftValues.contractNoDraft ?? selectedDocument?.contractNoDraft ?? "-"
    },
    {
      key: "batchNoDraft",
      label: "批次草稿号",
      children: selectedDraftValues.batchNoDraft ?? selectedDocument?.batchNoDraft ?? "-"
    },
    {
      key: "productName",
      label: "货物名称",
      children: selectedDraftValues.productName ?? "-"
    },
    {
      key: "customerName",
      label: "客户名称",
      children: selectedDraftValues.customerName ?? "-"
    },
    {
      key: "supplierName",
      label: "供应商名称",
      children: selectedDraftValues.supplierName ?? "-"
    },
    {
      key: "destinationWarehouse",
      label: "目的仓库",
      children: selectedDraftValues.destinationWarehouse ?? "-"
    },
    {
      key: "totalQuantity",
      label: "数量 / 单位",
      children: formatDraftQuantity(selectedDraftValues.totalQuantity, selectedDraftValues.unit)
    },
    {
      key: "amount",
      label: "金额 / 币种",
      children: formatAmount(selectedDraftValues.amount, selectedDraftValues.currency)
    }
  ].filter(Boolean) as DescriptionsProps["items"];

  const generatedItems: DescriptionsProps["items"] = [
    generatedContract
      ? {
          key: "contract",
          label: "正式合同",
          children: `${generatedContract.contractNo} · ${
            contractTypeLabelMap[generatedContract.contractType] ?? generatedContract.contractType
          } · 执行进度 ${generatedContract.executionProgress}% · ${generatedContract.totalQuantity}${
            generatedContract.unit
          } · ${formatAmount(generatedContract.amount, generatedContract.currency)}`
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
                  上传合同 / 单据
                </Typography.Title>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  先选择单据类型，再上传文件。系统会先校验文件格式；格式不支持时不会进入上传和 AI Mock 识别。
                </Typography.Paragraph>
              </div>

              <div className="documents-format-hints">
                {supportedFormatGroups.map((group) => (
                  <div className="documents-format-row" key={group.title}>
                    <Typography.Text strong>{group.title}</Typography.Text>
                    <Typography.Text>{group.formats}</Typography.Text>
                    <Typography.Text type="secondary">{group.note}</Typography.Text>
                  </div>
                ))}
              </div>

              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                value={uploadType}
                options={documentTypeOptions}
                onChange={(event) => setUploadType(event.target.value as DocumentType)}
              />

              <Upload
                accept={supportedUploadAccept}
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
                    支持 PDF / Word / 图片 / Excel / CSV。Excel 明细会解析为表格草稿，库存不会因此增加。
                  </Typography.Paragraph>
                </div>
              </Upload>

              <Alert
                type="warning"
                showIcon
                message="不支持的格式会被拒绝"
                description={unsupportedFileTypeMessage}
              />

              <Alert
                type="info"
                showIcon
                message="当前规则"
                description="AI 识别结果默认来自后端演示场景。删除与作废都会进入审计记录；已生成业务数据的单据不能删除，只能作废或替换，且不会影响合同、批次、二维码和库存流水。"
              />

              <Card size="small" className="placeholder-card" title="成熟版关键节点提醒">
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Space wrap>
                    {renderPreparedStatusTag("合同", contractPreparedStatus)}
                    {renderPreparedStatusTag("箱单", packingListPreparedStatus)}
                    {renderPreparedStatusTag("提单", billOfLadingPreparedStatus)}
                    {renderPreparedStatusTag("发票", invoicePreparedStatus)}
                    {renderPreparedStatusTag("产地证", certificatePreparedStatus)}
                    {renderPreparedStatusTag("清关附件", customsAttachmentPreparedStatus)}
                  </Space>

                  <Alert
                    type={hasMinimumBusinessDocuments ? "success" : "warning"}
                    showIcon
                    message={
                      hasMinimumBusinessDocuments
                        ? "成熟版首轮业务生成建议条件已满足"
                        : "成熟版建议先补齐合同 + 箱单"
                    }
                    description={
                      hasMinimumBusinessDocuments
                        ? "你现在至少已经有一份已识别合同和一份已识别箱单。建议继续人工核对无误后，再生成正式业务数据。"
                        : "当前 Demo 仍可继续演示，但按成熟版本思路，通常不会只凭单张单据就直接进入正式业务数据。"
                    }
                  />

                  <Steps
                    size="small"
                    direction="vertical"
                    items={matureDocumentSteps.map((item) => ({
                      title: item.title,
                      status: item.status,
                      description: item.description
                    }))}
                  />
                </Space>
              </Card>

              <Card size="small" className="placeholder-card">
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <div>
                    <Typography.Text strong>演示管理员</Typography.Text>
                    <Typography.Paragraph type="secondary" style={{ margin: "8px 0 0" }}>
                      一键清空当前演示业务数据并回到空白演示起点。会清空当前单据、合同、批次、二维码、库存流水、
                      采购/物流/工单等演示业务数据，但保留基础组织、仓库和网页 AI 升级配置。默认演示单据图片已随客户包附带，
                      可以直接从“测试资料”中选择上传。
                    </Typography.Paragraph>
                  </div>

                  {standardScenario ? (
                    <Descriptions
                      bordered
                      size="small"
                      column={1}
                      items={[
                        {
                          key: "scenario",
                          label: "标准场景",
                          children: standardScenario.scenarioName
                        },
                        {
                          key: "route",
                          label: "默认路线",
                          children: `${standardScenario.origin} → ${standardScenario.destinationWarehouse}`
                        },
                        {
                          key: "goods",
                          label: "默认货物",
                          children: `${standardScenario.productName} · ${standardScenario.totalQuantity}${standardScenario.unit}`
                        },
                        {
                          key: "outbound",
                          label: "计划出库",
                          children: `${standardScenario.plannedOutboundQuantity}${standardScenario.unit}`
                        },
                        {
                          key: "remaining",
                          label: "理论剩余",
                          children: `${standardScenario.expectedRemainingQuantity ?? Math.max(
                            standardScenario.totalQuantity - standardScenario.plannedOutboundQuantity,
                            0
                          )}${standardScenario.unit}`
                        }
                      ]}
                    />
                  ) : (
                    <Alert type="warning" showIcon message="标准演示场景加载中" />
                  )}

                  {activeScenario ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      当前激活演示场景：{activeScenario.customerName} / {activeScenario.supplierName} /{" "}
                      {activeScenario.amount} {activeScenario.currency}
                    </Typography.Paragraph>
                  ) : null}

                  {isCustomerDemo ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      默认素材已包含在客户包内，可直接用于上传识别。
                    </Typography.Paragraph>
                  ) : (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      默认素材目录：`pics`
                    </Typography.Paragraph>
                  )}

                  <Button
                    danger
                    icon={<ReloadOutlined />}
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={!setupStatus?.resetCapability.enabled}
                  >
                    回到空白演示起点
                  </Button>
                </Space>
              </Card>
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

          <Card className="placeholder-card document-detail-card" title="识别结果与人工修正" style={{ marginTop: 20 }}>
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
                    <Button danger icon={<DeleteOutlined />} onClick={() => openDeleteModal(selectedDocument)}>
                      删除单据
                    </Button>
                  ) : null}

                  {canVoidDocument(selectedDocument) ? (
                    <Button danger icon={<StopOutlined />} onClick={() => openVoidModal(selectedDocument)}>
                      作废单据
                    </Button>
                  ) : null}

                  {canReplaceDocument(selectedDocument) ? (
                    <Button icon={<SwapOutlined />} onClick={() => openReplaceModal(selectedDocument)}>
                      替换新版本
                    </Button>
                  ) : null}

                  <Button icon={<HistoryOutlined />} onClick={() => void openChangeLogModal(selectedDocument)}>
                    查看变更留痕
                  </Button>

                  {canArchiveDocument(selectedDocument) ? (
                    <Button
                      icon={<FileDoneOutlined />}
                      loading={archivingDocumentId === selectedDocument.id}
                      onClick={() => handleArchiveDocument(selectedDocument)}
                    >
                      归档单据
                    </Button>
                  ) : null}

                  {selectedDocument.status === "REPLACED" ? (
                    <>
                      <Button icon={<HistoryOutlined />} onClick={() => void openHistoryModal(selectedDocument)}>
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

                {selectedDocument.status === "ARCHIVED" ? (
                  <Alert
                    type="info"
                    showIcon
                    message="这份单据已经归档"
                    description="归档只代表文件与业务依据进入留存状态，不会删除合同、批次、二维码或库存流水。"
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

                {selectedDocument.aiStatus === "EXTRACTED" &&
                !selectedDocument.businessCreated &&
                selectedDocument.status === "ACTIVE" ? (
                  <Alert
                    type={selectedDocumentBusinessGate?.isReady ? "info" : "warning"}
                    showIcon
                    message={
                      selectedDocumentBusinessGate?.isReady
                        ? "当前仍是识别草稿"
                        : "当前仍是识别草稿，且暂不满足正式生成条件"
                    }
                    description={
                      selectedDocumentBusinessGate?.isReady
                        ? "这里展示的字段还只是识别草稿。你可以先人工修正，再确认生成业务数据。删除草稿单据不会影响任何库存。"
                        : `${selectedDocumentBusinessGate?.message ?? "当前这票业务还缺少必要单据。"} 删除草稿单据不会影响任何库存。`
                    }
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

                {selectedDocument.aiStatus === "EXTRACTED" ? (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <div>
                      <Typography.Text strong>识别结果预览</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        这里展示合同 / 箱单里识别出来的关键字段，保存修正后只会更新草稿，不会直接生成正式业务数据。
                      </Typography.Paragraph>
                    </div>

                    <Descriptions bordered size="small" column={1} items={selectedDraftPreviewItems} />

                    {notes.length > 0 ? (
                      <Alert
                        type="info"
                        showIcon
                        message="识别备注"
                        description={
                          <Space direction="vertical" size={4} style={{ width: "100%" }}>
                            {notes.map((item) => (
                              <Typography.Text key={item}>{item}</Typography.Text>
                            ))}
                          </Space>
                        }
                      />
                    ) : null}

                    <div>
                      <Typography.Text strong>人工修正</Typography.Text>
                      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                        你可以直接改合同号、批次号、货物、数量、金额等字段，再点击保存。
                      </Typography.Paragraph>
                    </div>

                    <Form form={form} layout="vertical" onFinish={(values) => void handleSave(values)}>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={12}>
                          <Form.Item label="合同草稿号" name="contractNoDraft">
                            <Input placeholder="例如 CTR-DEMO-202606-001" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="批次草稿号" name="batchNoDraft">
                            <Input placeholder="例如 BAT-DEMO-202606-001" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="货物名称" name="productName">
                            <Input placeholder="例如 铜缆演示货物" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="目的仓库" name="destinationWarehouse">
                            <Input placeholder="例如 赞比亚仓库" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="客户名称" name="customerName">
                            <Input placeholder="例如 赞比亚客户 ABC Trading" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="供应商名称" name="supplierName">
                            <Input placeholder="例如 中国供应商 China Supplier Co., Ltd." disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="数量" name="totalQuantity">
                            <InputNumber min={0} style={{ width: "100%" }} disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="单位" name="unit">
                            <Input placeholder="例如 箱" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="金额" name="amount">
                            <InputNumber min={0} style={{ width: "100%" }} disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item label="币种" name="currency">
                            <Input placeholder="例如 USD" disabled={!isDraftEditable} />
                          </Form.Item>
                        </Col>
                      </Row>

                      <Space wrap>
                        <Button
                          type="primary"
                          htmlType="submit"
                          icon={<SaveOutlined />}
                          loading={isSaving}
                          disabled={!isDraftEditable}
                        >
                          保存修正
                        </Button>
                        {!isDraftEditable ? <Typography.Text type="secondary">草稿已锁定，仅可查看。</Typography.Text> : null}
                      </Space>
                    </Form>
                  </Space>
                ) : null}

                {selectedDocument.aiStatus === "EXTRACTED" ? (
                  <Card
                    className="placeholder-card document-match-card"
                    size="small"
                    title="单据归票 / 同票识别"
                    loading={isMatchInfoLoading}
                    extra={
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={matchingAction === "rematch"}
                        disabled={selectedDocument.businessCreated || selectedDocument.status !== "ACTIVE"}
                        onClick={() => void handleRematchDocument()}
                      >
                        重新匹配
                      </Button>
                    }
                  >
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Alert
                        type={
                          selectedDocument.matchStatus === "CONFLICTED"
                            ? "error"
                            : selectedDocument.matchStatus === "NEEDS_CONFIRMATION"
                              ? "warning"
                              : "info"
                        }
                        showIcon
                        message={
                          selectedDocument.matchStatus === "AUTO_MATCHED" ||
                          selectedDocument.matchStatus === "MANUAL_CONFIRMED"
                            ? "系统已经把该单据归入资料包"
                            : selectedDocument.matchStatus === "NEEDS_CONFIRMATION"
                              ? "系统找到候选资料包，需要人工确认"
                              : selectedDocument.matchStatus === "CONFLICTED"
                                ? "存在冲突候选，请人工处理"
                                : selectedDocument.matchStatus === "IGNORED"
                                  ? "该单据已被标记为无关"
                                  : "该单据暂未归入资料包"
                        }
                        description={
                          selectedDocument.matchReason ??
                          "归票只代表单据之间的草稿关联，不会生成正式合同、批次、二维码或库存。"
                        }
                      />

                      <Descriptions
                        bordered
                        size="small"
                        column={1}
                        items={[
                          {
                            key: "matchStatus",
                            label: "归票状态",
                            children: (
                              <Space wrap>
                                {renderMatchStatusTag(selectedDocument.matchStatus)}
                                <Typography.Text type="secondary">
                                  置信度 {selectedDocument.matchConfidence}%
                                </Typography.Text>
                                {selectedDocument.manualMatchLocked ? <Tag color="blue">人工锁定</Tag> : null}
                              </Space>
                            )
                          },
                          {
                            key: "packageNo",
                            label: "当前资料包",
                            children: selectedCurrentPackage
                              ? getPackageDisplayName(selectedCurrentPackage)
                              : "未归入资料包"
                          },
                          {
                            key: "packageSummary",
                            label: "资料包摘要",
                            children: selectedCurrentPackage?.matchSummary ?? "-"
                          }
                        ]}
                      />

                      {selectedCurrentPackage ? (
                        <Card size="small" title="当前资料包内单据">
                          {selectedPackageDocuments.length > 0 ? (
                            <List
                              size="small"
                              dataSource={selectedPackageDocuments}
                              renderItem={(item) => (
                                <List.Item>
                                  <Space wrap>
                                    <Tag color="processing">{documentTypeLabelMap[item.documentType]}</Tag>
                                    <Typography.Text>{item.originalName ?? item.fileName}</Typography.Text>
                                    <Tag color={aiStatusConfig[item.aiStatus].color}>
                                      {aiStatusConfig[item.aiStatus].label}
                                    </Tag>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          ) : (
                            <Empty description="当前资料包还没有可用于正式生成的已识别单据。" />
                          )}
                        </Card>
                      ) : null}

                      <Space wrap>
                        {selectedCurrentPackage && !selectedDocument.businessCreated ? (
                          <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            loading={matchingAction === `confirm:${selectedCurrentPackage.id}`}
                            disabled={selectedDocument.status !== "ACTIVE"}
                            onClick={() => void handleConfirmDocumentPackage(selectedCurrentPackage.id)}
                          >
                            人工确认当前资料包
                          </Button>
                        ) : null}

                        {!selectedDocument.businessCreated ? (
                          <Button
                            icon={<DeploymentUnitOutlined />}
                            loading={matchingAction === "create-package"}
                            disabled={selectedDocument.status !== "ACTIVE"}
                            onClick={() => void handleCreateDocumentPackage()}
                          >
                            新建资料包
                          </Button>
                        ) : null}

                        {!selectedDocument.businessCreated && selectedDocument.matchStatus !== "IGNORED" ? (
                          <Button
                            danger
                            loading={matchingAction === "ignore"}
                            disabled={selectedDocument.status !== "ACTIVE"}
                            onClick={() => void handleIgnoreDocumentMatch()}
                          >
                            标记无关
                          </Button>
                        ) : null}
                      </Space>

                      {selectedMatchCandidates.length > 0 ? (
                        <Card size="small" title="候选资料包 / 冲突提示">
                          <List<DocumentPackageCandidate>
                            size="small"
                            dataSource={selectedMatchCandidates.slice(0, 6)}
                            renderItem={(candidate) => (
                              <List.Item
                                actions={
                                  candidate.status === "CONFLICT"
                                    ? []
                                    : [
                                        <Button
                                          key="confirm"
                                          size="small"
                                          type="link"
                                          loading={matchingAction === `confirm:${candidate.packageDraft.id}`}
                                          disabled={selectedDocument.businessCreated}
                                          onClick={() => void handleConfirmDocumentPackage(candidate.packageDraft.id)}
                                        >
                                          确认归入
                                        </Button>
                                      ]
                                }
                              >
                                <List.Item.Meta
                                  title={
                                    <Space wrap>
                                      <Tag color={packageCandidateStatusConfig[candidate.status].color}>
                                        {packageCandidateStatusConfig[candidate.status].label}
                                      </Tag>
                                      <Typography.Text>{candidate.packageDraft.packageNo}</Typography.Text>
                                      <Typography.Text type="secondary">
                                        {candidate.confidence}%
                                      </Typography.Text>
                                    </Space>
                                  }
                                  description={candidate.reason}
                                />
                              </List.Item>
                            )}
                          />
                        </Card>
                      ) : null}

                      {selectedMatchLogs.length > 0 ? (
                        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                          最近归票记录：{formatDateTime(selectedMatchLogs[0].createdAt)} ·{" "}
                          {selectedMatchLogs[0].reason ?? selectedMatchLogs[0].eventType}
                        </Typography.Paragraph>
                      ) : null}
                    </Space>
                  </Card>
                ) : null}
              </Space>
            ) : (
              <Empty description="从左侧上传第一份合同或箱单后，这里会显示识别结果、删除/作废动作和正式业务数据入口。" />
            )}
          </Card>
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
              scroll={{ x: 1980 }}
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
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <Card className="placeholder-card" title="正式业务数据生成" size="small">
              {selectedDocument ? (
                selectedDocument.businessCreated ? (
                  <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                    <Descriptions bordered size="small" column={1} items={generatedItems} />

                    <Space wrap>
                      <Button icon={<BarsOutlined />} onClick={() => navigate("/contracts")}>
                        查看合同数据
                      </Button>
                      <Button icon={<DeploymentUnitOutlined />} onClick={() => navigate("/batches")}>
                        查看批次追踪
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
                      type={selectedDocumentBusinessGate?.isReady ? "success" : "warning"}
                      showIcon
                      message={
                        selectedDocumentBusinessGate?.isReady
                          ? "成熟版建议条件已满足：合同 + 箱单"
                          : "成熟版建议条件未满足：至少准备合同 + 箱单"
                      }
                      description={
                        selectedDocumentBusinessGate?.isReady
                          ? "当前这票业务已至少具备一份已识别合同和一份已识别箱单。你可以继续修正字段，再决定是否确认生成正式业务数据。"
                          : selectedDocumentBusinessGate?.message ??
                            "当前这票业务还不满足生成正式业务数据的前置条件。"
                      }
                    />

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
                      disabled={!canConfirmBusinessData(selectedDocument) || !selectedDocumentBusinessGate?.isReady}
                      title={selectedDocumentBusinessGate?.isReady ? undefined : selectedDocumentBusinessGate?.message}
                      onClick={() => void handleConfirmBusinessData()}
                    >
                      确认生成业务数据
                    </Button>

                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      草稿删除不会影响库存；只有在生成二维码并扫码入库后，库存才会变化。
                    </Typography.Paragraph>
                  </Space>
                )
              ) : (
                <Empty description="从左侧上传第一份合同或箱单后，这里会显示正式业务数据入口。" />
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

            {selectedSpreadsheetExtraction ? (
              <Card className="placeholder-card spreadsheet-preview-card" size="small" title="Excel / CSV 明细预览">
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  <Alert
                    type="info"
                    showIcon
                    message="结构化单据已解析"
                    description="下方表格来自 Excel/CSV 草稿解析结果，仅用于人工核对和生成业务数据前的草稿确认，不会直接增加库存。"
                  />

                  <Descriptions
                    bordered
                    size="small"
                    column={1}
                    items={[
                      {
                        key: "format",
                        label: "来源格式",
                        children: selectedSpreadsheetExtraction.sourceFormat === "csv" ? "CSV" : "Excel"
                      },
                      {
                        key: "activeSheet",
                        label: "当前工作表",
                        children: selectedSpreadsheetExtraction.activeSheetName ?? "-"
                      },
                      {
                        key: "sheetCount",
                        label: "工作表摘要",
                        children:
                          selectedSpreadsheetExtraction.sheets
                            ?.map((sheet) => `${sheet.name}：${sheet.rowCount}行 / ${sheet.columnCount}列`)
                            .join("；") || "-"
                      },
                      {
                        key: "headerMap",
                        label: "表头映射",
                        children: selectedSpreadsheetExtraction.headerMap
                          ? Object.entries(selectedSpreadsheetExtraction.headerMap).map(([field, header]) => (
                              <Tag key={field} color="blue">
                                {field} → {formatChangeValue(header)}
                              </Tag>
                            ))
                          : "-"
                      }
                    ]}
                  />

                  {selectedSpreadsheetExtraction.warnings?.length ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="解析提醒"
                      description={selectedSpreadsheetExtraction.warnings.join("；")}
                    />
                  ) : null}

                  {selectedSpreadsheetRows.length > 0 && selectedSpreadsheetColumns.length > 0 ? (
                    <Table<Record<string, unknown>>
                      size="small"
                      rowKey="__rowKey"
                      dataSource={selectedSpreadsheetRows.map((row, index) => ({
                        ...row,
                        __rowKey: index
                      }))}
                      columns={selectedSpreadsheetColumns}
                      pagination={false}
                      scroll={{ x: "max-content" }}
                    />
                  ) : (
                    <Empty description="当前 Excel/CSV 没有可预览的明细行。" />
                  )}
                </Space>
              </Card>
            ) : null}
          </Space>
        </Col>
      </Row>

      <Modal
        title="回到空白演示起点"
        open={isResetModalOpen}
        onCancel={() => {
          setIsResetModalOpen(false);
          setHighestPrivilegeConfirmed(false);
          setResetConfirmationText("");
        }}
        onOk={() => void handleResetDemoEnvironment()}
        confirmLoading={isResetting}
        okText="确认重置"
        okButtonProps={{ danger: true, disabled: !isResetConfirmationValid }}
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="这会回到空白演示起点"
            description={
              standardScenario
                ? `将删除当前演示单据、正式合同、批次、二维码、库存流水、采购单、物流记录、工单等业务数据，并清理已上传单据文件与二维码图片。重置后系统只保留标准场景参数与基础底座，不再自动生成单据、合同、批次和库存；请从客户包内附带的测试资料重新开始演示。`
                : "将删除当前演示单据、正式合同、批次、二维码、库存流水、采购单、物流记录、工单等业务数据，并清理已上传单据文件与二维码图片。重置后系统会回到空白演示起点。"
            }
          />

          {standardScenario ? (
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: "scenario",
                  label: "恢复后的标准场景",
                  children: standardScenario.scenarioName
                },
                {
                  key: "route",
                  label: "默认路线",
                  children: `${standardScenario.origin} → ${standardScenario.destinationWarehouse}`
                },
                {
                  key: "demo",
                  label: "默认演示参数",
                  children: `${standardScenario.productName} / ${standardScenario.totalQuantity}${standardScenario.unit} / 出库 ${standardScenario.plannedOutboundQuantity}${standardScenario.unit}`
                },
                {
                  key: "note",
                  label: "恢复后状态",
                  children:
                    "回到“合同与单据列表为空、由用户手动上传客户包内默认图片开始识别”的空白演示状态。"
                }
              ]}
            />
          ) : null}

          <Alert
            type="error"
            showIcon
            message="仅最高权限用户可执行"
            description={`请确认你当前以最高权限角色（${setupStatus?.resetCapability.highestPrivilegeRole ?? "OWNER"}）操作。未完成下方确认前，系统不会执行重新测试或重置。`}
          />

          <Checkbox
            checked={highestPrivilegeConfirmed}
            onChange={(event) => setHighestPrivilegeConfirmed(event.target.checked)}
          >
            我确认当前是最高权限用户，并且了解这会清空当前演示业务数据
          </Checkbox>

          <div>
            <Typography.Text strong>请输入确认短语</Typography.Text>
            <Input
              style={{ marginTop: 8 }}
              value={resetConfirmationText}
              onChange={(event) => setResetConfirmationText(event.target.value)}
              placeholder={resetConfirmationPhrase}
            />
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              需要完整输入：{resetConfirmationPhrase}
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>

      <Modal
        title="删除单据"
        open={Boolean(deleteTarget)}
        onCancel={() => {
          setDeleteTarget(null);
        }}
        onOk={() => void handleDeleteSubmit()}
        confirmLoading={isDeleting}
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            type="warning"
            showIcon
            message="只允许删除尚未生成业务数据的草稿单据"
            description="删除后这份草稿会从单据列表中移除，并写入 AuditLog。已经生成合同、批次、采购单或应收草稿的单据不能删除，只能作废或替换。"
          />
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              {
                key: "fileName",
                label: "单据名称",
                children: deleteTarget ? deleteTarget.originalName ?? deleteTarget.fileName : "-"
              },
              {
                key: "documentType",
                label: "单据类型",
                children: deleteTarget ? documentTypeLabelMap[deleteTarget.documentType] : "-"
              },
              {
                key: "createdAt",
                label: "上传时间",
                children: deleteTarget ? formatDateTime(deleteTarget.createdAt) : "-"
              }
            ]}
          />
        </Space>
      </Modal>

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
            description="旧单据会标记为“已替换”，新单据成为当前有效版本。支持 PDF、Word、图片、Excel/CSV；原合同、批次、二维码和库存流水不会被删除。"
          />
          <Upload
            accept={supportedUploadAccept}
            beforeUpload={(file) => {
              if (!validateDocumentUploadFile(file)) {
                return Upload.LIST_IGNORE;
              }

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

      <Modal
        title={changeLogTarget ? `${changeLogTarget.originalName ?? changeLogTarget.fileName} 的变更留痕` : "变更留痕"}
        open={Boolean(changeLogTarget)}
        footer={null}
        width={760}
        onCancel={() => {
          setChangeLogTarget(null);
          setChangeLogs([]);
        }}
      >
        <List<DocumentChangeLog>
          loading={isChangeLogLoading}
          dataSource={changeLogs}
          locale={{ emptyText: "暂无变更留痕。" }}
          renderItem={(item) => {
            const changedFields = item.diffJson?.changedFields ?? [];

            return (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space wrap>
                      <Tag color="processing">
                        {documentChangeEventLabelMap[item.eventType] ?? item.eventType}
                      </Tag>
                      <span>{formatDateTime(item.createdAt)}</span>
                      <Typography.Text type="secondary">
                        操作人：{item.actorName ?? "demo-owner"}
                      </Typography.Text>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size="small" style={{ width: "100%" }}>
                      <Typography.Text>{item.reason ?? "系统留痕"}</Typography.Text>
                      {changedFields.length > 0 ? (
                        <List
                          size="small"
                          bordered
                          dataSource={changedFields.slice(0, 8)}
                          renderItem={(field) => (
                            <List.Item>
                              <Typography.Text>
                                {field.field}：{formatChangeValue(field.before)} → {formatChangeValue(field.after)}
                              </Typography.Text>
                            </List.Item>
                          )}
                        />
                      ) : (
                        <Typography.Text type="secondary">该事件没有字段级差异，属于状态或版本链留痕。</Typography.Text>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Modal>
    </div>
  );
}
