import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AiTaskStatus,
  AiTaskType,
  BatchStatus,
  DocumentAiStatus,
  DocumentMatchStatus,
  DocumentStatus,
  DocumentType,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { demoScenarioConfig } from "../config/demoScenario";
import { env } from "../config/env";
import { documentsUploadDir, workspaceRoot } from "../config/paths";
import { prisma } from "../lib/prisma";
import {
  buildPackageNo,
  buildPackageSummary,
  evaluatePackageCandidates,
  readDocumentDraftSummary
} from "../services/documentMatching";
import { buildDocumentPackageStatus } from "../services/documentPackage";
import { standardScenarioIdentifiers } from "../services/demoFoundation";
import {
  getSupportedUploadHint,
  isSpreadsheetFileName,
  isSupportedDocumentFileName,
  parseSpreadsheetDocument,
  type ParsedSpreadsheetDocument,
  unsupportedFileTypeMessage
} from "../services/documentSpreadsheet";

fs.mkdirSync(documentsUploadDir, { recursive: true });

const allowedDocumentTypes = new Set<string>(Object.values(DocumentType));
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

const replacementDocumentSelect = {
  id: true,
  fileName: true,
  originalName: true,
  status: true,
  version: true,
  createdAt: true
} as const;

const contractSummarySelect = {
  id: true,
  contractNo: true,
  status: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  amount: true,
  currency: true,
  destinationWarehouse: true,
  createdAt: true
} as const;

const batchSummarySelect = {
  id: true,
  batchNo: true,
  status: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  destinationWarehouse: true,
  createdAt: true,
  contractId: true
} as const;

const packageDraftBasicSelect = {
  id: true,
  packageNo: true,
  contractNoDraft: true,
  batchNoDraft: true,
  customerName: true,
  supplierName: true,
  productName: true,
  destinationWarehouse: true,
  status: true,
  source: true,
  matchSummary: true,
  createdAt: true,
  updatedAt: true
} as const;

const documentSelect = {
  id: true,
  documentType: true,
  fileName: true,
  originalName: true,
  filePath: true,
  fileUrl: true,
  mimeType: true,
  size: true,
  status: true,
  aiStatus: true,
  extractedJson: true,
  contractNoDraft: true,
  batchNoDraft: true,
  matchStatus: true,
  matchConfidence: true,
  matchReason: true,
  manualMatchLocked: true,
  isDeleted: true,
  deletedAt: true,
  deletedBy: true,
  voidedAt: true,
  voidedBy: true,
  voidReason: true,
  replacedByDocumentId: true,
  relatedEntityType: true,
  relatedEntityId: true,
  businessCreated: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  replacedByDocument: {
    select: replacementDocumentSelect
  },
  sourceContracts: {
    select: contractSummarySelect
  },
  sourceBatches: {
    select: batchSummarySelect
  },
  packageItem: {
    select: {
      id: true,
      assignmentType: true,
      note: true,
      packageDraft: {
        select: packageDraftBasicSelect
      }
    }
  }
} as const;

const packageDraftSelect = {
  ...packageDraftBasicSelect,
  packageItems: {
    select: {
      id: true,
      assignmentType: true,
      note: true,
      createdAt: true,
      document: {
        select: {
          id: true,
          documentType: true,
          originalName: true,
          fileName: true,
          status: true,
          aiStatus: true,
          contractNoDraft: true,
          batchNoDraft: true,
          matchStatus: true,
          matchConfidence: true,
          matchReason: true,
          manualMatchLocked: true,
          businessCreated: true,
          version: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  }
} as const;

const documentMatchLogSelect = {
  id: true,
  documentId: true,
  packageDraftId: true,
  eventType: true,
  matchStatus: true,
  confidence: true,
  reason: true,
  detailJson: true,
  actorId: true,
  actorName: true,
  createdAt: true
} as const;

const generatedContractSelect = {
  id: true,
  contractNo: true,
  contractType: true,
  status: true,
  executionStatus: true,
  executionProgress: true,
  customerName: true,
  supplierName: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  amount: true,
  currency: true,
  destinationWarehouse: true,
  sourceDocumentId: true,
  createdAt: true
} as const;

const documentChangeLogSelect = {
  id: true,
  documentId: true,
  eventType: true,
  fieldName: true,
  beforeJson: true,
  afterJson: true,
  diffJson: true,
  reason: true,
  actorId: true,
  actorName: true,
  createdAt: true
} as const;

const generatedBatchSelect = {
  id: true,
  batchNo: true,
  contractId: true,
  status: true,
  sku: true,
  productName: true,
  totalQuantity: true,
  unit: true,
  destinationWarehouse: true,
  sourceDocumentId: true,
  createdAt: true
} as const;

const generatedPurchaseOrderSelect = {
  id: true,
  purchaseNo: true,
  contractId: true,
  batchId: true,
  status: true,
  supplierName: true,
  skuName: true,
  quantity: true,
  unit: true,
  deliveryDate: true,
  createdAt: true
} as const;

const generatedPaymentSelect = {
  id: true,
  contractId: true,
  receivableAmount: true,
  receivedAmount: true,
  currency: true,
  status: true,
  dueDate: true,
  createdAt: true
} as const;

const generatedReceivableSelect = {
  id: true,
  contractId: true,
  amount: true,
  currency: true,
  receivedAmount: true,
  status: true,
  dueDate: true,
  createdAt: true
} as const;

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, documentsUploadDir);
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname) || ".bin";
    callback(null, `${Date.now()}-${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

type DocumentWithSummary = Prisma.DocumentGetPayload<{ select: typeof documentSelect }>;

type ConfirmedDocumentDraft = {
  contractNo: string;
  batchNo: string;
  productName: string;
  customerName: string;
  supplierName: string;
  destinationWarehouse: string;
  totalQuantity: number;
  unit: string;
  amount: number;
  currency: string;
};

type AuditActor = {
  userId: string | null;
  username: string | null;
};

type PairedBusinessDocument = {
  id: string;
  documentType: DocumentType;
};

class BusinessConflictError extends Error {}

export const documentsRouter = Router();

function isDocumentType(value: unknown): value is DocumentType {
  return typeof value === "string" && allowedDocumentTypes.has(value);
}

function decodePotentialMojibake(value: string | null | undefined) {
  if (!value) {
    return value ?? null;
  }

  if (!/[\u00C0-\u00FF]/.test(value)) {
    return value;
  }

  const decoded = Buffer.from(value, "latin1").toString("utf8");

  if (decoded.includes("\uFFFD")) {
    return value;
  }

  return /[\u4E00-\u9FFF]/.test(decoded) ? decoded : value;
}

function isInvalidDraftUnit(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0 || value.trim() === "?";
}

function normalizeExtractedJson(extractedJson: Prisma.JsonValue | null | undefined) {
  if (!extractedJson || typeof extractedJson !== "object" || Array.isArray(extractedJson)) {
    return extractedJson ?? null;
  }

  const normalized = extractedJson as Prisma.JsonObject;

  if (!isInvalidDraftUnit(normalized.unit)) {
    return normalized;
  }

  return {
    ...normalized,
    unit: demoScenarioConfig.unit
  } satisfies Prisma.JsonObject;
}

function hasGeneratedBusiness(document: {
  businessCreated: boolean;
  relatedEntityId: string | null;
  sourceContracts: Array<unknown>;
  sourceBatches: Array<unknown>;
}) {
  return (
    document.businessCreated ||
    document.relatedEntityId !== null ||
    document.sourceContracts.length > 0 ||
    document.sourceBatches.length > 0
  );
}

function normalizeDocumentResponse(document: DocumentWithSummary) {
  return {
    ...document,
    originalName: decodePotentialMojibake(document.originalName),
    extractedJson: normalizeExtractedJson(document.extractedJson),
    businessCreated: hasGeneratedBusiness(document),
    replacedByDocument: document.replacedByDocument
      ? {
          ...document.replacedByDocument,
          originalName: decodePotentialMojibake(document.replacedByDocument.originalName)
        }
      : null
  };
}

function normalizeDocumentBaseName(value: string | null | undefined) {
  const decoded = decodePotentialMojibake(value);
  const normalized = (decoded ?? value ?? "").trim();

  return normalized.replace(/\.[^.]+$/, "");
}

function resolveStandardDemoDraftPair(documentType: DocumentType, originalName?: string | null) {
  const baseName = normalizeDocumentBaseName(originalName);

  if (
    (documentType === DocumentType.CONTRACT && baseName === "演示合同-中国采购100箱") ||
    (documentType === DocumentType.PACKING_LIST && baseName === "演示箱单-赞比亚仓库100箱")
  ) {
    return {
      contractNoDraft: standardScenarioIdentifiers.contractNo,
      batchNoDraft: standardScenarioIdentifiers.batchNo
    };
  }

  return null;
}

function buildMockExtraction(
  documentId: string,
  documentType: DocumentType,
  options?: { originalName?: string | null; spreadsheet?: ParsedSpreadsheetDocument | null }
): Prisma.JsonObject {
  const suffix = documentId.slice(-6).toUpperCase();
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const standardDraftPair = resolveStandardDemoDraftPair(documentType, options?.originalName);
  const spreadsheetSummary = options?.spreadsheet?.summaryFields ?? {};
  const readSpreadsheetString = (fieldName: string) => {
    const value = spreadsheetSummary[fieldName];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };
  const readSpreadsheetNumber = (fieldName: string) => {
    const value = spreadsheetSummary[fieldName];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value.replace(/,/g, "").replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return undefined;
  };
  const spreadsheetNotes = options?.spreadsheet
    ? [
        `已解析 ${options.spreadsheet.sourceFormat === "csv" ? "CSV" : "Excel"} 文件，当前使用工作表：${
          options.spreadsheet.activeSheetName ?? "未识别"
        }。`,
        "Excel/CSV 解析结果仍然只是草稿，必须人工确认后才会生成正式业务数据。",
        "Excel/CSV 导入不会直接增加库存，库存仍然只由二维码扫码入库/出库决定。",
        ...options.spreadsheet.warnings
      ]
    : [];

  const extraction: Prisma.JsonObject = {
    source: options?.spreadsheet ? "mock-spreadsheet-extractor-v1" : "mock-document-extractor-v1",
    documentType,
    sourceFormat: options?.spreadsheet?.sourceFormat ?? "file",
    contractNoDraft:
      readSpreadsheetString("contractNoDraft") ??
      standardDraftPair?.contractNoDraft ??
      `CTR-${datePart}-${suffix}`,
    batchNoDraft:
      readSpreadsheetString("batchNoDraft") ??
      standardDraftPair?.batchNoDraft ??
      `BAT-${datePart}-${suffix}`,
    productName: readSpreadsheetString("productName") ?? demoScenarioConfig.productName,
    customerName: readSpreadsheetString("customerName") ?? demoScenarioConfig.customerName,
    supplierName: readSpreadsheetString("supplierName") ?? demoScenarioConfig.supplierName,
    destinationWarehouse: readSpreadsheetString("destinationWarehouse") ?? demoScenarioConfig.destinationWarehouse,
    totalQuantity: readSpreadsheetNumber("totalQuantity") ?? demoScenarioConfig.totalQuantity,
    unit: readSpreadsheetString("unit") ?? demoScenarioConfig.unit,
    amount: readSpreadsheetNumber("amount") ?? demoScenarioConfig.amount,
    currency: readSpreadsheetString("currency") ?? demoScenarioConfig.currency,
    notes: [
      "第一版使用 mock 识别结果。",
      "识别结果来源于当前 DemoConfig，可在人工确认后修改。",
      "正式业务数据创建前，单据仍然只是草稿。",
      ...spreadsheetNotes
    ]
  };

  if (options?.spreadsheet) {
    extraction.spreadsheet = {
      sourceFormat: options.spreadsheet.sourceFormat,
      sheets: options.spreadsheet.sheets,
      activeSheetName: options.spreadsheet.activeSheetName,
      headerMap: options.spreadsheet.headerMap,
      summaryFields: options.spreadsheet.summaryFields,
      lineItems: options.spreadsheet.lineItems,
      previewRows: options.spreadsheet.previewRows,
      warnings: options.spreadsheet.warnings
    };
  }

  return extraction;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readRouteId(value: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function readOptionalString(value: unknown, options?: { rejectQuestionMark?: boolean }) {
  const normalized = readString(value);

  if (normalized.length === 0) {
    return undefined;
  }

  if (options?.rejectQuestionMark && normalized === "?") {
    return undefined;
  }

  return normalized;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function readRequiredString(value: unknown, fieldName: string) {
  const normalized = readOptionalString(value, { rejectQuestionMark: fieldName === "unit" });

  if (!normalized) {
    throw new Error(`Field "${fieldName}" is required before generating business data.`);
  }

  return normalized;
}

function readRequiredInteger(value: unknown, fieldName: string) {
  const normalized = readOptionalNumber(value);

  if (typeof normalized !== "number" || !Number.isInteger(normalized) || normalized <= 0) {
    throw new Error(`Field "${fieldName}" must be a positive integer before generating business data.`);
  }

  return normalized;
}

function readRequiredAmount(value: unknown, fieldName: string) {
  const normalized = readOptionalNumber(value);

  if (typeof normalized !== "number" || normalized < 0) {
    throw new Error(`Field "${fieldName}" must be a valid non-negative number before generating business data.`);
  }

  return normalized;
}

function buildExtractionPatch(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Extraction patch payload must be an object.");
  }

  const source = payload as Record<string, unknown>;

  const patch: Prisma.JsonObject = {};
  const contractNoDraft = readOptionalString(source.contractNoDraft);
  const batchNoDraft = readOptionalString(source.batchNoDraft);
  const productName = readOptionalString(source.productName);
  const customerName = readOptionalString(source.customerName);
  const supplierName = readOptionalString(source.supplierName);
  const destinationWarehouse = readOptionalString(source.destinationWarehouse);
  const unit = readOptionalString(source.unit, { rejectQuestionMark: true });
  const currency = readOptionalString(source.currency);
  const totalQuantity = readOptionalNumber(source.totalQuantity);
  const amount = readOptionalNumber(source.amount);

  if (contractNoDraft) patch.contractNoDraft = contractNoDraft;
  if (batchNoDraft) patch.batchNoDraft = batchNoDraft;
  if (productName) patch.productName = productName;
  if (customerName) patch.customerName = customerName;
  if (supplierName) patch.supplierName = supplierName;
  if (destinationWarehouse) patch.destinationWarehouse = destinationWarehouse;
  if (unit) patch.unit = unit;
  if (currency) patch.currency = currency;
  if (typeof totalQuantity === "number") patch.totalQuantity = totalQuantity;
  if (typeof amount === "number") patch.amount = amount;

  return { patch, contractNoDraft, batchNoDraft };
}

function parseConfirmedDraft(document: DocumentWithSummary): ConfirmedDocumentDraft {
  const extracted =
    document.extractedJson && typeof document.extractedJson === "object" && !Array.isArray(document.extractedJson)
      ? (normalizeExtractedJson(document.extractedJson) as Prisma.JsonObject)
      : {};

  return {
    contractNo: readRequiredString(extracted.contractNoDraft ?? document.contractNoDraft, "contractNoDraft"),
    batchNo: readRequiredString(extracted.batchNoDraft ?? document.batchNoDraft, "batchNoDraft"),
    productName: readRequiredString(extracted.productName, "productName"),
    customerName: readRequiredString(extracted.customerName, "customerName"),
    supplierName: readRequiredString(extracted.supplierName, "supplierName"),
    destinationWarehouse: readRequiredString(extracted.destinationWarehouse, "destinationWarehouse"),
    totalQuantity: readRequiredInteger(extracted.totalQuantity, "totalQuantity"),
    unit: readRequiredString(extracted.unit, "unit"),
    amount: readRequiredAmount(extracted.amount, "amount"),
    currency: readRequiredString(extracted.currency, "currency")
  };
}

async function ensureRequiredBusinessDocuments(
  tx: Prisma.TransactionClient,
  draft: ConfirmedDocumentDraft,
  sourceDocumentId?: string
) {
  let pairedDocuments: PairedBusinessDocument[] = [];

  if (sourceDocumentId) {
    const packageItem = await tx.documentPackageItem.findUnique({
      where: { documentId: sourceDocumentId },
      select: { packageDraftId: true }
    });

    if (packageItem) {
      const packageDocuments = await tx.documentPackageItem.findMany({
        where: { packageDraftId: packageItem.packageDraftId },
        select: {
          document: {
            select: {
              id: true,
              documentType: true,
              status: true,
              aiStatus: true,
              isDeleted: true
            }
          }
        }
      });

      pairedDocuments = packageDocuments
        .map((item) => item.document)
        .filter(
          (item) =>
            !item.isDeleted &&
            item.status === DocumentStatus.ACTIVE &&
            item.aiStatus === DocumentAiStatus.EXTRACTED
        )
        .map((item) => ({
          id: item.id,
          documentType: item.documentType
        }));
    }
  }

  if (pairedDocuments.length === 0) {
    pairedDocuments = await tx.document.findMany({
      where: {
        status: DocumentStatus.ACTIVE,
        aiStatus: DocumentAiStatus.EXTRACTED,
        contractNoDraft: draft.contractNo,
        batchNoDraft: draft.batchNo
      },
      select: {
        id: true,
        documentType: true
      }
    });
  }

  const exactPairDocuments = await tx.document.findMany({
    where: {
      status: DocumentStatus.ACTIVE,
      aiStatus: DocumentAiStatus.EXTRACTED,
      contractNoDraft: draft.contractNo,
      batchNoDraft: draft.batchNo
    },
    select: {
      id: true,
      documentType: true
    }
  });

  const pairedDocumentIds = new Set(pairedDocuments.map((item) => item.id));

  for (const exactPairDocument of exactPairDocuments) {
    if (!pairedDocumentIds.has(exactPairDocument.id)) {
      pairedDocuments.push(exactPairDocument);
      pairedDocumentIds.add(exactPairDocument.id);
    }
  }

  const contractDocument = pairedDocuments.find((item) => item.documentType === DocumentType.CONTRACT) ?? null;
  const packingListDocument = pairedDocuments.find((item) => item.documentType === DocumentType.PACKING_LIST) ?? null;
  const hasContract = Boolean(contractDocument);
  const hasPackingList = Boolean(packingListDocument);

  if (contractDocument && packingListDocument) {
    return {
      contractDocumentId: contractDocument.id,
      packingListDocumentId: packingListDocument.id,
      pairedDocuments
    };
  }

  const missingDocumentTypes = [
    hasContract ? null : "合同",
    hasPackingList ? null : "箱单"
  ].filter((item): item is string => Boolean(item));

  throw new BusinessConflictError(
    `当前这票业务还缺少已识别的${missingDocumentTypes.join(" + ")}，暂不能生成正式业务数据。`
  );
}

async function resolveBusinessReferences(
  tx: Prisma.TransactionClient,
  draft: ConfirmedDocumentDraft
) {
  const [activeDemoConfig, demoOwner] = await Promise.all([
    tx.demoConfig.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "desc" },
      select: {
        customerId: true,
        customerName: true,
        supplierId: true,
        supplierName: true,
        skuId: true,
        productName: true,
        warehouseId: true,
        destinationWarehouse: true
      }
    }),
    tx.user.findUnique({
      where: { username: "demo-owner" },
      select: {
        companyId: true
      }
    })
  ]);

  const fallbackSkuCode = `SKU-${draft.batchNo}`;

  const customerId =
    (activeDemoConfig?.customerName === draft.customerName ? activeDemoConfig.customerId : undefined) ??
    (await tx.customer.findFirst({
      where: { name: draft.customerName },
      select: { id: true }
    }))?.id;

  const supplierId =
    (activeDemoConfig?.supplierName === draft.supplierName ? activeDemoConfig.supplierId : undefined) ??
    (await tx.supplier.findFirst({
      where: { name: draft.supplierName },
      select: { id: true }
    }))?.id;

  const warehouseId =
    (activeDemoConfig?.destinationWarehouse === draft.destinationWarehouse ? activeDemoConfig.warehouseId : undefined) ??
    (await tx.warehouse.findFirst({
      where: { name: draft.destinationWarehouse },
      select: { id: true }
    }))?.id;

  let skuRecord:
    | {
        id: string;
        skuCode: string;
      }
    | null = null;

  if (activeDemoConfig?.productName === draft.productName && activeDemoConfig.skuId) {
    skuRecord = await tx.sku.findUnique({
      where: { id: activeDemoConfig.skuId },
      select: {
        id: true,
        skuCode: true
      }
    });
  }

  if (!skuRecord) {
    skuRecord = await tx.sku.findFirst({
      where: { name: draft.productName },
      select: {
        id: true,
        skuCode: true
      }
    });
  }

  return {
    customerId,
    supplierId,
    warehouseId,
    skuId: skuRecord?.id,
    skuCode: skuRecord?.skuCode ?? fallbackSkuCode,
    companyId: demoOwner?.companyId ?? null
  };
}

async function loadExistingGeneratedBusinessData(tx: Prisma.TransactionClient, documentId: string) {
  const contract = await tx.contract.findFirst({
    where: { sourceDocumentId: documentId },
    select: generatedContractSelect
  });

  if (!contract) {
    return null;
  }

  const [batch, purchaseOrder, payment, receivable] = await Promise.all([
    tx.batch.findFirst({
      where: { sourceDocumentId: documentId },
      select: generatedBatchSelect
    }),
    tx.purchaseOrder.findFirst({
      where: { contractId: contract.id },
      select: generatedPurchaseOrderSelect
    }),
    tx.payment.findFirst({
      where: { contractId: contract.id },
      select: generatedPaymentSelect
    }),
    tx.receivable.findFirst({
      where: { contractId: contract.id },
      select: generatedReceivableSelect
    })
  ]);

  return {
    contract,
    batch,
    purchaseOrder,
    payment,
    receivable
  };
}

async function loadGeneratedBusinessDataByContractId(tx: Prisma.TransactionClient, contractId: string) {
  const contract = await tx.contract.findUnique({
    where: { id: contractId },
    select: generatedContractSelect
  });

  if (!contract) {
    return null;
  }

  const [batch, purchaseOrder, payment, receivable] = await Promise.all([
    tx.batch.findFirst({
      where: { contractId: contract.id },
      select: generatedBatchSelect
    }),
    tx.purchaseOrder.findFirst({
      where: { contractId: contract.id },
      select: generatedPurchaseOrderSelect
    }),
    tx.payment.findFirst({
      where: { contractId: contract.id },
      select: generatedPaymentSelect
    }),
    tx.receivable.findFirst({
      where: { contractId: contract.id },
      select: generatedReceivableSelect
    })
  ]);

  return {
    contract,
    batch,
    purchaseOrder,
    payment,
    receivable
  };
}

function buildSupplierFollowUpWorkOrderNo(purchaseNo: string) {
  return `WO-PROC-${purchaseNo.replace(/^PO-/, "")}`;
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function buildInitialReceiptPaymentPlan(draft: ConfirmedDocumentDraft, dueDate: Date) {
  const plannedPaymentAmount = roundMoney(draft.amount * 0.6);
  const plan = {
    receiptPlan: [
      {
        name: "客户回款计划",
        plannedAmount: draft.amount,
        actualAmount: 0,
        currency: draft.currency,
        dueDate: dueDate.toISOString(),
        status: "UNPAID",
        source: "Payment / Receivable 草稿"
      }
    ],
    paymentPlan: [
      {
        name: "供应商付款计划",
        plannedAmount: plannedPaymentAmount,
        actualAmount: 0,
        currency: draft.currency,
        dueDate: dueDate.toISOString(),
        status: "DEMO_NOT_POSTED",
        source: "阶段22演示底座，正式版由应付单据驱动"
      }
    ],
    comparison: {
      plannedReceiptAmount: draft.amount,
      actualReceiptAmount: 0,
      plannedPaymentAmount,
      actualPaymentAmount: 0,
      receiptGap: draft.amount,
      paymentGap: plannedPaymentAmount
    }
  };

  return {
    plannedPaymentAmount,
    plan
  };
}

async function ensureSupplierFollowUpWorkOrder(
  tx: Prisma.TransactionClient,
  input: {
    purchaseOrder: Prisma.PurchaseOrderGetPayload<{ select: typeof generatedPurchaseOrderSelect }>;
    contractId: string;
    batchId: string | null;
  }
) {
  const existingWorkOrder = await tx.workOrder.findFirst({
    where: {
      type: "SUPPLIER_DELIVERY_FOLLOW_UP",
      relatedEntityType: "PurchaseOrder",
      relatedEntityId: input.purchaseOrder.id
    },
    select: {
      id: true
    }
  });

  if (existingWorkOrder) {
    return existingWorkOrder;
  }

  const startTime = new Date();
  const dueTime = input.purchaseOrder.deliveryDate ?? new Date(Date.now() + 3 * ONE_DAY_IN_MS);

  return tx.workOrder.create({
    data: {
      workOrderNo: buildSupplierFollowUpWorkOrderNo(input.purchaseOrder.purchaseNo),
      type: "SUPPLIER_DELIVERY_FOLLOW_UP",
      title: "供应商发货跟进工单",
      content: `采购单 ${input.purchaseOrder.purchaseNo} 已创建，请继续跟进供应商发货与国内集货。`,
      responsibleDepartment: "采购部",
      responsiblePerson: "Demo Procurement Owner",
      status: "PENDING",
      priority: "NORMAL",
      startTime,
      dueTime,
      contractId: input.contractId,
      batchId: input.batchId,
      relatedEntityType: "PurchaseOrder",
      relatedEntityId: input.purchaseOrder.id,
      completionCondition: "确认供应商发货并完成国内集货，然后交接国际物流。"
    },
    select: {
      id: true
    }
  });
}

async function resolveAuditActor(tx: Prisma.TransactionClient | typeof prisma): Promise<AuditActor> {
  const demoOwner = await tx.user.findUnique({
    where: { username: "demo-owner" },
    select: {
      id: true,
      username: true
    }
  });

  return {
    userId: demoOwner?.id ?? null,
    username: demoOwner?.username ?? "demo-owner"
  };
}

function readAuditContext(request: Request) {
  return {
    ip: request.ip ?? null,
    userAgent: request.get("user-agent") ?? null
  };
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function toJsonObjectValue(value: unknown): Prisma.JsonObject {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonObject;
}

function buildJsonDiff(beforeValue: unknown, afterValue: unknown) {
  const before =
    beforeValue && typeof beforeValue === "object" && !Array.isArray(beforeValue)
      ? (beforeValue as Record<string, unknown>)
      : {};
  const after =
    afterValue && typeof afterValue === "object" && !Array.isArray(afterValue)
      ? (afterValue as Record<string, unknown>)
      : {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedFields: Array<{ field: string; before: unknown; after: unknown }> = [];

  for (const key of keys) {
    const beforeFieldValue = before[key];
    const afterFieldValue = after[key];

    if (JSON.stringify(beforeFieldValue ?? null) !== JSON.stringify(afterFieldValue ?? null)) {
      changedFields.push({
        field: key,
        before: beforeFieldValue ?? null,
        after: afterFieldValue ?? null
      });
    }
  }

  return {
    changedFields,
    changedFieldCount: changedFields.length
  };
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  request: Request,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeJson?: unknown,
  afterJson?: unknown
) {
  const context = readAuditContext(request);

  await tx.auditLog.create({
    data: {
      userId: actor.userId,
      username: actor.username,
      action,
      entityType,
      entityId,
      beforeJson: toAuditJson(beforeJson),
      afterJson: toAuditJson(afterJson),
      ip: context.ip,
      userAgent: context.userAgent
    }
  });
}

async function writeDocumentChangeLog(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  documentId: string,
  eventType: string,
  options?: {
    beforeJson?: unknown;
    afterJson?: unknown;
    diffJson?: unknown;
    reason?: string | null;
    fieldName?: string | null;
  }
) {
  await tx.documentChangeLog.create({
    data: {
      documentId,
      eventType,
      fieldName: options?.fieldName ?? null,
      beforeJson: typeof options?.beforeJson === "undefined" ? undefined : toJsonValue(options.beforeJson),
      afterJson: typeof options?.afterJson === "undefined" ? undefined : toJsonValue(options.afterJson),
      diffJson: typeof options?.diffJson === "undefined" ? undefined : toJsonValue(options.diffJson),
      reason: options?.reason ?? null,
      actorId: actor.userId,
      actorName: actor.username
    }
  });
}

async function writeDocumentMatchLog(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  input: {
    documentId: string;
    packageDraftId?: string | null;
    eventType: string;
    matchStatus: DocumentMatchStatus;
    confidence: number;
    reason?: string | null;
    detailJson?: unknown;
  }
) {
  await tx.documentMatchLog.create({
    data: {
      documentId: input.documentId,
      packageDraftId: input.packageDraftId ?? null,
      eventType: input.eventType,
      matchStatus: input.matchStatus,
      confidence: input.confidence,
      reason: input.reason ?? null,
      detailJson: typeof input.detailJson === "undefined" ? undefined : toJsonValue(input.detailJson),
      actorId: actor.userId,
      actorName: actor.username
    }
  });
}

function normalizePackageDraftResponse<T extends Record<string, unknown>>(packageDraft: T | null) {
  if (!packageDraft) {
    return null;
  }

  const packageItems = Array.isArray(packageDraft.packageItems)
    ? (packageDraft.packageItems as Array<{
        document?: {
          originalName?: string | null;
        } | null;
      }>)
    : undefined;

  return {
    ...packageDraft,
    packageItems: packageItems?.map((item) => ({
      ...item,
      document: item.document
        ? {
            ...item.document,
            originalName: decodePotentialMojibake(item.document.originalName)
          }
        : item.document
    }))
  };
}

function normalizeMatchCandidateResponse(candidate: ReturnType<typeof evaluatePackageCandidates>[number]) {
  return {
    ...candidate,
    packageDraft: normalizePackageDraftResponse(candidate.packageDraft)
  };
}

async function loadPackageDraftWithItems(tx: Prisma.TransactionClient | typeof prisma, packageDraftId: string) {
  return tx.documentPackageDraft.findUnique({
    where: { id: packageDraftId },
    select: packageDraftSelect
  });
}

async function loadPackageCandidatesForDocument(
  tx: Prisma.TransactionClient | typeof prisma,
  document: DocumentWithSummary
) {
  const packageDrafts = await tx.documentPackageDraft.findMany({
    where: {
      status: "OPEN"
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: packageDraftBasicSelect
  });

  return evaluatePackageCandidates(document, packageDrafts);
}

async function loadDocumentMatchInfo(tx: Prisma.TransactionClient | typeof prisma, documentId: string) {
  const document = await tx.document.findUnique({
    where: { id: documentId },
    select: documentSelect
  });

  if (!document || document.isDeleted) {
    return null;
  }

  const [candidates, logs, currentPackage] = await Promise.all([
    loadPackageCandidatesForDocument(tx, document),
    tx.documentMatchLog.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: documentMatchLogSelect
    }),
    document.packageItem?.packageDraft.id
      ? loadPackageDraftWithItems(tx, document.packageItem.packageDraft.id)
      : Promise.resolve(null)
  ]);

  return {
    document,
    currentPackage,
    candidates,
    logs
  };
}

async function createOrUpdatePackageDraftFromDocument(
  tx: Prisma.TransactionClient,
  document: DocumentWithSummary,
  source: "SYSTEM" | "MANUAL"
) {
  const summary = readDocumentDraftSummary(document);
  const packageNo = buildPackageNo({
    contractNoDraft: summary.contractNoDraft,
    batchNoDraft: summary.batchNoDraft,
    documentId: document.id
  });
  const existingPackage = await tx.documentPackageDraft.findUnique({
    where: { packageNo },
    select: packageDraftBasicSelect
  });
  const matchSummary = buildPackageSummary(summary);

  if (existingPackage) {
    return tx.documentPackageDraft.update({
      where: { id: existingPackage.id },
      data: {
        contractNoDraft: existingPackage.contractNoDraft ?? summary.contractNoDraft,
        batchNoDraft: existingPackage.batchNoDraft ?? summary.batchNoDraft,
        customerName: existingPackage.customerName ?? summary.customerName,
        supplierName: existingPackage.supplierName ?? summary.supplierName,
        productName: existingPackage.productName ?? summary.productName,
        destinationWarehouse: existingPackage.destinationWarehouse ?? summary.destinationWarehouse,
        source: existingPackage.source === "MANUAL" ? existingPackage.source : source,
        matchSummary
      },
      select: packageDraftBasicSelect
    });
  }

  return tx.documentPackageDraft.create({
    data: {
      packageNo,
      contractNoDraft: summary.contractNoDraft,
      batchNoDraft: summary.batchNoDraft,
      customerName: summary.customerName,
      supplierName: summary.supplierName,
      productName: summary.productName,
      destinationWarehouse: summary.destinationWarehouse,
      source,
      matchSummary
    },
    select: packageDraftBasicSelect
  });
}

async function assignDocumentToPackage(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  input: {
    document: DocumentWithSummary;
    packageDraftId: string;
    status: DocumentMatchStatus;
    confidence: number;
    reason: string;
    assignmentType: "AUTO" | "MANUAL";
    manualMatchLocked?: boolean;
    eventType: string;
    detailJson?: unknown;
  }
) {
  await tx.documentPackageItem.upsert({
    where: { documentId: input.document.id },
    create: {
      documentId: input.document.id,
      packageDraftId: input.packageDraftId,
      assignmentType: input.assignmentType,
      note: input.reason
    },
    update: {
      packageDraftId: input.packageDraftId,
      assignmentType: input.assignmentType,
      note: input.reason
    }
  });

  const updatedDocument = await tx.document.update({
    where: { id: input.document.id },
    data: {
      matchStatus: input.status,
      matchConfidence: input.confidence,
      matchReason: input.reason,
      manualMatchLocked: input.manualMatchLocked ?? input.document.manualMatchLocked
    },
    select: documentSelect
  });

  await writeDocumentMatchLog(tx, actor, {
    documentId: input.document.id,
    packageDraftId: input.packageDraftId,
    eventType: input.eventType,
    matchStatus: input.status,
    confidence: input.confidence,
    reason: input.reason,
    detailJson: input.detailJson
  });

  return updatedDocument;
}

async function clearDocumentPackageAssignment(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  input: {
    document: DocumentWithSummary;
    status: DocumentMatchStatus;
    confidence: number;
    reason: string;
    manualMatchLocked?: boolean;
    eventType: string;
    detailJson?: unknown;
  }
) {
  await tx.documentPackageItem.deleteMany({
    where: { documentId: input.document.id }
  });

  const updatedDocument = await tx.document.update({
    where: { id: input.document.id },
    data: {
      matchStatus: input.status,
      matchConfidence: input.confidence,
      matchReason: input.reason,
      manualMatchLocked: input.manualMatchLocked ?? input.document.manualMatchLocked
    },
    select: documentSelect
  });

  await writeDocumentMatchLog(tx, actor, {
    documentId: input.document.id,
    packageDraftId: null,
    eventType: input.eventType,
    matchStatus: input.status,
    confidence: input.confidence,
    reason: input.reason,
    detailJson: input.detailJson
  });

  return updatedDocument;
}

async function runDocumentAutoMatch(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  documentId: string
) {
  const document = await tx.document.findUnique({
    where: { id: documentId },
    select: documentSelect
  });

  if (!document || document.isDeleted) {
    return null;
  }

  if (document.status !== DocumentStatus.ACTIVE || document.aiStatus !== DocumentAiStatus.EXTRACTED) {
    return document;
  }

  if (document.manualMatchLocked) {
    await writeDocumentMatchLog(tx, actor, {
      documentId: document.id,
      packageDraftId: document.packageItem?.packageDraft.id ?? null,
      eventType: "AUTO_MATCH_SKIPPED",
      matchStatus: document.matchStatus,
      confidence: document.matchConfidence,
      reason: "该单据已人工锁定归票结果，系统不会自动改挂。",
      detailJson: {
        currentPackageNo: document.packageItem?.packageDraft.packageNo ?? null
      }
    });
    return document;
  }

  const draft = readDocumentDraftSummary(document);

  if (!draft.contractNoDraft && !draft.batchNoDraft) {
    return clearDocumentPackageAssignment(tx, actor, {
      document,
      status: DocumentMatchStatus.UNMATCHED,
      confidence: 0,
      reason: "AI 识别结果缺少合同号和批次号，暂不能自动归票。",
      manualMatchLocked: false,
      eventType: "AUTO_MATCH_UNMATCHED",
      detailJson: { draft }
    });
  }

  const candidates = await loadPackageCandidatesForDocument(tx, document);
  const exactCandidate = candidates.find((item) => item.status === "EXACT");

  if (exactCandidate) {
    return assignDocumentToPackage(tx, actor, {
      document,
      packageDraftId: exactCandidate.packageDraft.id,
      status: DocumentMatchStatus.AUTO_MATCHED,
      confidence: exactCandidate.confidence,
      reason: exactCandidate.reason,
      assignmentType: "AUTO",
      manualMatchLocked: false,
      eventType: "AUTO_MATCH_EXACT",
      detailJson: { draft, candidates }
    });
  }

  const conflictCandidates = candidates.filter((item) => item.status === "CONFLICT");
  const highConfidenceCandidate = candidates.find((item) => item.status === "HIGH_CONFIDENCE");

  if (conflictCandidates.length > 0 && !draft.batchNoDraft) {
    return clearDocumentPackageAssignment(tx, actor, {
      document,
      status: DocumentMatchStatus.CONFLICTED,
      confidence: conflictCandidates[0].confidence,
      reason: "合同号可能匹配，但缺少批次号且存在冲突候选，请人工选择资料包或新建资料包。",
      manualMatchLocked: false,
      eventType: "AUTO_MATCH_CONFLICTED",
      detailJson: { draft, candidates }
    });
  }

  if (highConfidenceCandidate && !draft.batchNoDraft) {
    return assignDocumentToPackage(tx, actor, {
      document,
      packageDraftId: highConfidenceCandidate.packageDraft.id,
      status: DocumentMatchStatus.NEEDS_CONFIRMATION,
      confidence: highConfidenceCandidate.confidence,
      reason: highConfidenceCandidate.reason,
      assignmentType: "AUTO",
      manualMatchLocked: false,
      eventType: "AUTO_MATCH_CANDIDATE",
      detailJson: { draft, candidates }
    });
  }

  if (draft.contractNoDraft || draft.batchNoDraft) {
    const packageDraft = await createOrUpdatePackageDraftFromDocument(tx, document, "SYSTEM");
    const isCompletePair = Boolean(draft.contractNoDraft && draft.batchNoDraft);
    const reason = isCompletePair
      ? conflictCandidates.length > 0
        ? "同合同下存在其他批次资料包，系统已按当前合同号 + 批次号新建资料包，避免错并批次。"
        : "未发现现有相同合同号 + 批次号资料包，系统已创建新的单据资料包。"
      : "仅识别到部分归票字段，系统已创建待人工补充确认的资料包。";

    return assignDocumentToPackage(tx, actor, {
      document,
      packageDraftId: packageDraft.id,
      status: isCompletePair ? DocumentMatchStatus.AUTO_MATCHED : DocumentMatchStatus.NEEDS_CONFIRMATION,
      confidence: isCompletePair ? (conflictCandidates.length > 0 ? 90 : 95) : 60,
      reason,
      assignmentType: "AUTO",
      manualMatchLocked: false,
      eventType: isCompletePair ? "AUTO_MATCH_CREATE_PACKAGE" : "AUTO_MATCH_CREATE_DRAFT_PACKAGE",
      detailJson: { draft, candidates }
    });
  }

  return clearDocumentPackageAssignment(tx, actor, {
    document,
    status: DocumentMatchStatus.UNMATCHED,
    confidence: 0,
    reason: "系统没有找到足够的合同号或批次号，暂未归入任何资料包。",
    manualMatchLocked: false,
    eventType: "AUTO_MATCH_UNMATCHED",
    detailJson: { draft, candidates }
  });
}

function resolveDocumentBusinessEntity(
  documentType: DocumentType,
  input: {
    contractId: string;
    batchId: string | null;
    receivableId: string | null;
  }
) {
  if (documentType === DocumentType.PACKING_LIST && input.batchId) {
    return { type: "Batch", id: input.batchId };
  }

  if (documentType === DocumentType.INVOICE && input.receivableId) {
    return { type: "Receivable", id: input.receivableId };
  }

  return { type: "Contract", id: input.contractId };
}

async function markBusinessDocumentsCreated(
  tx: Prisma.TransactionClient,
  actor: AuditActor,
  input: {
    pairedDocuments: PairedBusinessDocument[];
    contractId: string;
    batchId: string | null;
    receivableId: string | null;
    eventType: string;
    reason: string;
  }
) {
  for (const pairedDocument of input.pairedDocuments) {
    const relatedEntity = resolveDocumentBusinessEntity(pairedDocument.documentType, {
      contractId: input.contractId,
      batchId: input.batchId,
      receivableId: input.receivableId
    });

    const beforeDocument = await tx.document.findUnique({
      where: { id: pairedDocument.id },
      select: documentSelect
    });
    const afterDocument = await tx.document.update({
      where: { id: pairedDocument.id },
      data: {
        businessCreated: true,
        relatedEntityType: relatedEntity.type,
        relatedEntityId: relatedEntity.id,
        status: DocumentStatus.ACTIVE
      },
      select: documentSelect
    });

    if (beforeDocument) {
      await writeDocumentChangeLog(tx, actor, pairedDocument.id, input.eventType, {
        beforeJson: beforeDocument,
        afterJson: afterDocument,
        diffJson: buildJsonDiff(beforeDocument, afterDocument),
        reason: input.reason
      });
    }
  }
}

function ensureActiveDocument(document: DocumentWithSummary) {
  if (document.isDeleted || document.status === DocumentStatus.DELETED) {
    throw new Error("该单据已删除，不能继续操作。");
  }

  if (document.status === DocumentStatus.VOIDED) {
    throw new Error("该单据已作废，不能继续操作。");
  }

  if (document.status === DocumentStatus.REPLACED) {
    throw new Error("该单据已被新版本替换，不能继续操作。");
  }

  if (document.status === DocumentStatus.ARCHIVED) {
    throw new Error("该单据已归档，不能继续操作。");
  }
}

function removeUploadedDiskFile(filePath: string | undefined) {
  if (!filePath) {
    return;
  }

  fs.unlink(filePath, () => undefined);
}

function validateUploadedDocumentFile(file: Express.Multer.File) {
  const readableName = decodePotentialMojibake(file.originalname) ?? file.originalname;

  if (!isSupportedDocumentFileName(readableName)) {
    removeUploadedDiskFile(file.path);
    throw new Error(`${unsupportedFileTypeMessage}${getSupportedUploadHint()}`);
  }
}

function buildUploadFileMetadata(request: Request) {
  if (!request.file) {
    throw new Error("file is required.");
  }

  validateUploadedDocumentFile(request.file);

  const relativeFilePath = path.posix.join("uploads", "documents", request.file.filename);
  const relativeFileUrl = `/${relativeFilePath.replace(/\\/g, "/")}`;
  const fileUrl = `${request.protocol}://${request.get("host")}${relativeFileUrl}`;

  return {
    fileName: request.file.filename,
    originalName: decodePotentialMojibake(request.file.originalname),
    filePath: relativeFilePath,
    fileUrl,
    mimeType: request.file.mimetype,
    size: request.file.size
  };
}

async function loadDocumentOr404(documentId: string, response: Response) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: documentSelect
  });

  if (!document || document.isDeleted) {
    response.status(404).json({ message: "Document not found." });
    return null;
  }

  return document;
}

documentsRouter.get("/", async (_request, response) => {
  const documents = await prisma.document.findMany({
    where: { isDeleted: false },
    orderBy: [{ createdAt: "desc" }],
    select: documentSelect
  });

  response.json(documents.map((document) => normalizeDocumentResponse(document)));
});

documentsRouter.get("/package-status", async (request, response) => {
  const contractNoDraft = readOptionalString(request.query.contractNoDraft);
  const batchNoDraft = readOptionalString(request.query.batchNoDraft);

  const documents = await prisma.document.findMany({
    where: {
      isDeleted: false,
      ...(contractNoDraft ? { contractNoDraft } : {}),
      ...(batchNoDraft ? { batchNoDraft } : {})
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      documentType: true,
      originalName: true,
      fileName: true,
      status: true,
      aiStatus: true,
      businessCreated: true,
      version: true,
      createdAt: true,
      updatedAt: true
    }
  });

  response.json(buildDocumentPackageStatus(documents));
});

documentsRouter.get("/packages", async (_request, response) => {
  const packageDrafts = await prisma.documentPackageDraft.findMany({
    orderBy: [{ updatedAt: "desc" }],
    select: packageDraftSelect
  });

  response.json(packageDrafts.map((packageDraft) => normalizePackageDraftResponse(packageDraft)));
});

documentsRouter.get("/:id/match-candidates", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  const matchInfo = await loadDocumentMatchInfo(prisma, document.id);

  if (!matchInfo) {
    response.status(404).json({ message: "Document not found." });
    return;
  }

  response.json({
    document: normalizeDocumentResponse(matchInfo.document),
    currentPackage: normalizePackageDraftResponse(matchInfo.currentPackage),
    candidates: matchInfo.candidates.map((candidate) => normalizeMatchCandidateResponse(candidate)),
    logs: matchInfo.logs
  });
});

documentsRouter.post("/:id/match/confirm", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  try {
    ensureActiveDocument(document);
  } catch (error) {
    response.status(409).json({
      message: error instanceof Error ? error.message : "当前单据不能继续归票。"
    });
    return;
  }

  if (document.businessCreated) {
    response.status(409).json({
      message: "该单据已生成正式业务数据，不能再改挂资料包。"
    });
    return;
  }

  if (document.aiStatus !== DocumentAiStatus.EXTRACTED) {
    response.status(400).json({
      message: "请先完成 AI 识别，再进行同票归组确认。"
    });
    return;
  }

  const packageDraftId = readOptionalString(request.body?.packageDraftId);
  const reason = readOptionalString(request.body?.reason) ?? "人工确认单据归票结果";
  const createNew = request.body?.createNew === true;
  const ignore = request.body?.ignore === true;

  try {
    const updatedDocument = await prisma.$transaction(async (tx) => {
      const actor = await resolveAuditActor(tx);

      if (ignore) {
        return clearDocumentPackageAssignment(tx, actor, {
          document,
          status: DocumentMatchStatus.IGNORED,
          confidence: 0,
          reason: readOptionalString(request.body?.reason) ?? "人工标记为无关单据，暂不参与资料包归组。",
          manualMatchLocked: true,
          eventType: "MANUAL_MATCH_IGNORED",
          detailJson: { requestedBy: actor.username }
        });
      }

      const targetPackage = createNew
        ? await createOrUpdatePackageDraftFromDocument(tx, document, "MANUAL")
        : packageDraftId
          ? await tx.documentPackageDraft.findUnique({
              where: { id: packageDraftId },
              select: packageDraftBasicSelect
            })
          : null;

      if (!targetPackage) {
        throw new BusinessConflictError("请选择要归入的资料包，或选择新建资料包。");
      }

      return assignDocumentToPackage(tx, actor, {
        document,
        packageDraftId: targetPackage.id,
        status: DocumentMatchStatus.MANUAL_CONFIRMED,
        confidence: 100,
        reason,
        assignmentType: "MANUAL",
        manualMatchLocked: true,
        eventType: createNew ? "MANUAL_MATCH_CREATE_PACKAGE" : "MANUAL_MATCH_CONFIRM",
        detailJson: {
          requestedBy: actor.username,
          packageNo: targetPackage.packageNo
        }
      });
    });

    const matchInfo = await loadDocumentMatchInfo(prisma, document.id);

    response.json({
      document: normalizeDocumentResponse(updatedDocument),
      currentPackage: matchInfo ? normalizePackageDraftResponse(matchInfo.currentPackage) : null,
      candidates: matchInfo ? matchInfo.candidates.map((candidate) => normalizeMatchCandidateResponse(candidate)) : [],
      logs: matchInfo?.logs ?? []
    });
  } catch (error) {
    if (error instanceof BusinessConflictError) {
      response.status(409).json({ message: error.message });
      return;
    }

    response.status(400).json({
      message: error instanceof Error ? error.message : "归票确认失败。"
    });
  }
});

documentsRouter.post("/:id/match/rematch", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  try {
    ensureActiveDocument(document);
  } catch (error) {
    response.status(409).json({
      message: error instanceof Error ? error.message : "当前单据不能重新归票。"
    });
    return;
  }

  if (document.businessCreated) {
    response.status(409).json({
      message: "该单据已生成正式业务数据，不能重新归票。"
    });
    return;
  }

  if (document.aiStatus !== DocumentAiStatus.EXTRACTED) {
    response.status(400).json({
      message: "请先完成 AI 识别，再重新自动归票。"
    });
    return;
  }

  const updatedDocument = await prisma.$transaction(async (tx) => {
    const actor = await resolveAuditActor(tx);
    const unlockedDocument = await tx.document.update({
      where: { id: document.id },
      data: {
        manualMatchLocked: false
      },
      select: documentSelect
    });

    await writeDocumentMatchLog(tx, actor, {
      documentId: document.id,
      packageDraftId: unlockedDocument.packageItem?.packageDraft.id ?? null,
      eventType: "MANUAL_MATCH_UNLOCK",
      matchStatus: unlockedDocument.matchStatus,
      confidence: unlockedDocument.matchConfidence,
      reason: "人工取消归票锁定，重新执行自动匹配。",
      detailJson: { requestedBy: actor.username }
    });

    return (await runDocumentAutoMatch(tx, actor, document.id)) ?? unlockedDocument;
  });

  const matchInfo = await loadDocumentMatchInfo(prisma, document.id);

  response.json({
    document: normalizeDocumentResponse(updatedDocument),
    currentPackage: matchInfo ? normalizePackageDraftResponse(matchInfo.currentPackage) : null,
    candidates: matchInfo ? matchInfo.candidates.map((candidate) => normalizeMatchCandidateResponse(candidate)) : [],
    logs: matchInfo?.logs ?? []
  });
});

documentsRouter.get("/:id/change-logs", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  const logs = await prisma.documentChangeLog.findMany({
    where: { documentId: document.id },
    orderBy: { createdAt: "desc" },
    select: documentChangeLogSelect
  });

  response.json(logs);
});

documentsRouter.get("/:id/history", async (request, response) => {
  const documentId = readRouteId(request.params.id);
  const requestedDocument = await prisma.document.findUnique({
    where: { id: documentId },
    select: documentSelect
  });

  if (!requestedDocument || requestedDocument.isDeleted) {
    response.status(404).json({ message: "Document not found." });
    return;
  }

  let rootDocument = requestedDocument;

  while (true) {
    const previousVersion = await prisma.document.findFirst({
      where: {
        replacedByDocumentId: rootDocument.id
      },
      select: documentSelect
    });

    if (!previousVersion) {
      break;
    }

    rootDocument = previousVersion;
  }

  const history: DocumentWithSummary[] = [];
  let currentDocument: DocumentWithSummary | null = rootDocument;

  while (currentDocument) {
    history.push(currentDocument);

    if (!currentDocument.replacedByDocumentId) {
      break;
    }

    currentDocument = await prisma.document.findUnique({
      where: { id: currentDocument.replacedByDocumentId },
      select: documentSelect
    });
  }

  response.json(history.map((document) => normalizeDocumentResponse(document)));
});

documentsRouter.post("/upload", upload.single("file"), async (request, response) => {
  const documentTypeValue = request.body.documentType;

  if (!isDocumentType(documentTypeValue)) {
    response.status(400).json({
      message: "documentType is required and must be a valid enum value."
    });
    return;
  }

  try {
    const fileMetadata = buildUploadFileMetadata(request);
    const document = await prisma.$transaction(async (tx) => {
      const actor = await resolveAuditActor(tx);
      const createdDocument = await tx.document.create({
        data: {
          documentType: documentTypeValue,
          ...fileMetadata
        },
        select: documentSelect
      });

      await writeDocumentChangeLog(tx, actor, createdDocument.id, "UPLOAD", {
        beforeJson: null,
        afterJson: createdDocument,
        diffJson: {
          documentType: documentTypeValue,
          fileName: fileMetadata.fileName
        },
        reason: "上传原始单据进入识别草稿层"
      });

      return createdDocument;
    });

    response.status(201).json(normalizeDocumentResponse(document));
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "file is required."
    });
  }
});

documentsRouter.delete("/:id", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  if (hasGeneratedBusiness(document)) {
    response.status(409).json({
      message: "该单据已生成业务数据，不能删除，只能作废。"
    });
    return;
  }

  ensureActiveDocument(document);

  const deletedAt = new Date();

  const deletedDocument = await prisma.$transaction(async (tx) => {
    const actor = await resolveAuditActor(tx);
    await tx.documentPackageItem.deleteMany({
      where: { documentId: document.id }
    });

    const updatedDocument = await tx.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.DELETED,
        isDeleted: true,
        deletedAt,
        deletedBy: actor.username ?? actor.userId ?? "demo-owner"
      },
      select: documentSelect
    });

    await writeAuditLog(tx, actor, request, "DOCUMENT_DELETE", "Document", document.id, document, updatedDocument);
    await writeDocumentChangeLog(tx, actor, document.id, "DELETE", {
      beforeJson: document,
      afterJson: updatedDocument,
      diffJson: buildJsonDiff(document, updatedDocument),
      reason: "删除未生成正式业务数据的草稿单据"
    });
    await writeDocumentMatchLog(tx, actor, {
      documentId: document.id,
      packageDraftId: document.packageItem?.packageDraft.id ?? null,
      eventType: "MATCH_REMOVED_BY_DELETE",
      matchStatus: DocumentMatchStatus.UNMATCHED,
      confidence: 0,
      reason: "草稿单据已删除，已从资料包草稿中移除。",
      detailJson: {
        previousMatchStatus: document.matchStatus,
        previousPackageNo: document.packageItem?.packageDraft.packageNo ?? null
      }
    });

    return updatedDocument;
  });

  response.json({
    deleted: true,
    document: normalizeDocumentResponse(deletedDocument)
  });
});

documentsRouter.post("/:id/void", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  const voidReason = readOptionalString((request.body as { reason?: unknown } | undefined)?.reason);

  if (!voidReason) {
    response.status(400).json({ message: "作废时必须填写原因。" });
    return;
  }

  if (!hasGeneratedBusiness(document)) {
    response.status(409).json({
      message: "该单据尚未生成业务数据，无需作废，可直接删除。"
    });
    return;
  }

  if (document.status === DocumentStatus.VOIDED) {
    response.json({
      voided: false,
      document: normalizeDocumentResponse(document)
    });
    return;
  }

  if (document.status === DocumentStatus.REPLACED) {
    response.status(409).json({
      message: "该单据已经被新版本替换，不能再作废旧版本。"
    });
    return;
  }

  ensureActiveDocument(document);

  const voidedAt = new Date();

  const voidedDocument = await prisma.$transaction(async (tx) => {
    const actor = await resolveAuditActor(tx);

    const updatedDocument = await tx.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.VOIDED,
        voidedAt,
        voidedBy: actor.username ?? actor.userId ?? "demo-owner",
        voidReason
      },
      select: documentSelect
    });

    await writeAuditLog(tx, actor, request, "DOCUMENT_VOID", "Document", document.id, document, updatedDocument);
    await writeDocumentChangeLog(tx, actor, document.id, "VOID", {
      beforeJson: document,
      afterJson: updatedDocument,
      diffJson: buildJsonDiff(document, updatedDocument),
      reason: voidReason
    });

    return updatedDocument;
  });

  response.json({
    voided: true,
    document: normalizeDocumentResponse(voidedDocument)
  });
});

documentsRouter.post("/:id/archive", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  if (!hasGeneratedBusiness(document)) {
    response.status(409).json({
      message: "该单据尚未生成业务数据，暂不能归档，可继续作为识别草稿处理。"
    });
    return;
  }

  if (document.status === DocumentStatus.ARCHIVED) {
    response.json({
      archived: false,
      document: normalizeDocumentResponse(document)
    });
    return;
  }

  ensureActiveDocument(document);

  const archivedDocument = await prisma.$transaction(async (tx) => {
    const actor = await resolveAuditActor(tx);
    const updatedDocument = await tx.document.update({
      where: { id: document.id },
      data: {
        status: DocumentStatus.ARCHIVED
      },
      select: documentSelect
    });

    await writeAuditLog(tx, actor, request, "DOCUMENT_ARCHIVE", "Document", document.id, document, updatedDocument);
    await writeDocumentChangeLog(tx, actor, document.id, "ARCHIVE", {
      beforeJson: document,
      afterJson: updatedDocument,
      diffJson: buildJsonDiff(document, updatedDocument),
      reason: "正式业务数据已生成，单据进入归档留存"
    });

    return updatedDocument;
  });

  response.json({
    archived: true,
    document: normalizeDocumentResponse(archivedDocument)
  });
});

documentsRouter.post("/:id/replace", upload.single("file"), async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  if (!hasGeneratedBusiness(document)) {
    response.status(409).json({
      message: "当前只有已生成业务数据的单据才允许替换版本。"
    });
    return;
  }

  ensureActiveDocument(document);

  try {
    const fileMetadata = buildUploadFileMetadata(request);
    const relatedEntityType = document.relatedEntityType ?? "CONTRACT";
    const relatedEntityId = document.relatedEntityId ?? document.sourceContracts[0]?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const actor = await resolveAuditActor(tx);

      const replacementDocument = await tx.document.create({
        data: {
          documentType: document.documentType,
          ...fileMetadata,
          aiStatus: document.aiStatus,
          extractedJson: document.extractedJson ?? undefined,
          contractNoDraft: document.contractNoDraft,
          batchNoDraft: document.batchNoDraft,
          relatedEntityType,
          relatedEntityId,
          businessCreated: true,
          version: document.version + 1
        },
        select: documentSelect
      });

      await tx.document.update({
        where: { id: document.id },
        data: {
          status: DocumentStatus.REPLACED,
          replacedByDocumentId: replacementDocument.id
        }
      });

      await Promise.all([
        tx.contract.updateMany({
          where: { sourceDocumentId: document.id },
          data: { sourceDocumentId: replacementDocument.id }
        }),
        tx.batch.updateMany({
          where: { sourceDocumentId: document.id },
          data: { sourceDocumentId: replacementDocument.id }
        })
      ]);

      const [previousDocument, currentDocument] = await Promise.all([
        tx.document.findUnique({
          where: { id: document.id },
          select: documentSelect
        }),
        tx.document.findUnique({
          where: { id: replacementDocument.id },
          select: documentSelect
        })
      ]);

      await writeAuditLog(
        tx,
        actor,
        request,
        "DOCUMENT_REPLACE",
        "Document",
        document.id,
        document,
        {
          previousDocument,
          replacementDocument: currentDocument
        }
      );
      await writeDocumentChangeLog(tx, actor, document.id, "REPLACE", {
        beforeJson: document,
        afterJson: {
          previousDocument,
          replacementDocument: currentDocument
        },
        diffJson: {
          replacedByDocumentId: replacementDocument.id,
          previousVersion: document.version,
          nextVersion: replacementDocument.version
        },
        reason: "上传新版本单据，旧版本保留为历史"
      });
      await writeDocumentChangeLog(tx, actor, replacementDocument.id, "CREATE_REPLACEMENT", {
        beforeJson: null,
        afterJson: currentDocument,
        diffJson: {
          previousDocumentId: document.id,
          version: replacementDocument.version
        },
        reason: "替换上传生成的新版本单据"
      });

      return {
        previousDocument,
        replacementDocument: currentDocument
      };
    });

    response.status(201).json({
      replaced: true,
      previousDocument: result.previousDocument ? normalizeDocumentResponse(result.previousDocument) : null,
      document: result.replacementDocument ? normalizeDocumentResponse(result.replacementDocument) : null
    });
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "file is required."
    });
  }
});

documentsRouter.post("/:id/extract", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  try {
    ensureActiveDocument(document);
  } catch (error) {
    response.status(409).json({
      message: error instanceof Error ? error.message : "当前单据不能继续识别。"
    });
    return;
  }

  if (hasGeneratedBusiness(document)) {
    response.status(409).json({
      message: "该单据已生成业务数据，不能重新识别。若需更新原始单据，请使用替换上传。"
    });
    return;
  }

  const readableOriginalName = decodePotentialMojibake(document.originalName) ?? document.fileName;
  let spreadsheet: ParsedSpreadsheetDocument | null = null;

  if (isSpreadsheetFileName(readableOriginalName ?? document.fileName)) {
    try {
      const relativeFilePath = document.filePath ?? path.posix.join("uploads", "documents", document.fileName);
      const absoluteFilePath = path.resolve(workspaceRoot, relativeFilePath);
      spreadsheet = await parseSpreadsheetDocument(absoluteFilePath, document.documentType);
    } catch (error) {
      response.status(400).json({
        message:
          error instanceof Error
            ? `Excel/CSV 解析失败：${error.message}`
            : "Excel/CSV 解析失败，请检查文件内容。"
      });
      return;
    }
  }

  const extraction = buildMockExtraction(document.id, document.documentType, {
    originalName: readableOriginalName,
    spreadsheet
  });
  const responseText = `已从 ${readableOriginalName} 识别出合同草稿、批次草稿和演示字段。`;

  const updatedDocument = await prisma.$transaction(async (tx) => {
    const actor = await resolveAuditActor(tx);
    const nextDocument = await tx.document.update({
      where: { id: document.id },
      data: {
        aiStatus: DocumentAiStatus.EXTRACTED,
        extractedJson: extraction,
        contractNoDraft: String(extraction.contractNoDraft),
        batchNoDraft: String(extraction.batchNoDraft)
      },
      select: documentSelect
    });

    await tx.aiLog.create({
      data: {
        taskType: AiTaskType.DOCUMENT_EXTRACT,
        status: AiTaskStatus.SUCCESS,
        scenario: demoScenarioConfig.scenarioName,
        provider: env.aiProvider,
        model: env.aiModel || "mock-document-extractor-v1",
        documentId: document.id,
        promptText: "Extract trade document fields for demo.",
        inputText: JSON.stringify({
          documentType: document.documentType,
          fileName: document.fileName,
          originalName: readableOriginalName
        }),
        responseText,
        outputText: responseText,
        responseJson: extraction,
        parsedJson: extraction
      }
    });

    await writeDocumentChangeLog(tx, actor, document.id, "AI_EXTRACT", {
      beforeJson: document.extractedJson,
      afterJson: extraction,
      diffJson: buildJsonDiff(document.extractedJson, extraction),
      reason: "AI Mock 识别或重新识别单据字段"
    });

    return (await runDocumentAutoMatch(tx, actor, nextDocument.id)) ?? nextDocument;
  });

  response.json(normalizeDocumentResponse(updatedDocument));
});

documentsRouter.patch("/:id/extracted-fields", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  try {
    ensureActiveDocument(document);

    if (hasGeneratedBusiness(document)) {
      response.status(409).json({
        message: "该单据已生成正式业务数据，不能再编辑识别草稿。"
      });
      return;
    }

    const { patch, contractNoDraft, batchNoDraft } = buildExtractionPatch(request.body);
    const existing =
      document.extractedJson && typeof document.extractedJson === "object" && !Array.isArray(document.extractedJson)
        ? (document.extractedJson as Prisma.JsonObject)
        : {};

    const nextExtraction: Prisma.JsonObject = {
      ...existing,
      ...patch,
      source: existing.source ?? "mock-document-extractor-v1",
      documentType: existing.documentType ?? document.documentType,
      unit: isInvalidDraftUnit(patch.unit ?? existing.unit) ? demoScenarioConfig.unit : patch.unit ?? existing.unit,
      lastEditedAt: new Date().toISOString()
    };

    const updatedDocument = await prisma.$transaction(async (tx) => {
      const actor = await resolveAuditActor(tx);
      const nextDocument = await tx.document.update({
        where: { id: document.id },
        data: {
          extractedJson: nextExtraction,
          contractNoDraft: contractNoDraft ?? document.contractNoDraft,
          batchNoDraft: batchNoDraft ?? document.batchNoDraft
        },
        select: documentSelect
      });
      const diff = buildJsonDiff(existing, nextExtraction);

      await writeAuditLog(tx, actor, request, "DOCUMENT_FIELD_CORRECTION", "Document", document.id, existing, nextExtraction);
      await writeDocumentChangeLog(tx, actor, document.id, "FIELD_CORRECTION", {
        beforeJson: existing,
        afterJson: nextExtraction,
        diffJson: diff,
        reason: "人工修正 AI 识别字段"
      });

      return nextDocument.manualMatchLocked ? nextDocument : (await runDocumentAutoMatch(tx, actor, nextDocument.id)) ?? nextDocument;
    });

    response.json(normalizeDocumentResponse(updatedDocument));
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Invalid extraction patch payload."
    });
  }
});

documentsRouter.post("/:id/confirm", async (request, response) => {
  const document = await loadDocumentOr404(readRouteId(request.params.id), response);

  if (!document) {
    return;
  }

  try {
    ensureActiveDocument(document);
  } catch (error) {
    response.status(409).json({
      message: error instanceof Error ? error.message : "当前单据不能生成业务数据。"
    });
    return;
  }

  if (document.aiStatus !== DocumentAiStatus.EXTRACTED) {
    response.status(400).json({
      message: "Please run AI extraction and confirm the draft fields before generating business data."
    });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await loadExistingGeneratedBusinessData(tx, document.id);

      if (existing) {
        if (existing.purchaseOrder) {
          await ensureSupplierFollowUpWorkOrder(tx, {
            purchaseOrder: existing.purchaseOrder,
            contractId: existing.contract.id,
            batchId: existing.batch?.id ?? null
          });
        }

        const actor = await resolveAuditActor(tx);
        const updatedDocument = await tx.document.update({
          where: { id: document.id },
          data: {
            businessCreated: true,
            relatedEntityType: document.relatedEntityType ?? "CONTRACT",
            relatedEntityId: document.relatedEntityId ?? existing.contract.id,
            status: DocumentStatus.ACTIVE
          },
          select: documentSelect
        });

        await writeDocumentChangeLog(tx, actor, document.id, "BUSINESS_CREATE_RECHECK", {
          beforeJson: document,
          afterJson: updatedDocument,
          diffJson: buildJsonDiff(document, updatedDocument),
          reason: "正式业务数据已存在，本次确认用于补齐单据业务状态"
        });

        return {
          created: false,
          ...existing
        };
      }

      const draft = parseConfirmedDraft(document);
      const requiredBusinessDocuments = await ensureRequiredBusinessDocuments(tx, draft, document.id);

      const [duplicateContract, duplicateBatch] = await Promise.all([
        tx.contract.findUnique({
          where: { contractNo: draft.contractNo },
          select: {
            id: true,
            sourceDocumentId: true
          }
        }),
        tx.batch.findUnique({
          where: { batchNo: draft.batchNo },
          select: {
            id: true,
            sourceDocumentId: true
          }
        })
      ]);

      if (duplicateContract && duplicateContract.sourceDocumentId !== requiredBusinessDocuments.contractDocumentId) {
        throw new BusinessConflictError(`合同号 ${draft.contractNo} 已存在，请先修改草稿合同号。`);
      }

      if (duplicateBatch && duplicateBatch.sourceDocumentId !== requiredBusinessDocuments.packingListDocumentId) {
        throw new BusinessConflictError(`批次号 ${draft.batchNo} 已存在，请先修改草稿批次号。`);
      }

      if (duplicateContract) {
        const existingByPair = await loadGeneratedBusinessDataByContractId(tx, duplicateContract.id);

        if (existingByPair) {
          if (existingByPair.purchaseOrder) {
            await ensureSupplierFollowUpWorkOrder(tx, {
              purchaseOrder: existingByPair.purchaseOrder,
              contractId: existingByPair.contract.id,
              batchId: existingByPair.batch?.id ?? null
            });
          }

          const actor = await resolveAuditActor(tx);
          await markBusinessDocumentsCreated(tx, actor, {
            pairedDocuments: requiredBusinessDocuments.pairedDocuments,
            contractId: existingByPair.contract.id,
            batchId: existingByPair.batch?.id ?? null,
            receivableId: existingByPair.receivable?.id ?? null,
            eventType: "BUSINESS_CREATE_RECHECK",
            reason: "正式业务数据已存在，本次确认用于补齐同票单据业务状态"
          });

          return {
            created: false,
            ...existingByPair
          };
        }
      }

      const references = await resolveBusinessReferences(tx, draft);
      const unitPrice = draft.totalQuantity > 0 ? Number((draft.amount / draft.totalQuantity).toFixed(2)) : null;
      const dueDate = new Date(Date.now() + 30 * ONE_DAY_IN_MS);
      const purchaseNo = `PO-${draft.contractNo.replace(/^CTR-/, "")}`;
      const receiptPaymentPlan = buildInitialReceiptPaymentPlan(draft, dueDate);

      const contract = await tx.contract.create({
        data: {
          contractNo: draft.contractNo,
          contractType: "PURCHASE",
          customerId: references.customerId,
          customerName: draft.customerName,
          supplierId: references.supplierId,
          supplierName: draft.supplierName,
          companyId: references.companyId,
          productName: draft.productName,
          totalQuantity: draft.totalQuantity,
          unit: draft.unit,
          amount: draft.amount,
          currency: draft.currency,
          destinationWarehouse: draft.destinationWarehouse,
          paymentStatus: PaymentStatus.UNPAID,
          executionStatus: "DOCUMENT_CONFIRMED",
          executionProgress: 15,
          plannedReceiptAmount: draft.amount,
          actualReceiptAmount: 0,
          plannedPaymentAmount: receiptPaymentPlan.plannedPaymentAmount,
          actualPaymentAmount: 0,
          receiptPaymentPlanJson: toJsonObjectValue(receiptPaymentPlan.plan),
          sourceDocumentId: requiredBusinessDocuments.contractDocumentId
        },
        select: generatedContractSelect
      });

      await tx.contractItem.create({
        data: {
          contractId: contract.id,
          skuId: references.skuId,
          skuCode: references.skuCode,
          skuName: draft.productName,
          quantity: draft.totalQuantity,
          unit: draft.unit,
          unitPrice,
          amount: draft.amount,
          currency: draft.currency
        }
      });

      const batch = await tx.batch.create({
        data: {
          batchNo: draft.batchNo,
          contractId: contract.id,
          sourceDocumentId: requiredBusinessDocuments.packingListDocumentId,
          skuId: references.skuId,
          sku: references.skuCode,
          productName: draft.productName,
          totalQuantity: draft.totalQuantity,
          unit: draft.unit,
          destinationWarehouse: draft.destinationWarehouse,
          warehouseId: references.warehouseId,
          status: BatchStatus.READY_FOR_QR
        },
        select: generatedBatchSelect
      });

      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          purchaseNo,
          contractId: contract.id,
          supplierId: references.supplierId,
          supplierName: draft.supplierName,
          companyId: references.companyId,
          skuId: references.skuId,
          skuName: draft.productName,
          batchId: batch.id,
          quantity: draft.totalQuantity,
          unit: draft.unit,
          deliveryDate: dueDate,
          status: "DRAFT"
        },
        select: generatedPurchaseOrderSelect
      });

      await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          skuId: references.skuId,
          skuCode: references.skuCode,
          skuName: draft.productName,
          quantity: draft.totalQuantity,
          unit: draft.unit,
          unitPrice,
          amount: draft.amount,
          currency: draft.currency
        }
      });

      await ensureSupplierFollowUpWorkOrder(tx, {
        purchaseOrder,
        contractId: contract.id,
        batchId: batch.id
      });

      const payment = await tx.payment.create({
        data: {
          contractId: contract.id,
          customerId: references.customerId,
          receivableAmount: draft.amount,
          currency: draft.currency,
          status: PaymentStatus.UNPAID,
          dueDate
        },
        select: generatedPaymentSelect
      });

      const receivable = await tx.receivable.create({
        data: {
          contractId: contract.id,
          customerId: references.customerId,
          amount: draft.amount,
          currency: draft.currency,
          dueDate,
          status: "UNPAID"
        },
        select: generatedReceivableSelect
      });

      const actor = await resolveAuditActor(tx);
      await markBusinessDocumentsCreated(tx, actor, {
        pairedDocuments: requiredBusinessDocuments.pairedDocuments,
        contractId: contract.id,
        batchId: batch.id,
        receivableId: receivable.id,
        eventType: "BUSINESS_CREATE",
        reason: "确认生成正式合同、批次、采购单和应收草稿"
      });

      return {
        created: true,
        contract,
        batch,
        purchaseOrder,
        payment,
        receivable
      };
    });

    const refreshedDocument = await prisma.document.findUnique({
      where: { id: document.id },
      select: documentSelect
    });

    response.status(result.created ? 201 : 200).json({
      created: result.created,
      document: refreshedDocument ? normalizeDocumentResponse(refreshedDocument) : null,
      contract: result.contract,
      batch: result.batch,
      purchaseOrder: result.purchaseOrder,
      payment: result.payment,
      receivable: result.receivable,
      inventoryNotice: "已生成正式业务数据，但当前还没有库存。库存只会在后续二维码生成并扫码入库后增加。"
    });
  } catch (error) {
    if (error instanceof BusinessConflictError) {
      response.status(409).json({ message: error.message });
      return;
    }

    response.status(400).json({
      message: error instanceof Error ? error.message : "Failed to generate business data."
    });
  }
});
