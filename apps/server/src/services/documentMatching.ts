import { DocumentAiStatus, DocumentMatchStatus, DocumentStatus, DocumentType, Prisma } from "@prisma/client";

export type MatchableDocument = {
  id: string;
  documentType: DocumentType;
  status: DocumentStatus;
  aiStatus: DocumentAiStatus;
  contractNoDraft: string | null;
  batchNoDraft: string | null;
  extractedJson: Prisma.JsonValue | null;
  matchStatus: DocumentMatchStatus;
  matchConfidence: number;
  matchReason: string | null;
  manualMatchLocked: boolean;
};

export type PackageDraftRecord = {
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
};

export type PackageCandidate = {
  packageDraft: PackageDraftRecord;
  status: "EXACT" | "HIGH_CONFIDENCE" | "CONFLICT" | "LOW_CONFIDENCE";
  confidence: number;
  reason: string;
};

function readObject(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function readDocumentDraftSummary(document: MatchableDocument) {
  const extracted = readObject(document.extractedJson);

  return {
    contractNoDraft: readString(extracted?.contractNoDraft) ?? readString(document.contractNoDraft),
    batchNoDraft: readString(extracted?.batchNoDraft) ?? readString(document.batchNoDraft),
    customerName: readString(extracted?.customerName),
    supplierName: readString(extracted?.supplierName),
    productName: readString(extracted?.productName),
    destinationWarehouse: readString(extracted?.destinationWarehouse),
    totalQuantity: readNumber(extracted?.totalQuantity),
    unit: readString(extracted?.unit)
  };
}

function sameText(left: string | null, right: string | null) {
  return Boolean(left && right && left === right);
}

function hasConflictingText(left: string | null, right: string | null) {
  return Boolean(left && right && left !== right);
}

function isCloseQuantity(left: number | null, right: number | null) {
  if (left === null || right === null) {
    return false;
  }

  return Math.abs(left - right) <= 1;
}

export function buildPackageNo(input: { contractNoDraft: string | null; batchNoDraft: string | null; documentId: string }) {
  if (input.contractNoDraft && input.batchNoDraft) {
    return `PKG-${input.contractNoDraft}-${input.batchNoDraft}`.replace(/[^A-Za-z0-9-_]/g, "-");
  }

  if (input.contractNoDraft) {
    return `PKG-${input.contractNoDraft}-DRAFT`.replace(/[^A-Za-z0-9-_]/g, "-");
  }

  return `PKG-UNMATCHED-${input.documentId.slice(-8).toUpperCase()}`;
}

export function evaluatePackageCandidates(document: MatchableDocument, packageDrafts: PackageDraftRecord[]) {
  const draft = readDocumentDraftSummary(document);
  const candidates: PackageCandidate[] = [];

  for (const packageDraft of packageDrafts) {
    const packageContract = readString(packageDraft.contractNoDraft);
    const packageBatch = readString(packageDraft.batchNoDraft);

    if (
      draft.contractNoDraft &&
      draft.batchNoDraft &&
      sameText(draft.contractNoDraft, packageContract) &&
      sameText(draft.batchNoDraft, packageBatch)
    ) {
      const conflictReasons = [
        hasConflictingText(draft.customerName, packageDraft.customerName) ? "客户不一致" : null,
        hasConflictingText(draft.supplierName, packageDraft.supplierName) ? "供应商不一致" : null,
        hasConflictingText(draft.productName, packageDraft.productName) ? "商品不一致" : null,
        hasConflictingText(draft.destinationWarehouse, packageDraft.destinationWarehouse) ? "目的仓库不一致" : null
      ].filter((item): item is string => Boolean(item));

      if (conflictReasons.length > 0) {
        candidates.push({
          packageDraft,
          status: "CONFLICT",
          confidence: 45,
          reason: `合同号和批次号一致，但${conflictReasons.join("、")}，需要人工确认后再归票。`
        });
        continue;
      }

      candidates.push({
        packageDraft,
        status: "EXACT",
        confidence: 100,
        reason: "合同号与批次号完全一致，判定为同一票同一批次。"
      });
      continue;
    }

    if (draft.contractNoDraft && sameText(draft.contractNoDraft, packageContract)) {
      if (draft.batchNoDraft && packageBatch && draft.batchNoDraft !== packageBatch) {
        candidates.push({
          packageDraft,
          status: "CONFLICT",
          confidence: 25,
          reason: "合同号一致，但批次号不同，属于同合同下不同批次，不能自动并入。"
        });
        continue;
      }

      let score = 55;
      const matchedReasons: string[] = ["合同号一致"];

      if (sameText(draft.customerName, packageDraft.customerName)) {
        score += 10;
        matchedReasons.push("客户一致");
      }

      if (sameText(draft.supplierName, packageDraft.supplierName)) {
        score += 10;
        matchedReasons.push("供应商一致");
      }

      if (sameText(draft.productName, packageDraft.productName)) {
        score += 10;
        matchedReasons.push("商品一致");
      }

      if (sameText(draft.destinationWarehouse, packageDraft.destinationWarehouse)) {
        score += 5;
        matchedReasons.push("目的仓库一致");
      }

      if (draft.totalQuantity !== null && packageDraft.matchSummary) {
        const summaryQuantity = readNumber(packageDraft.matchSummary.match(/数量[:：]\s*(\d+)/)?.[1] ?? null);
        if (isCloseQuantity(draft.totalQuantity, summaryQuantity)) {
          score += 5;
          matchedReasons.push("数量接近");
        }
      }

      candidates.push({
        packageDraft,
        status: score >= 75 ? "HIGH_CONFIDENCE" : "LOW_CONFIDENCE",
        confidence: Math.min(score, 95),
        reason: `${matchedReasons.join("、")}，建议人工确认是否归入同一资料包。`
      });
    }
  }

  return candidates.sort((left, right) => right.confidence - left.confidence);
}

export function buildPackageSummary(input: {
  contractNoDraft: string | null;
  batchNoDraft: string | null;
  customerName: string | null;
  supplierName: string | null;
  productName: string | null;
  destinationWarehouse: string | null;
  totalQuantity: number | null;
  unit: string | null;
}) {
  const pieces = [
    input.contractNoDraft ? `合同号: ${input.contractNoDraft}` : null,
    input.batchNoDraft ? `批次号: ${input.batchNoDraft}` : null,
    input.customerName ? `客户: ${input.customerName}` : null,
    input.supplierName ? `供应商: ${input.supplierName}` : null,
    input.productName ? `商品: ${input.productName}` : null,
    input.destinationWarehouse ? `仓库: ${input.destinationWarehouse}` : null,
    input.totalQuantity !== null ? `数量: ${input.totalQuantity}${input.unit ?? ""}` : null
  ].filter((item): item is string => Boolean(item));

  return pieces.join(" | ");
}
