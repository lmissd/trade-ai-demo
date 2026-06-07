import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  AiTaskStatus,
  AiTaskType,
  BatchStatus,
  DocumentAiStatus,
  DocumentType,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { demoScenarioConfig } from "../config/demoScenario";
import { env } from "../config/env";
import { documentsUploadDir } from "../config/paths";
import { prisma } from "../lib/prisma";

fs.mkdirSync(documentsUploadDir, { recursive: true });

const allowedDocumentTypes = new Set<string>(Object.values(DocumentType));
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

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
  aiStatus: true,
  extractedJson: true,
  contractNoDraft: true,
  batchNoDraft: true,
  createdAt: true,
  updatedAt: true,
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

function normalizeDocumentResponse(document: DocumentWithSummary) {
  return {
    ...document,
    originalName: decodePotentialMojibake(document.originalName),
    extractedJson: normalizeExtractedJson(document.extractedJson)
  };
}

function buildMockExtraction(documentId: string, documentType: DocumentType): Prisma.JsonObject {
  const suffix = documentId.slice(-6).toUpperCase();
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;

  return {
    source: "mock-document-extractor-v1",
    documentType,
    contractNoDraft: `CTR-${datePart}-${suffix}`,
    batchNoDraft: `BAT-${datePart}-${suffix}`,
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
      "阶段 4 将基于这些草稿字段生成合同与批次。"
    ]
  };
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

documentsRouter.get("/", async (_request, response) => {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: documentSelect
  });

  response.json(documents.map((document) => normalizeDocumentResponse(document)));
});

documentsRouter.post("/upload", upload.single("file"), async (request, response) => {
  const documentTypeValue = request.body.documentType;

  if (!isDocumentType(documentTypeValue)) {
    response.status(400).json({
      message: "documentType is required and must be a valid enum value."
    });
    return;
  }

  if (!request.file) {
    response.status(400).json({ message: "file is required." });
    return;
  }

  const relativeFilePath = path.posix.join("uploads", "documents", request.file.filename);
  const relativeFileUrl = `/${relativeFilePath.replace(/\\/g, "/")}`;
  const fileUrl = `${request.protocol}://${request.get("host")}${relativeFileUrl}`;
  const originalName = decodePotentialMojibake(request.file.originalname);

  const document = await prisma.document.create({
    data: {
      documentType: documentTypeValue,
      fileName: request.file.filename,
      originalName,
      filePath: relativeFilePath,
      fileUrl,
      mimeType: request.file.mimetype,
      size: request.file.size
    },
    select: documentSelect
  });

  response.status(201).json(normalizeDocumentResponse(document));
});

documentsRouter.post("/:id/extract", async (request, response) => {
  const document = await prisma.document.findUnique({
    where: { id: request.params.id },
    select: documentSelect
  });

  if (!document) {
    response.status(404).json({ message: "Document not found." });
    return;
  }

  const extraction = buildMockExtraction(document.id, document.documentType);
  const readableOriginalName = decodePotentialMojibake(document.originalName) ?? document.fileName;
  const responseText = `已从 ${readableOriginalName} 识别出合同草稿、批次草稿和演示场景字段。`;

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
  const document = await prisma.document.findUnique({
    where: { id: request.params.id },
    select: documentSelect
  });

  if (!document) {
    response.status(404).json({ message: "Document not found." });
    return;
  }

  try {
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
  const document = await prisma.document.findUnique({
    where: { id: request.params.id },
    select: documentSelect
  });

  if (!document) {
    response.status(404).json({ message: "Document not found." });
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
        return {
          created: false,
          ...existing
        };
      }

      const draft = parseConfirmedDraft(document);
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
