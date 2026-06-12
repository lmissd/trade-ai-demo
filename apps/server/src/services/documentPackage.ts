import { DocumentAiStatus, DocumentStatus, DocumentType } from "@prisma/client";

export type DocumentPackageRecord = {
  id: string;
  documentType: DocumentType;
  originalName: string | null;
  fileName: string;
  status: DocumentStatus;
  aiStatus: DocumentAiStatus;
  businessCreated: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export const documentPackageRequirements = [
  {
    documentType: DocumentType.CONTRACT,
    label: "合同",
    stage: "正式业务生成",
    level: "required",
    purpose: "约定交易主体、商品、数量、金额、币种和主要责任。"
  },
  {
    documentType: DocumentType.PACKING_LIST,
    label: "箱单",
    stage: "正式业务生成",
    level: "required",
    purpose: "确认本批实际装箱、数量和批次口径。"
  },
  {
    documentType: DocumentType.BILL_OF_LADING,
    label: "提单",
    stage: "国际物流 / 清关",
    level: "customs_required",
    purpose: "承接运输批次、提单号、柜号、港口和到港节点。"
  },
  {
    documentType: DocumentType.INVOICE,
    label: "发票",
    stage: "清关 / 财务",
    level: "customs_required",
    purpose: "用于清关金额、数量一致性检查，并承接应收/开票口径。"
  },
  {
    documentType: DocumentType.CERTIFICATE_OF_ORIGIN,
    label: "产地证",
    stage: "清关",
    level: "recommended",
    purpose: "用于目的国清关资料包和贸易合规证明。"
  },
  {
    documentType: DocumentType.CUSTOMS_ATTACHMENT,
    label: "清关附件",
    stage: "清关",
    level: "recommended",
    purpose: "用于补充报关、清关、查验或目的国监管要求资料。"
  }
] as const;

function chooseCurrentDocument(documents: DocumentPackageRecord[]) {
  const priority = (document: DocumentPackageRecord) => {
    if (document.status === DocumentStatus.ACTIVE && document.aiStatus === DocumentAiStatus.EXTRACTED) {
      return 5;
    }

    if (document.status === DocumentStatus.ACTIVE) {
      return 4;
    }

    if (document.status === DocumentStatus.ARCHIVED) {
      return 3;
    }

    if (document.status === DocumentStatus.REPLACED) {
      return 2;
    }

    if (document.status === DocumentStatus.VOIDED) {
      return 1;
    }

    return 0;
  };

  return [...documents].sort((left, right) => {
    const priorityDiff = priority(right) - priority(left);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return right.updatedAt.getTime() - left.updatedAt.getTime();
  })[0] ?? null;
}

function resolvePackageItemStatus(document: DocumentPackageRecord | null) {
  if (!document) {
    return "MISSING";
  }

  if (document.status === DocumentStatus.VOIDED) {
    return "VOIDED";
  }

  if (document.status === DocumentStatus.REPLACED) {
    return "REPLACED";
  }

  if (document.status === DocumentStatus.ARCHIVED) {
    return "ARCHIVED";
  }

  if (document.aiStatus === DocumentAiStatus.EXTRACTED) {
    return document.businessCreated ? "BUSINESS_CREATED" : "RECOGNIZED";
  }

  return "UPLOADED";
}

function isRecognizedEnough(status: string) {
  return status === "RECOGNIZED" || status === "BUSINESS_CREATED" || status === "ARCHIVED";
}

export function buildDocumentPackageStatus(documents: DocumentPackageRecord[]) {
  const items = documentPackageRequirements.map((requirement) => {
    const typedDocuments = documents.filter((document) => document.documentType === requirement.documentType);
    const currentDocument = chooseCurrentDocument(typedDocuments);
    const status = resolvePackageItemStatus(currentDocument);

    return {
      ...requirement,
      status,
      isSatisfied: isRecognizedEnough(status),
      document: currentDocument
        ? {
            id: currentDocument.id,
            originalName: currentDocument.originalName,
            fileName: currentDocument.fileName,
            status: currentDocument.status,
            aiStatus: currentDocument.aiStatus,
            businessCreated: currentDocument.businessCreated,
            version: currentDocument.version,
            createdAt: currentDocument.createdAt,
            updatedAt: currentDocument.updatedAt
          }
        : null,
      historyCount: typedDocuments.length
    };
  });

  const requiredItems = items.filter((item) => item.level === "required");
  const customsRequiredItems = items.filter((item) => item.level === "customs_required");
  const satisfiedCount = items.filter((item) => item.isSatisfied).length;
  const requiredMissing = requiredItems.filter((item) => !item.isSatisfied);
  const customsMissing = [...requiredItems, ...customsRequiredItems].filter((item) => !item.isSatisfied);

  return {
    items,
    summary: {
      total: items.length,
      satisfied: satisfiedCount,
      completionRate: Math.round((satisfiedCount / items.length) * 100),
      coreReady: requiredMissing.length === 0,
      customsReady: customsMissing.length === 0,
      requiredMissing: requiredMissing.map((item) => item.label),
      customsMissing: customsMissing.map((item) => item.label),
      message:
        requiredMissing.length === 0
          ? "核心生成条件已满足：合同和箱单已具备。"
          : `核心生成条件未满足：缺少 ${requiredMissing.map((item) => item.label).join("、")}。`
    }
  };
}
