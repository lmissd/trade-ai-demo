import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Prisma, AiTaskStatus, AiTaskType, DocumentAiStatus, DocumentType } from "@prisma/client";
import { Router } from "express";
import multer from "multer";
import { demoScenarioConfig } from "../config/demoScenario";
import { env } from "../config/env";
import { documentsUploadDir } from "../config/paths";
import { prisma } from "../lib/prisma";

fs.mkdirSync(documentsUploadDir, { recursive: true });

const allowedDocumentTypes = new Set<string>(Object.values(DocumentType));

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
  updatedAt: true
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

function normalizeDocumentResponse<T extends { originalName: string | null; extractedJson: Prisma.JsonValue | null }>(
  document: T
) {
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
