import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AiTaskStatus,
  AiTaskType,
  BatchStatus,
  DocumentAiStatus,
  DocumentStatus,
  DocumentType,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { demoScenarioConfig } from "../config/demoScenario";
import { env } from "../config/env";
import { documentsUploadDir } from "../config/paths";
import { prisma } from "../lib/prisma";
import { standardScenarioIdentifiers } from "../services/demoFoundation";

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
  }
} as const;

const generatedContractSelect = {
  id: true,
  contractNo: true,
  status: true,
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
  options?: { originalName?: string | null }
): Prisma.JsonObject {
  const suffix = documentId.slice(-6).toUpperCase();
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const standardDraftPair = resolveStandardDemoDraftPair(documentType, options?.originalName);

  return {
    source: "mock-document-extractor-v1",
    documentType,
    contractNoDraft: standardDraftPair?.contractNoDraft ?? `CTR-${datePart}-${suffix}`,
    batchNoDraft: standardDraftPair?.batchNoDraft ?? `BAT-${datePart}-${suffix}`,
    productName: demoScenarioConfig.productName,
    customerName: demoScenarioConfig.customerName,
    supplierName: demoScenarioConfig.supplierName,
    destinationWarehouse: demoScenarioConfig.destinationWarehouse,
    totalQuantity: demoScenarioConfig.totalQuantity,
    unit: demoScenarioConfig.unit,
    amount: demoScenarioConfig.amount,
    currency: demoScenarioConfig.currency,
    notes: [
      "第一版使用 mock 识别结果。",
      "识别结果来源于当前 DemoConfig，可在人工确认后修改。",
      "正式业务数据创建前，单据仍然只是草稿。"
    ]
  };
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
  draft: ConfirmedDocumentDraft
) {
  const pairedDocuments = await tx.document.findMany({
    where: {
      status: DocumentStatus.ACTIVE,
      aiStatus: DocumentAiStatus.EXTRACTED,
      contractNoDraft: draft.contractNo,
      batchNoDraft: draft.batchNo
    },
    select: {
      documentType: true
    }
  });

  const hasContract = pairedDocuments.some((item) => item.documentType === DocumentType.CONTRACT);
  const hasPackingList = pairedDocuments.some((item) => item.documentType === DocumentType.PACKING_LIST);

  if (hasContract && hasPackingList) {
    return;
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

function buildSupplierFollowUpWorkOrderNo(purchaseNo: string) {
  return `WO-PROC-${purchaseNo.replace(/^PO-/, "")}`;
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
}

function buildUploadFileMetadata(request: Request) {
  if (!request.file) {
    throw new Error("file is required.");
  }

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
    const document = await prisma.document.create({
      data: {
        documentType: documentTypeValue,
        ...fileMetadata
      },
      select: documentSelect
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

    return updatedDocument;
  });

  response.json({
    voided: true,
    document: normalizeDocumentResponse(voidedDocument)
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
  const extraction = buildMockExtraction(document.id, document.documentType, {
    originalName: readableOriginalName
  });
  const responseText = `已从 ${readableOriginalName} 识别出合同草稿、批次草稿和演示字段。`;

  const [updatedDocument] = await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: {
        aiStatus: DocumentAiStatus.EXTRACTED,
        extractedJson: extraction,
        contractNoDraft: String(extraction.contractNoDraft),
        batchNoDraft: String(extraction.batchNoDraft)
      },
      select: documentSelect
    }),
    prisma.aiLog.create({
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
    })
  ]);

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

    const updatedDocument = await prisma.document.update({
      where: { id: document.id },
      data: {
        extractedJson: nextExtraction,
        contractNoDraft: contractNoDraft ?? document.contractNoDraft,
        batchNoDraft: batchNoDraft ?? document.batchNoDraft
      },
      select: documentSelect
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

          await tx.document.update({
            where: { id: document.id },
            data: {
            businessCreated: true,
            relatedEntityType: document.relatedEntityType ?? "CONTRACT",
            relatedEntityId: document.relatedEntityId ?? existing.contract.id,
            status: DocumentStatus.ACTIVE
          }
        });

        return {
          created: false,
          ...existing
        };
      }

      const draft = parseConfirmedDraft(document);
      await ensureRequiredBusinessDocuments(tx, draft);

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

      if (duplicateContract && duplicateContract.sourceDocumentId !== document.id) {
        throw new BusinessConflictError(`合同号 ${draft.contractNo} 已存在，请先修改草稿合同号。`);
      }

      if (duplicateBatch && duplicateBatch.sourceDocumentId !== document.id) {
        throw new BusinessConflictError(`批次号 ${draft.batchNo} 已存在，请先修改草稿批次号。`);
      }

      const references = await resolveBusinessReferences(tx, draft);
      const unitPrice = draft.totalQuantity > 0 ? Number((draft.amount / draft.totalQuantity).toFixed(2)) : null;
      const dueDate = new Date(Date.now() + 30 * ONE_DAY_IN_MS);
      const purchaseNo = `PO-${draft.contractNo.replace(/^CTR-/, "")}`;

      const contract = await tx.contract.create({
        data: {
          contractNo: draft.contractNo,
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
          sourceDocumentId: document.id
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
          sourceDocumentId: document.id,
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

      await tx.document.update({
        where: { id: document.id },
        data: {
          businessCreated: true,
          relatedEntityType: "CONTRACT",
          relatedEntityId: contract.id,
          status: DocumentStatus.ACTIVE
        }
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
