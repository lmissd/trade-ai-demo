import fs from "node:fs/promises";
import path from "node:path";
import { aiAssistantRuntimeConfigPath, runtimeConfigRoot } from "../config/paths";
import { env } from "../config/env";

export type SavedAiAssistantConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  updatedAt: string;
};

export type PublicAiAssistantConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  updatedAt: string;
};

export type SaveAiAssistantConfigInput = {
  provider?: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  keepExistingApiKey?: boolean;
};

export type ResolvedAiAssistantRuntime = {
  source: "runtime" | "env" | "template";
  llmEnabled: boolean;
  provider: string;
  model: string | null;
  baseUrl: string | null;
  apiKey: string;
  mode: "llm" | "template";
  runtimeConfig: PublicAiAssistantConfig | null;
};

function normalizeText(value: string | undefined | null) {
  return value?.trim() ?? "";
}

function normalizeBaseUrl(value: string | undefined | null) {
  const raw = normalizeText(value);

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, "");
    const hostname = url.hostname.trim().toLowerCase();

    if (hostname === "api.deepseek.com" && (!pathname || pathname === "/")) {
      url.pathname = "";
      return url.toString().replace(/\/$/, "");
    }

    if (!pathname || pathname === "/") {
      url.pathname = "/v1";
    } else {
      url.pathname = pathname;
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function canUseLlm(provider: string, model: string, apiKey: string) {
  return provider.trim().toLowerCase() !== "mock" && model.trim().length > 0 && apiKey.trim().length > 0;
}

function maskApiKey(value: string) {
  if (!value) {
    return null;
  }

  if (value.length <= 8) {
    return `${value.slice(0, 2)}***${value.slice(-1)}`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function toPublicConfig(config: SavedAiAssistantConfig): PublicAiAssistantConfig {
  return {
    provider: config.provider,
    model: config.model,
    baseUrl: config.baseUrl,
    apiKeyConfigured: config.apiKey.length > 0,
    apiKeyMasked: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt
  };
}

async function ensureRuntimeConfigDir() {
  await fs.mkdir(runtimeConfigRoot, { recursive: true });
}

async function readRuntimeConfigFile() {
  try {
    const content = await fs.readFile(aiAssistantRuntimeConfigPath, "utf8");
    const parsed = JSON.parse(content) as Partial<SavedAiAssistantConfig>;
    const provider = normalizeText(parsed.provider);
    const model = normalizeText(parsed.model);
    const baseUrl = normalizeBaseUrl(parsed.baseUrl);
    const apiKey = normalizeText(parsed.apiKey);
    const updatedAt = normalizeText(parsed.updatedAt);

    if (!provider || !model || !apiKey) {
      return null;
    }

    return {
      provider,
      model,
      baseUrl,
      apiKey,
      updatedAt: updatedAt || new Date().toISOString()
    } satisfies SavedAiAssistantConfig;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";

    if (code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export async function getSavedAiAssistantConfig() {
  const saved = await readRuntimeConfigFile();
  return saved ? toPublicConfig(saved) : null;
}

export async function saveAiAssistantConfig(input: SaveAiAssistantConfigInput) {
  const existing = await readRuntimeConfigFile();
  const provider = normalizeText(input.provider || existing?.provider);
  const model = normalizeText(input.model || existing?.model);
  const baseUrl = normalizeBaseUrl(input.baseUrl || existing?.baseUrl);
  const nextApiKey = normalizeText(input.apiKey);
  const apiKey =
    nextApiKey || input.keepExistingApiKey
      ? normalizeText(nextApiKey || existing?.apiKey)
      : normalizeText(nextApiKey);

  if (!provider) {
    throw new Error("provider is required.");
  }

  if (provider.toLowerCase() === "mock") {
    throw new Error("provider cannot be mock when saving upgrade config.");
  }

  if (!model) {
    throw new Error("model is required.");
  }

  if (!apiKey) {
    throw new Error("apiKey is required.");
  }

  const config: SavedAiAssistantConfig = {
    provider,
    model,
    baseUrl,
    apiKey,
    updatedAt: new Date().toISOString()
  };

  await ensureRuntimeConfigDir();
  await fs.writeFile(aiAssistantRuntimeConfigPath, JSON.stringify(config, null, 2), "utf8");

  return toPublicConfig(config);
}

export async function clearAiAssistantConfig() {
  try {
    await fs.unlink(aiAssistantRuntimeConfigPath);
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String((error as { code?: string }).code) : "";

    if (code !== "ENOENT") {
      throw error;
    }
  }
}

export async function resolveAiAssistantRuntime(): Promise<ResolvedAiAssistantRuntime> {
  const runtimeConfig = await readRuntimeConfigFile();

  if (runtimeConfig && canUseLlm(runtimeConfig.provider, runtimeConfig.model, runtimeConfig.apiKey)) {
    return {
      source: "runtime",
      llmEnabled: true,
      provider: runtimeConfig.provider,
      model: runtimeConfig.model,
      baseUrl: runtimeConfig.baseUrl || null,
      apiKey: runtimeConfig.apiKey,
      mode: "llm",
      runtimeConfig: toPublicConfig(runtimeConfig)
    };
  }

  const envProvider = env.aiProvider.trim();
  const envModel = env.aiModel.trim();
  const envApiKey = env.aiApiKey.trim();
  const envBaseUrl = normalizeBaseUrl(env.aiBaseUrl);
  const envLlmEnabled = canUseLlm(envProvider, envModel, envApiKey);

  if (envLlmEnabled) {
    return {
      source: "env",
      llmEnabled: true,
      provider: envProvider,
      model: envModel,
      baseUrl: envBaseUrl || null,
      apiKey: envApiKey,
      mode: "llm",
      runtimeConfig: null
    };
  }

  return {
    source: "template",
    llmEnabled: false,
    provider: "mock",
    model: null,
    baseUrl: null,
    apiKey: "",
    mode: "template",
    runtimeConfig: null
  };
}

export async function getAiAssistantConfigStatus() {
  const runtime = await resolveAiAssistantRuntime();
  const savedConfig = runtime.source === "runtime" ? runtime.runtimeConfig : await getSavedAiAssistantConfig();

  return {
    source: runtime.source,
    mode: runtime.mode,
    llmEnabled: runtime.llmEnabled,
    provider: runtime.provider,
    model: runtime.model,
    baseUrl: runtime.baseUrl,
    runtimeConfig: savedConfig
  };
}

export async function ensureRuntimeConfigRootForDebug() {
  await ensureRuntimeConfigDir();
  return path.dirname(aiAssistantRuntimeConfigPath);
}
