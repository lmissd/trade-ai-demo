import OpenAI from "openai";
import { AiTaskStatus, AiTaskType, QrItemStatus, StockMovementType } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { type PublicAiAssistantConfig, type ResolvedAiAssistantRuntime, resolveAiAssistantRuntime } from "./aiAssistantConfig";
import { buildAiProcessStatusFacts } from "./aiAssistantProcess";
import { buildInventorySummary } from "./inventorySummary";

export type AiIntent =
  | "ASSISTANT_STATUS"
  | "PROCESS_STATUS"
  | "BATCH_INVENTORY"
  | "CONTRACT_INVENTORY"
  | "TODAY_INBOUND"
  | "TODAY_OUTBOUND"
  | "QR_LIFECYCLE"
  | "UNPAID_CONTRACTS"
  | "OVERVIEW";

export type AiAnswerMode = "llm" | "template";

export type AiAnswerHighlight = {
  label: string;
  value: string;
};

export type AiAssistantStatus = {
  llmEnabled: boolean;
  provider: string;
  model: string | null;
  mode: AiAnswerMode;
  source: "runtime" | "env" | "template";
  baseUrl: string | null;
  runtimeConfig: PublicAiAssistantConfig | null;
  suggestedQuestions: string[];
};

export type AiAssistantAnswer = {
  question: string;
  detectedIntent: AiIntent;
  answer: string;
  answerMode: AiAnswerMode;
  provider: string;
  model: string | null;
  fallbackReason?: string | null;
  generatedAt: string;
  references: {
    batchNo?: string;
    contractNo?: string;
    qrCode?: string;
  };
  highlights: AiAnswerHighlight[];
  data: Record<string, unknown>;
};

type IntentContext = {
  intent: AiIntent;
  batchNo?: string;
  contractNo?: string;
  qrCode?: string;
  targetDate?: string;
};

type QuestionFacts = {
  references: AiAssistantAnswer["references"];
  highlights: AiAnswerHighlight[];
  data: Record<string, unknown>;
};

type OpenAiMessageContentPart = {
  text?: string;
};

type OpenAiLikeChoice = {
  delta?: {
    content?: unknown;
  };
  message?: {
    content?: unknown;
  };
};

type OpenAiLikeCompletion = {
  choices?: OpenAiLikeChoice[];
};

type OpenAiResponsesOutputContent = {
  type?: string;
  text?: string;
};

type OpenAiResponsesOutputItem = {
  type?: string;
  content?: OpenAiResponsesOutputContent[];
};

type OpenAiResponsesApiResponse = {
  output_text?: string;
  output?: OpenAiResponsesOutputItem[];
};

let openAiClientCache:
  | {
      signature: string;
      client: OpenAI;
    }
  | null = null;

const batchNoRegex = /BAT-\d{8}-[A-Z0-9]+/i;
const qrCodeRegex = /BAT-\d{8}-[A-Z0-9]+-\d{4}/i;
const contractNoRegex = /CTR-\d{8}-[A-Z0-9]+/i;
const explicitDateRegex = /\b(20\d{2})[/-](\d{1,2})[/-](\d{1,2})\b/;
const processStatusKeywords = [
  "流程",
  "进度",
  "现状",
  "走到哪",
  "到哪一步",
  "卡在哪",
  "哪一步",
  "当前状态",
  "业务状态",
  "全流程",
  "采购",
  "集货",
  "物流",
  "清关",
  "报关",
  "仓储",
  "配送",
  "回款",
  "工单"
];
const assistantStatusKeywords = [
  "什么模型",
  "当前模型",
  "用的什么模型",
  "现在是什么模型",
  "现在用什么模型",
  "回答模式",
  "运行来源",
  "provider",
  "base url",
  "baseurl",
  "升级版ai",
  "本地模板"
];

function normalizeBatchStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "草稿批次";
    case "READY_FOR_QR":
      return "待生成二维码";
    case "QR_GENERATED":
      return "已生成二维码";
    case "INBOUND_IN_PROGRESS":
      return "入库中";
    case "IN_STOCK":
      return "已入库";
    case "OUTBOUND_IN_PROGRESS":
      return "出库中";
    case "COMPLETED":
      return "已完成";
    default:
      return status ?? "-";
  }
}

function normalizeContractStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "DRAFT":
      return "草稿合同";
    case "ACTIVE":
      return "执行中";
    case "COMPLETED":
      return "已完成";
    case "CANCELLED":
      return "已取消";
    default:
      return status ?? "-";
  }
}

function equalsIgnoreCase(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").toUpperCase() === (right ?? "").toUpperCase();
}

function buildRuntimeClientSignature(runtime: ResolvedAiAssistantRuntime) {
  return JSON.stringify({
    provider: runtime.provider,
    model: runtime.model,
    baseUrl: runtime.baseUrl,
    apiKey: runtime.apiKey
  });
}

function getOpenAiClient(runtime: ResolvedAiAssistantRuntime) {
  if (!runtime.llmEnabled || !runtime.model) {
    return null;
  }

  const signature = buildRuntimeClientSignature(runtime);

  if (!openAiClientCache || openAiClientCache.signature !== signature) {
    openAiClientCache = {
      signature,
      client: new OpenAI({
        apiKey: runtime.apiKey,
        timeout: 20000,
        ...(runtime.baseUrl ? { baseURL: runtime.baseUrl } : {})
      })
    };
  }

  return openAiClientCache.client;
}

function formatDateCn(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Shanghai"
  }).format(date);
}

function formatDateTimeCn(date: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
  }).format(typeof date === "string" ? new Date(date) : date);
}

function formatStatusLabel(status: string | null | undefined) {
  switch (status) {
    case QrItemStatus.PENDING_INBOUND:
      return "待入库";
    case QrItemStatus.IN_STOCK:
      return "在库";
    case QrItemStatus.OUTBOUND:
      return "已出库";
    case QrItemStatus.FROZEN:
      return "已冻结";
    case QrItemStatus.DAMAGED:
      return "损坏";
    case QrItemStatus.LOST:
      return "丢失";
    default:
      return status ?? "-";
  }
}

function formatMovementTypeLabel(type: string) {
  switch (type) {
    case StockMovementType.INBOUND:
      return "入库";
    case StockMovementType.OUTBOUND:
      return "出库";
    case StockMovementType.FREEZE:
      return "冻结";
    case StockMovementType.UNFREEZE:
      return "解冻";
    case StockMovementType.ADJUSTMENT:
      return "调整";
    default:
      return type;
  }
}

function formatAssistantSourceLabel(source: ResolvedAiAssistantRuntime["source"]) {
  switch (source) {
    case "runtime":
      return "网页升级配置";
    case "env":
      return "服务端环境变量";
    case "template":
    default:
      return "本地模板模式";
  }
}

function formatAssistantModeLabel(mode: ResolvedAiAssistantRuntime["mode"]) {
  return mode === "llm" ? "升级版 AI" : "本地模板";
}

function formatQuantity(value: number, unit = "箱") {
  return `${value}${unit}`;
}

function extractTextFromUnknownContent(content: unknown) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (item && typeof item === "object" && "text" in item) {
        const text = (item as OpenAiMessageContentPart).text;
        return typeof text === "string" ? text : "";
      }

      return "";
    })
    .join("")
    .trim();
}

function parseOpenAiCompatibleStringResponse(raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html")) {
    throw new Error("当前 Base URL 返回的是网页 HTML，不是 OpenAI 兼容 API。请改成该平台提供的真实接口地址。");
  }

  if (!trimmed.startsWith("data:")) {
    return trimmed;
  }

  const textParts: string[] = [];
  let sawStreamPayload = false;

  for (const line of trimmed.split(/\r?\n/)) {
    const currentLine = line.trim();

    if (!currentLine.startsWith("data:")) {
      continue;
    }

    const payload = currentLine.slice(5).trim();

    if (!payload || payload === "[DONE]") {
      continue;
    }

    sawStreamPayload = true;

    try {
      const parsed = JSON.parse(payload) as OpenAiLikeCompletion;
      const choice = parsed.choices?.[0];
      const deltaText = extractTextFromUnknownContent(choice?.delta?.content);
      const messageText = extractTextFromUnknownContent(choice?.message?.content);
      const resolvedText = deltaText || messageText;

      if (resolvedText) {
        textParts.push(resolvedText);
      }
    } catch {
      // Ignore malformed stream fragments and keep scanning later chunks.
    }
  }

  if (textParts.length > 0) {
    return textParts.join("").trim() || null;
  }

  if (sawStreamPayload) {
    throw new Error("当前模型接口返回了非标准流式结果，未能解析出回答内容。请检查该平台是否提供标准 OpenAI 兼容接口。");
  }

  return trimmed;
}

function extractTextFromResponsesApiResponse(response: unknown) {
  if (!response || typeof response !== "object") {
    return "";
  }

  const parsed = response as OpenAiResponsesApiResponse;

  if (typeof parsed.output_text === "string" && parsed.output_text.trim()) {
    return parsed.output_text.trim();
  }

  if (!Array.isArray(parsed.output)) {
    return "";
  }

  return parsed.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .filter((item) => item?.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function shouldPreferResponsesApi(runtime: ResolvedAiAssistantRuntime) {
  const provider = runtime.provider.trim().toLowerCase();
  const baseUrl = (runtime.baseUrl ?? "").trim().toLowerCase();

  return (
    runtime.apiKey.trim() === "PROXY_MANAGED" ||
    provider === "custom" ||
    provider.includes("codex") ||
    baseUrl.includes("127.0.0.1:15721") ||
    baseUrl.includes("localhost:15721")
  );
}

function parseExplicitDate(question: string) {
  const matched = question.match(explicitDateRegex);

  if (!matched) {
    return null;
  }

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const normalizedMonth = `${month}`.padStart(2, "0");
  const normalizedDay = `${day}`.padStart(2, "0");

  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

function extractIntent(question: string): IntentContext {
  const normalized = question.trim();
  const normalizedLower = normalized.toLowerCase();
  const qrCode = normalized.match(qrCodeRegex)?.[0]?.toUpperCase();
  const contractNo = normalized.match(contractNoRegex)?.[0]?.toUpperCase();
  const batchNo = normalized.match(batchNoRegex)?.[0]?.toUpperCase();
  const explicitDate = parseExplicitDate(normalized);

  if (
    assistantStatusKeywords.some((keyword) => normalizedLower.includes(keyword)) ||
    (normalized.includes("你现在") && normalized.includes("模型")) ||
    (normalized.includes("当前") && normalized.includes("模型"))
  ) {
    return {
      intent: "ASSISTANT_STATUS"
    };
  }

  if (qrCode || normalized.includes("二维码") || normalized.includes("生命周期")) {
    return {
      intent: "QR_LIFECYCLE",
      qrCode,
      batchNo
    };
  }

  if ((normalized.includes("今天") || normalized.includes("今日") || explicitDate) && normalized.includes("入库")) {
    return {
      intent: "TODAY_INBOUND",
      targetDate: explicitDate ?? undefined
    };
  }

  if ((normalized.includes("今天") || normalized.includes("今日") || explicitDate) && normalized.includes("出库")) {
    return {
      intent: "TODAY_OUTBOUND",
      targetDate: explicitDate ?? undefined
    };
  }

  if (normalized.includes("未回款") || normalized.includes("未收款") || normalized.includes("应收")) {
    return {
      intent: "UNPAID_CONTRACTS",
      contractNo
    };
  }

  if (
    processStatusKeywords.some((keyword) => normalized.includes(keyword)) ||
    normalized.includes("出入库") ||
    normalized.includes("都入库") ||
    normalized.includes("都出库") ||
    normalized.includes("入库了没") ||
    normalized.includes("出库了没") ||
    normalized.includes("这票货") ||
    normalized.includes("这票") ||
    normalized.includes("这单")
  ) {
    return {
      intent: "PROCESS_STATUS",
      batchNo,
      contractNo
    };
  }

  if (contractNo || normalized.includes("合同")) {
    return {
      intent: "CONTRACT_INVENTORY",
      contractNo
    };
  }

  if (batchNo || normalized.includes("批次") || normalized.includes("这批") || normalized.includes("这批货")) {
    return {
      intent: "BATCH_INVENTORY",
      batchNo
    };
  }

  return {
    intent: "OVERVIEW"
  };
}

async function resolveAssistantStatusFacts(runtime: ResolvedAiAssistantRuntime): Promise<QuestionFacts> {
  return {
    references: {},
    highlights: [
      { label: "回答模式", value: formatAssistantModeLabel(runtime.mode) },
      { label: "运行来源", value: formatAssistantSourceLabel(runtime.source) },
      { label: "Provider", value: runtime.provider },
      { label: "模型", value: runtime.model ?? "未启用升级版模型" }
    ],
    data: {
      mode: runtime.mode,
      source: runtime.source,
      llmEnabled: runtime.llmEnabled,
      provider: runtime.provider,
      model: runtime.model,
      baseUrl: runtime.baseUrl,
      runtimeConfig: runtime.runtimeConfig
    }
  };
}

async function resolveProcessFacts(context: IntentContext): Promise<QuestionFacts> {
  return buildAiProcessStatusFacts({
    contractNo: context.contractNo,
    batchNo: context.batchNo
  });
}

async function resolveBatchFacts(context: IntentContext): Promise<QuestionFacts> {
  let batchId: string | null = null;
  let resolvedBatchNo = context.batchNo;

  if (resolvedBatchNo) {
    const batch = await prisma.batch.findFirst({
      where: {
        batchNo: {
          equals: resolvedBatchNo
        }
      },
      select: {
        id: true,
        batchNo: true
      }
    });

    if (batch) {
      batchId = batch.id;
      resolvedBatchNo = batch.batchNo;
    }
  }

  const summary = await buildInventorySummary(batchId ? { batchId } : {});
  const batchEntry =
    summary.byBatch.find((item) => equalsIgnoreCase(item.batchNo, resolvedBatchNo)) ??
    summary.byBatch.find((item) => item.totalQrItems > 0) ??
    summary.byBatch[0];

  if (!batchEntry) {
    const masterBatch = batchId
      ? await prisma.batch.findUnique({
          where: { id: batchId },
          select: {
            id: true,
            batchNo: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true,
            contract: {
              select: {
                contractNo: true
              }
            }
          }
        })
      : await prisma.batch.findFirst({
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            batchNo: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true,
            contract: {
              select: {
                contractNo: true
              }
            }
          }
        });

    if (!masterBatch) {
      return {
        references: {},
        highlights: [{ label: "结果", value: "当前还没有可用于问答的批次数据" }],
        data: {
          message: "当前没有批次数据"
        }
      };
    }

    const processFacts = await buildAiProcessStatusFacts({
      batchNo: masterBatch.batchNo
    });
    const warehouseModule =
      processFacts.data.modules.warehouse as
        | {
            statusLabel?: string;
            detail?: string;
          }
        | undefined;

    return {
      references: {
        batchNo: masterBatch.batchNo,
        contractNo: masterBatch.contract?.contractNo
      },
      highlights: [
        { label: "批次号", value: masterBatch.batchNo },
        { label: "关联合同", value: masterBatch.contract?.contractNo ?? "-" },
        { label: "批次计划数量", value: formatQuantity(masterBatch.totalQuantity, masterBatch.unit) },
        { label: "当前环节", value: processFacts.data.currentStage.label },
        { label: "库存层状态", value: warehouseModule?.statusLabel ?? "尚未进入库存层" }
      ],
      data: {
        message: "batch_quantity_without_inventory",
        generatedAt: summary.generatedAt,
        inventoryReady: false,
        batchMaster: {
          batchNo: masterBatch.batchNo,
          contractNo: masterBatch.contract?.contractNo ?? null,
          totalQuantity: masterBatch.totalQuantity,
          unit: masterBatch.unit,
          status: masterBatch.status,
          statusLabel: normalizeBatchStatusLabel(masterBatch.status),
          destinationWarehouse: masterBatch.destinationWarehouse
        },
        currentStage: processFacts.data.currentStage,
        nextAction: processFacts.data.nextAction,
        blockers: processFacts.data.blockers,
        warehouse: warehouseModule ?? null
      }
    };
  }

  return {
    references: {
      batchNo: batchEntry.batchNo,
      contractNo: batchEntry.contractNo
    },
    highlights: [
      { label: "批次号", value: batchEntry.batchNo },
      { label: "关联合同", value: batchEntry.contractNo },
      { label: "在途库存", value: formatQuantity(batchEntry.inTransitInventory, batchEntry.unit) },
      { label: "在库库存", value: formatQuantity(batchEntry.availableInventory, batchEntry.unit) },
      { label: "已出库", value: formatQuantity(batchEntry.outboundQuantity, batchEntry.unit) }
    ],
    data: {
      generatedAt: summary.generatedAt,
      batch: batchEntry
    }
  };
}

async function resolveContractFacts(context: IntentContext): Promise<QuestionFacts> {
  let contractId: string | null = null;
  let resolvedContractNo = context.contractNo;

  if (resolvedContractNo) {
    const contract = await prisma.contract.findFirst({
      where: {
        contractNo: {
          equals: resolvedContractNo
        }
      },
      select: {
        id: true,
        contractNo: true
      }
    });

    if (contract) {
      contractId = contract.id;
      resolvedContractNo = contract.contractNo;
    }
  }

  const summary = await buildInventorySummary(contractId ? { contractId } : {});
  const contractEntry =
    summary.byContract.find((item) => equalsIgnoreCase(item.contractNo, resolvedContractNo)) ??
    summary.byContract.find((item) => item.totalQrItems > 0) ??
    summary.byContract[0];

  if (!contractEntry) {
    const masterContract = contractId
      ? await prisma.contract.findUnique({
          where: { id: contractId },
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true
          }
        })
      : await prisma.contract.findFirst({
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
          select: {
            id: true,
            contractNo: true,
            customerName: true,
            totalQuantity: true,
            unit: true,
            status: true,
            destinationWarehouse: true
          }
        });

    if (!masterContract) {
      return {
        references: {},
        highlights: [{ label: "结果", value: "当前还没有可用于问答的合同数据" }],
        data: {
          message: "当前没有合同数据"
        }
      };
    }

    const processFacts = await buildAiProcessStatusFacts({
      contractNo: masterContract.contractNo
    });
    const warehouseModule =
      processFacts.data.modules.warehouse as
        | {
            statusLabel?: string;
            detail?: string;
          }
        | undefined;

    return {
      references: {
        contractNo: masterContract.contractNo
      },
      highlights: [
        { label: "合同号", value: masterContract.contractNo },
        { label: "客户", value: masterContract.customerName },
        { label: "合同总量", value: formatQuantity(masterContract.totalQuantity, masterContract.unit) },
        { label: "当前环节", value: processFacts.data.currentStage.label },
        { label: "库存层状态", value: warehouseModule?.statusLabel ?? "尚未进入库存层" }
      ],
      data: {
        message: "contract_quantity_without_inventory",
        generatedAt: summary.generatedAt,
        inventoryReady: false,
        contractMaster: {
          contractNo: masterContract.contractNo,
          customerName: masterContract.customerName,
          totalQuantity: masterContract.totalQuantity,
          unit: masterContract.unit,
          status: masterContract.status,
          statusLabel: normalizeContractStatusLabel(masterContract.status),
          destinationWarehouse: masterContract.destinationWarehouse
        },
        currentStage: processFacts.data.currentStage,
        nextAction: processFacts.data.nextAction,
        blockers: processFacts.data.blockers,
        warehouse: warehouseModule ?? null
      }
    };
  }

  return {
    references: {
      contractNo: contractEntry.contractNo
    },
    highlights: [
      { label: "合同号", value: contractEntry.contractNo },
      { label: "客户", value: contractEntry.customerName },
      { label: "在途库存", value: formatQuantity(contractEntry.inTransitInventory, contractEntry.unit ?? "箱") },
      { label: "实时库存", value: formatQuantity(contractEntry.realtimeInventory, contractEntry.unit ?? "箱") },
      { label: "已出库", value: formatQuantity(contractEntry.outboundQuantity, contractEntry.unit ?? "箱") }
    ],
    data: {
      generatedAt: summary.generatedAt,
      contract: contractEntry
    }
  };
}

function getTodayRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { now, start, end };
}

function getDateRange(targetDate?: string) {
  if (!targetDate) {
    return getTodayRange();
  }

  const [year, month, day] = targetDate.split("-").map((item) => Number(item));
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day, 23, 59, 59, 999);

  return {
    now: start,
    start,
    end
  };
}

async function resolveTodayMovementFacts(context: IntentContext): Promise<QuestionFacts> {
  const { now, start, end } = getDateRange(context.targetDate);
  const movementDate = formatDateCn(now);
  const movementType = context.intent === "TODAY_INBOUND" ? StockMovementType.INBOUND : StockMovementType.OUTBOUND;
  const movements = await prisma.stockMovement.findMany({
    where: {
      movementType,
      occurredAt: {
        gte: start,
        lte: end
      }
    },
    orderBy: {
      occurredAt: "desc"
    },
    take: 10,
    include: {
      batch: {
        select: {
          batchNo: true
        }
      },
      contract: {
        select: {
          contractNo: true
        }
      },
      qrItem: {
        select: {
          qrCode: true
        }
      }
    }
  });

  return {
    references: {},
    highlights: [
      { label: "统计日期", value: movementDate },
      { label: context.intent === "TODAY_INBOUND" ? "入库数量" : "出库数量", value: formatQuantity(movements.length) }
    ],
    data: {
      date: movementDate,
      movementType,
      totalQuantity: movements.length,
      movements: movements.map((item) => ({
        qrCode: item.qrItem.qrCode,
        batchNo: item.batch.batchNo,
        contractNo: item.contract.contractNo,
        occurredAt: item.occurredAt
      }))
    }
  };
}

async function resolveQrLifecycleFacts(context: IntentContext): Promise<QuestionFacts> {
  const qrCode = context.qrCode;

  if (!qrCode) {
    return {
      references: {},
      highlights: [{ label: "提示", value: "请在问题里带上具体二维码编号，例如 BAT-20260607-3BP3IZ-0001" }],
      data: {
        message: "missing_qr_code"
      }
    };
  }

  const qrItem = await prisma.qrItem.findFirst({
    where: {
      qrCode: {
        equals: qrCode
      }
    },
    include: {
      batch: {
        select: {
          batchNo: true,
          destinationWarehouse: true,
          contract: {
            select: {
              contractNo: true
            }
          }
        }
      },
      stockMovements: {
        orderBy: {
          occurredAt: "desc"
        },
        select: {
          id: true,
          movementType: true,
          fromStatus: true,
          toStatus: true,
          occurredAt: true,
          warehouseName: true
        }
      }
    }
  });

  if (!qrItem) {
    const fallbackQrItem = await prisma.qrItem.findMany({
      where: {
        qrCode: {
          contains: qrCode
        }
      },
      include: {
        batch: {
          select: {
            batchNo: true,
            destinationWarehouse: true,
            contract: {
              select: {
                contractNo: true
              }
            }
          }
        },
        stockMovements: {
          orderBy: {
            occurredAt: "desc"
          },
          select: {
            id: true,
            movementType: true,
            fromStatus: true,
            toStatus: true,
            occurredAt: true,
            warehouseName: true
          }
        }
      }
    });

    const matchedQrItem = fallbackQrItem.find((item) => equalsIgnoreCase(item.qrCode, qrCode));

    if (matchedQrItem) {
      return {
        references: {
          qrCode: matchedQrItem.qrCode,
          batchNo: matchedQrItem.batch.batchNo,
          contractNo: matchedQrItem.batch.contract?.contractNo
        },
        highlights: [
          { label: "二维码", value: matchedQrItem.qrCode },
          { label: "当前状态", value: formatStatusLabel(matchedQrItem.status) },
          { label: "批次号", value: matchedQrItem.batch.batchNo },
          { label: "合同号", value: matchedQrItem.batch.contract?.contractNo ?? "-" },
          { label: "当前仓库", value: matchedQrItem.currentWarehouse ?? matchedQrItem.batch.destinationWarehouse ?? "-" }
        ],
        data: {
          qrItem: {
            qrCode: matchedQrItem.qrCode,
            status: matchedQrItem.status,
            batchNo: matchedQrItem.batch.batchNo,
            contractNo: matchedQrItem.batch.contract?.contractNo ?? null,
            currentWarehouse: matchedQrItem.currentWarehouse ?? matchedQrItem.batch.destinationWarehouse ?? null,
            inboundAt: matchedQrItem.inboundAt,
            outboundAt: matchedQrItem.outboundAt
          },
          lifecycle: matchedQrItem.stockMovements.map((item) => ({
            movementType: item.movementType,
            fromStatus: item.fromStatus,
            toStatus: item.toStatus,
            warehouseName: item.warehouseName,
            occurredAt: item.occurredAt
          }))
        }
      };
    }
  }

  if (!qrItem) {
    return {
      references: {
        qrCode
      },
      highlights: [{ label: "结果", value: `没有找到二维码 ${qrCode}` }],
      data: {
        message: "qr_not_found",
        qrCode
      }
    };
  }

  return {
    references: {
      qrCode: qrItem.qrCode,
      batchNo: qrItem.batch.batchNo,
      contractNo: qrItem.batch.contract?.contractNo
    },
    highlights: [
      { label: "二维码", value: qrItem.qrCode },
      { label: "当前状态", value: formatStatusLabel(qrItem.status) },
      { label: "批次号", value: qrItem.batch.batchNo },
      { label: "合同号", value: qrItem.batch.contract?.contractNo ?? "-" },
      { label: "当前仓库", value: qrItem.currentWarehouse ?? qrItem.batch.destinationWarehouse ?? "-" }
    ],
    data: {
      qrItem: {
        qrCode: qrItem.qrCode,
        status: qrItem.status,
        batchNo: qrItem.batch.batchNo,
        contractNo: qrItem.batch.contract?.contractNo ?? null,
        currentWarehouse: qrItem.currentWarehouse ?? qrItem.batch.destinationWarehouse ?? null,
        inboundAt: qrItem.inboundAt,
        outboundAt: qrItem.outboundAt
      },
      lifecycle: qrItem.stockMovements.map((item) => ({
        movementType: item.movementType,
        fromStatus: item.fromStatus,
        toStatus: item.toStatus,
        warehouseName: item.warehouseName,
        occurredAt: item.occurredAt
      }))
    }
  };
}

async function resolveUnpaidContractFacts(): Promise<QuestionFacts> {
  const receivables = await prisma.receivable.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: 10,
    select: {
      id: true,
      contractId: true,
      amount: true,
      receivedAmount: true,
      currency: true,
      status: true,
      dueDate: true
    }
  });

  const contractIds = receivables.map((item) => item.contractId).filter((item): item is string => Boolean(item));
  const contracts = contractIds.length
    ? await prisma.contract.findMany({
        where: {
          id: {
            in: contractIds
          }
        },
        select: {
          id: true,
          contractNo: true,
          customerName: true
        }
      })
    : [];
  const contractMap = new Map(contracts.map((item) => [item.id, item]));
  const openItems = receivables
    .map((item) => ({
      ...item,
      openAmount: Math.max(item.amount - item.receivedAmount, 0),
      contract: item.contractId ? contractMap.get(item.contractId) ?? null : null
    }))
    .filter((item) => item.openAmount > 0);

  return {
    references: {},
    highlights: [
      { label: "未回款合同数", value: `${openItems.length}个` },
      {
        label: "未回款总额",
        value:
          openItems.length > 0
            ? `${openItems.reduce((sum, item) => sum + item.openAmount, 0)} ${openItems[0].currency}`
            : "0"
      }
    ],
    data: {
      receivables: openItems.map((item) => ({
        contractNo: item.contract?.contractNo ?? "未关联合同",
        customerName: item.contract?.customerName ?? "-",
        currency: item.currency,
        amount: item.amount,
        receivedAmount: item.receivedAmount,
        openAmount: item.openAmount,
        dueDate: item.dueDate
      }))
    }
  };
}

async function resolveOverviewFacts(): Promise<QuestionFacts> {
  return buildAiProcessStatusFacts({});
}

async function resolveFacts(context: IntentContext, runtime: ResolvedAiAssistantRuntime): Promise<QuestionFacts> {
  switch (context.intent) {
    case "ASSISTANT_STATUS":
      return resolveAssistantStatusFacts(runtime);
    case "PROCESS_STATUS":
      return resolveProcessFacts(context);
    case "BATCH_INVENTORY":
      return resolveBatchFacts(context);
    case "CONTRACT_INVENTORY":
      return resolveContractFacts(context);
    case "TODAY_INBOUND":
    case "TODAY_OUTBOUND":
      return resolveTodayMovementFacts(context);
    case "QR_LIFECYCLE":
      return resolveQrLifecycleFacts(context);
    case "UNPAID_CONTRACTS":
      return resolveUnpaidContractFacts();
    case "OVERVIEW":
    default:
      return resolveOverviewFacts();
  }
}

function buildTemplateAnswer(context: IntentContext, facts: QuestionFacts) {
  switch (context.intent) {
    case "ASSISTANT_STATUS": {
      const data = facts.data as {
        mode: ResolvedAiAssistantRuntime["mode"];
        source: ResolvedAiAssistantRuntime["source"];
        llmEnabled: boolean;
        provider: string;
        model: string | null;
        baseUrl: string | null;
      };

      if (!data.llmEnabled) {
        return "当前还没有启用升级版大模型，系统正在使用本地模板模式回答。也就是说，这一刻没有真正外部模型在参与回答。";
      }

      return `当前优先使用的是 ${data.provider} / ${data.model ?? "未命名模型"}，运行来源是${formatAssistantSourceLabel(data.source)}。如果这个升级版模型临时调用失败，系统会自动回退到本地模板回答，保证 Demo 不会中断。`;
    }
    case "PROCESS_STATUS": {
      const data = facts.data as {
        currentStage?: {
          label?: string;
          detail?: string;
        };
        nextAction?: string;
        blockers?: string[];
        focus?: {
          contractNo?: string | null;
          batchNo?: string | null;
        };
        modules?: {
          finance?: {
            statusLabel?: string;
            openAmount?: number;
            receivable?: {
              currency?: string;
            } | null;
          };
        };
      };

      const currentStage = data.currentStage?.label ?? "暂无可识别流程环节";
      const currentDetail = data.currentStage?.detail ?? "当前还没有足够的正式业务数据。";
      const focusLabels = [data.focus?.contractNo, data.focus?.batchNo].filter(Boolean).join(" / ");
      const blockers = Array.isArray(data.blockers) ? data.blockers.filter(Boolean) : [];
      const financeStatus = data.modules?.finance?.statusLabel;
      const financeOpenAmount =
        typeof data.modules?.finance?.openAmount === "number"
          ? `${data.modules?.finance?.openAmount} ${data.modules?.finance?.receivable?.currency ?? ""}`.trim()
          : null;
      const financeText =
        financeStatus && financeOpenAmount
          ? `财务目前是“${financeStatus}”，未完成金额约 ${financeOpenAmount}。`
          : financeStatus
            ? `财务目前是“${financeStatus}”。`
            : "";
      const blockerText = blockers.length > 0 ? `当前需要注意：${blockers.slice(0, 2).join("；")}。` : "";

      return `${focusLabels ? `${focusLabels} 当前` : "当前这票业务"}走到“${currentStage}”。这不是系统报错，而是流程当前确实推进到这里。${currentDetail}${financeText}${blockerText}如果你更关心“现在到底能不能算库存”，要以二维码和扫码流水为准。下一步建议：${data.nextAction ?? "继续按当前模块状态推进。"}。`;
    }
    case "BATCH_INVENTORY": {
      if (facts.data.message === "batch_quantity_without_inventory") {
        const batchMaster = facts.data.batchMaster as
          | {
              batchNo: string;
              contractNo: string | null;
              totalQuantity: number;
              unit: string;
              statusLabel: string;
            }
          | undefined;
        const currentStage = (facts.data.currentStage as { label?: string } | undefined)?.label ?? "待进入库存层";
        const nextAction =
          typeof facts.data.nextAction === "string" ? facts.data.nextAction : "先生成二维码，再通过扫码形成真实库存。";

        if (!batchMaster) {
          return "当前还没有可用于问答的批次数据。";
        }

        return `${batchMaster.batchNo} 这批货目前不是系统出错。它的批次计划数量是 ${batchMaster.totalQuantity}${batchMaster.unit}${
          batchMaster.contractNo ? `，关联合同 ${batchMaster.contractNo}` : ""
        }。但当前批次状态是“${batchMaster.statusLabel}”，还没有生成二维码并进入真实库存层，所以这 ${batchMaster.totalQuantity}${batchMaster.unit} 目前只能理解为计划数量，不能理解为已经在库，也不能理解为已经出入库。当前流程环节是“${currentStage}”，下一步建议：${nextAction}`;
      }

      const batch = facts.data.batch as
        | {
            batchNo: string;
            contractNo: string;
            availableInventory: number;
            inTransitInventory: number;
            outboundQuantity: number;
            unit: string;
          }
        | undefined;

      if (!batch) {
        return "当前还没有可用于问答的批次库存数据，请先完成二维码生成或扫码入库。";
      }

      return `${batch.batchNo} 如果你问的是系统当前已经确认的实货数量，那么现在在库 ${batch.availableInventory}${batch.unit}，在途 ${batch.inTransitInventory}${batch.unit}，已出库 ${batch.outboundQuantity}${batch.unit}。这里说的是二维码和扫码流水确认过的真实库存，不是合同上的计划数量。`;
    }
    case "CONTRACT_INVENTORY": {
      if (facts.data.message === "contract_quantity_without_inventory") {
        const contractMaster = facts.data.contractMaster as
          | {
              contractNo: string;
              totalQuantity: number;
              unit: string;
              statusLabel: string;
            }
          | undefined;
        const currentStage = (facts.data.currentStage as { label?: string } | undefined)?.label ?? "待进入库存层";
        const nextAction =
          typeof facts.data.nextAction === "string" ? facts.data.nextAction : "先生成二维码，再通过扫码形成真实库存。";

        if (!contractMaster) {
          return "当前还没有可用于问答的合同数据。";
        }

        return `${contractMaster.contractNo} 当前不是系统异常。合同总量是 ${contractMaster.totalQuantity}${contractMaster.unit}，但这代表业务约定数量，不代表系统已经确认的真实库存。因为现在还没有生成二维码或形成扫码流水，所以不能把这 ${contractMaster.totalQuantity}${contractMaster.unit} 直接理解为已经在库。当前流程环节是“${currentStage}”，下一步建议：${nextAction}`;
      }

      const contract = facts.data.contract as
        | {
            contractNo: string;
            availableInventory: number;
            inTransitInventory: number;
            outboundQuantity: number;
            unit: string | null;
          }
        | undefined;

      if (!contract) {
        return "当前还没有可用于问答的合同库存数据。";
      }

      return `${contract.contractNo} 如果你问的是系统当前已经确认的实货数量，那么当前实时库存 ${contract.availableInventory}${contract.unit ?? "箱"}，在途 ${contract.inTransitInventory}${contract.unit ?? "箱"}，已出库 ${contract.outboundQuantity}${contract.unit ?? "箱"}。这部分是按二维码和扫码流水统计出来的真实库存。`;
    }
    case "TODAY_INBOUND":
    case "TODAY_OUTBOUND": {
      const data = facts.data as {
        date: string;
        totalQuantity: number;
      };
      const label = context.intent === "TODAY_INBOUND" ? "入库" : "出库";
      return `${data.date} 的${label}数量是 ${data.totalQuantity}箱。这个结果来自该日期的真实库存流水。`;
    }
    case "QR_LIFECYCLE": {
      const qrItem = facts.data.qrItem as
        | {
            qrCode: string;
            status: string;
            batchNo: string;
            contractNo: string | null;
          }
        | undefined;
      const lifecycle = (facts.data.lifecycle as Array<{
        movementType: string;
        fromStatus: string | null;
        toStatus: string | null;
        occurredAt: Date;
      }>) ?? [];

      if (!qrItem) {
        return facts.data.message === "missing_qr_code"
          ? "请在问题里补充具体二维码编号，我才能查询这一个货物的真实生命周期。"
          : `没有找到你提到的二维码。`;
      }

      const latestFlow =
        lifecycle.length > 0
          ? lifecycle
              .map(
                (item) =>
                  `${formatMovementTypeLabel(item.movementType)}：${formatStatusLabel(item.fromStatus)} → ${formatStatusLabel(item.toStatus)}（${formatDateTimeCn(item.occurredAt)}）`
              )
              .join("；")
          : "当前还没有库存流水";

      return `${qrItem.qrCode} 当前状态是${formatStatusLabel(qrItem.status)}，属于批次 ${qrItem.batchNo}${qrItem.contractNo ? `，关联合同 ${qrItem.contractNo}` : ""}。生命周期记录为：${latestFlow}。`;
    }
    case "UNPAID_CONTRACTS": {
      const receivables = (facts.data.receivables as Array<{
        contractNo: string;
        openAmount: number;
        currency: string;
      }>) ?? [];

      if (receivables.length === 0) {
        return "当前没有未回款合同。";
      }

      const preview = receivables
        .slice(0, 3)
        .map((item) => `${item.contractNo} 未回款 ${item.openAmount} ${item.currency}`)
        .join("；");

      return `当前共有 ${receivables.length} 个未回款合同。示例包括：${preview}。`;
    }
    case "OVERVIEW":
    default: {
      const summary = facts.data as
        | {
            currentStage?: {
              label?: string;
              detail?: string;
            };
            nextAction?: string;
            inventory?: {
              global?: {
                inTransitInventory?: number;
                realtimeInventory?: number;
                availableInventory?: number;
                outboundQuantity?: number;
              };
            };
          }
        | undefined;

      if (!summary) {
        return "当前还没有库存数据。";
      }

      const inventory = summary.inventory?.global;
      const stageLabel = summary.currentStage?.label ?? "暂无流程状态";
      const stageDetail = summary.currentStage?.detail ?? "";
      const inventoryText = inventory
        ? `全局库存方面：在途 ${inventory.inTransitInventory ?? 0} 箱，实时库存 ${inventory.realtimeInventory ?? 0} 箱，可用库存 ${inventory.availableInventory ?? 0} 箱，已出库 ${inventory.outboundQuantity ?? 0} 箱。`
        : "";

      return `当前总览处于“${stageLabel}”。${stageDetail}${inventoryText}下一步建议：${summary.nextAction ?? "继续按当前模块推进。"}。`;
    }
  }
}

async function buildLlmAnswer(
  question: string,
  context: IntentContext,
  facts: QuestionFacts,
  runtime: ResolvedAiAssistantRuntime
) {
  const client = getOpenAiClient(runtime);

  if (!client) {
    return null;
  }

  const systemPrompt =
    "你是国际贸易 ERP Demo 的 AI 助手。默认把提问者视为不懂业务细节的领导，要尽量减少误解。你只能根据提供的受控查询 JSON 回答，绝对不能虚构数字，也不能假装看到了数据库之外的信息。若 JSON 中包含 currentStage、modules、inventory、recentTasks 或 recentActivities，就把它们视为当前真实流程现状。若 JSON 中出现 inventoryReady=false 或 message 为 batch_quantity_without_inventory / contract_quantity_without_inventory，必须明确解释“合同或批次计划数量存在，但二维码/库存层尚未建立，不能把合同数量直接当成当前库存”，并明确告诉用户“这不是系统报错”。回答使用简洁中文，先给结论，再给一两句通俗解释，少用术语；如必须使用术语，要顺手解释。若用户在问流程现状，请明确说出当前环节、关键状态和下一步。若问题涉及今天/今日，必须写出具体日期。";
  const userPrompt = `用户问题：${question}\n识别意图：${context.intent}\n受控查询结果：${JSON.stringify(facts.data, null, 2)}`;
  const preferResponsesApi = shouldPreferResponsesApi(runtime);
  const errors: string[] = [];

  const tryResponsesApi = async () => {
    const responseRaw = (await client.responses.create({
      model: runtime.model!,
      instructions: systemPrompt,
      input: userPrompt
    })) as unknown;

    if (typeof responseRaw === "string") {
      return parseOpenAiCompatibleStringResponse(responseRaw);
    }

    return extractTextFromResponsesApiResponse(responseRaw) || null;
  };

  const tryChatCompletionsApi = async () => {
    const completionRaw = (await client.chat.completions.create({
      model: runtime.model!,
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ]
    })) as unknown;

    if (typeof completionRaw === "string") {
      return parseOpenAiCompatibleStringResponse(completionRaw);
    }

    if (!completionRaw || typeof completionRaw !== "object") {
      return null;
    }

    const completion = completionRaw as OpenAiLikeCompletion;
    const firstChoice = completion.choices?.[0];
    const messageText = extractTextFromUnknownContent(firstChoice?.message?.content);
    const deltaText = extractTextFromUnknownContent(firstChoice?.delta?.content);
    return messageText || deltaText || null;
  };

  const strategies = preferResponsesApi
    ? [
        { name: "responses", handler: tryResponsesApi },
        { name: "chat.completions", handler: tryChatCompletionsApi }
      ]
    : [
        { name: "chat.completions", handler: tryChatCompletionsApi },
        { name: "responses", handler: tryResponsesApi }
      ];

  for (const strategy of strategies) {
    try {
      const result = await strategy.handler();

      if (result) {
        return result;
      }

      errors.push(`${strategy.name} 返回空结果`);
    } catch (error) {
      errors.push(error instanceof Error ? `${strategy.name}: ${error.message}` : `${strategy.name}: 调用失败`);
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("；"));
  }

  return null;
}

async function writeAiLog(params: {
  question: string;
  context: IntentContext;
  answer: string;
  answerMode: AiAnswerMode;
  provider: string;
  model: string | null;
  facts: QuestionFacts;
}) {
  await prisma.aiLog.create({
    data: {
      taskType: AiTaskType.INVENTORY_QA,
      status: AiTaskStatus.SUCCESS,
      scenario: env.demoScenarioName,
      provider: params.provider,
      model: params.model,
      promptText: params.question,
        inputText: JSON.stringify({
          intent: params.context.intent,
          targetDate: params.context.targetDate ?? null,
          references: params.facts.references,
          data: params.facts.data
        }),
      responseText: params.answer,
      outputText: params.answer,
      responseJson: {
        answerMode: params.answerMode,
        highlights: params.facts.highlights
      },
      parsedJson: {
        intent: params.context.intent,
        targetDate: params.context.targetDate ?? null,
        references: params.facts.references
      }
    }
  });
}

export async function getAiAssistantStatus(): Promise<AiAssistantStatus> {
  const runtime = await resolveAiAssistantRuntime();
  const summary = await buildInventorySummary();
  const latestBatch = summary.byBatch.find((item) => item.totalQrItems > 0) ?? summary.byBatch[0] ?? null;
  const latestContract = summary.byContract.find((item) => item.totalQrItems > 0) ?? summary.byContract[0] ?? null;
  const latestQrItem = await prisma.qrItem.findFirst({
    orderBy: [{ updatedAt: "desc" }, { serialNo: "asc" }],
    select: {
      qrCode: true
    }
  });
  const today = formatDateCn(new Date());

  return {
    llmEnabled: runtime.llmEnabled,
    provider: runtime.provider,
    model: runtime.model,
    mode: runtime.mode,
    source: runtime.source,
    baseUrl: runtime.baseUrl,
    runtimeConfig: runtime.runtimeConfig,
    suggestedQuestions: [
      "这票货现在走到哪一步了？",
      "当前全流程卡在哪个环节？",
      "采购、物流、清关、仓储、销售、回款分别是什么状态？",
      "这批货现在还有多少？",
      "你现在是什么模型？",
      latestBatch ? `${latestBatch.batchNo} 这个批次现在还有多少库存？` : "当前批次还有多少库存？",
      latestContract ? `${latestContract.contractNo} 这个合同现在还有多少库存？` : "当前合同还有多少库存？",
      `${today} 入库多少箱？`,
      `${today} 出库多少箱？`,
      latestQrItem ? `${latestQrItem.qrCode} 这个二维码现在是什么状态？` : "这个二维码现在是什么状态？",
      "现在有哪些未回款合同？"
    ]
  };
}

export async function answerAssistantQuestion(question: string): Promise<AiAssistantAnswer> {
  const cleanedQuestion = question.trim();
  const context = extractIntent(cleanedQuestion);
  const runtime = await resolveAiAssistantRuntime();
  const facts = await resolveFacts(context, runtime);
  let answerMode: AiAnswerMode = "template";
  let provider = context.intent === "ASSISTANT_STATUS" ? runtime.provider : "template";
  let model: string | null = context.intent === "ASSISTANT_STATUS" ? runtime.model : null;
  let answer = buildTemplateAnswer(context, facts);
  let fallbackReason: string | null = null;

  if (runtime.llmEnabled && context.intent !== "ASSISTANT_STATUS") {
    try {
      const llmAnswer = await buildLlmAnswer(cleanedQuestion, context, facts, runtime);

      if (llmAnswer) {
        answer = llmAnswer;
        answerMode = "llm";
        provider = runtime.provider;
        model = runtime.model;
      } else {
        provider = `${runtime.provider}-fallback`;
        model = runtime.model;
        fallbackReason = "升级版模型返回空结果，系统已自动回退到本地模板回答。";
      }
    } catch (error) {
      provider = `${runtime.provider}-fallback`;
      model = runtime.model;
      fallbackReason = error instanceof Error ? error.message : "升级版模型调用失败，系统已自动回退到本地模板回答。";
    }
  }

  const result: AiAssistantAnswer = {
    question: cleanedQuestion,
    detectedIntent: context.intent,
    answer,
    answerMode,
    provider,
    model,
    fallbackReason,
    generatedAt: new Date().toISOString(),
    references: facts.references,
    highlights: facts.highlights,
    data: facts.data
  };

  await writeAiLog({
    question: cleanedQuestion,
    context,
    answer,
    answerMode,
    provider,
    model,
    facts
  });

  return result;
}

export const answerInventoryQuestion = answerAssistantQuestion;
