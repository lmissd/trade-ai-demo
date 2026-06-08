import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Space,
  Spin,
  Statistic,
  Tag,
  Typography,
  message
} from "antd";
import { MessageOutlined, RobotOutlined, SettingOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { requestJson } from "../lib/api";

type RuntimeConfig = {
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string | null;
  updatedAt: string;
};

type AiAssistantStatus = {
  llmEnabled: boolean;
  provider: string;
  model: string | null;
  mode: "llm" | "template";
  source: "runtime" | "env" | "template";
  baseUrl: string | null;
  runtimeConfig: RuntimeConfig | null;
  suggestedQuestions: string[];
};

type AiAssistantConfigStatus = {
  source: "runtime" | "env" | "template";
  mode: "llm" | "template";
  llmEnabled: boolean;
  provider: string;
  model: string | null;
  baseUrl: string | null;
  runtimeConfig: RuntimeConfig | null;
};

type SaveAiAssistantConfigResponse = {
  message: string;
  config: RuntimeConfig;
};

type AiHighlight = {
  label: string;
  value: string;
};

type AiAssistantAnswer = {
  question: string;
  detectedIntent:
    | "ASSISTANT_STATUS"
    | "BATCH_INVENTORY"
    | "CONTRACT_INVENTORY"
    | "TODAY_INBOUND"
    | "TODAY_OUTBOUND"
    | "QR_LIFECYCLE"
    | "UNPAID_CONTRACTS"
    | "OVERVIEW";
  answer: string;
  answerMode: "llm" | "template";
  provider: string;
  model: string | null;
  fallbackReason?: string | null;
  generatedAt: string;
  references: {
    batchNo?: string;
    contractNo?: string;
    qrCode?: string;
  };
  highlights: AiHighlight[];
  data: Record<string, unknown>;
};

type AiAssistantPanelProps = {
  variant?: "page" | "drawer";
};

const intentLabelMap: Record<AiAssistantAnswer["detectedIntent"], string> = {
  ASSISTANT_STATUS: "助手状态",
  BATCH_INVENTORY: "批次库存",
  CONTRACT_INVENTORY: "合同库存",
  TODAY_INBOUND: "今日入库",
  TODAY_OUTBOUND: "今日出库",
  QR_LIFECYCLE: "二维码生命周期",
  UNPAID_CONTRACTS: "未回款合同",
  OVERVIEW: "库存总览"
};

const sourceLabelMap: Record<AiAssistantStatus["source"], string> = {
  runtime: "网页升级配置",
  env: "服务器环境配置",
  template: "本地模板模式"
};

const deepSeekRecommendedBaseUrl = "https://api.deepseek.com";
const deepSeekFlashModel = "deepseek-v4-flash";
const deepSeekProModel = "deepseek-v4-pro";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function buildSourceDescription(status: AiAssistantStatus | null) {
  if (!status) {
    return "正在加载 AI 助手状态。";
  }

  if (status.source === "runtime") {
    return "当前优先使用网页里保存的升级版 AI 配置。";
  }

  if (status.source === "env") {
    return "当前使用服务器环境变量中的大模型配置。";
  }

  return "当前使用本地模板模式，开箱即可演示，无需填写任何 API 信息。";
}

export function AiAssistantPanel({ variant = "page" }: AiAssistantPanelProps) {
  const [status, setStatus] = useState<AiAssistantStatus | null>(null);
  const [configStatus, setConfigStatus] = useState<AiAssistantConfigStatus | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AiAssistantAnswer | null>(null);
  const [providerInput, setProviderInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [baseUrlInput, setBaseUrlInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isAsking, setIsAsking] = useState(false);
  const [isConfigSaving, setIsConfigSaving] = useState(false);

  function applyProviderPreset(provider: string, model: string, baseUrl: string) {
    setProviderInput(provider);
    setModelInput(model);
    setBaseUrlInput(baseUrl);
  }

  function syncConfigDraft(nextStatus: AiAssistantStatus, nextConfig: AiAssistantConfigStatus) {
    if (nextConfig.runtimeConfig) {
      setProviderInput(nextConfig.runtimeConfig.provider);
      setModelInput(nextConfig.runtimeConfig.model);
      setBaseUrlInput(nextConfig.runtimeConfig.baseUrl);
      setApiKeyInput("");
      return;
    }

    if (!providerInput && nextStatus.source === "env") {
      setProviderInput(nextStatus.provider);
    }

    if (!modelInput && nextStatus.model) {
      setModelInput(nextStatus.model);
    }

    if (!baseUrlInput && nextStatus.baseUrl) {
      setBaseUrlInput(nextStatus.baseUrl);
    }
  }

  async function loadAssistantMeta() {
    setIsStatusLoading(true);

    try {
      const [nextStatus, nextConfigStatus] = await Promise.all([
        requestJson<AiAssistantStatus>("/api/ai-assistant/status"),
        requestJson<AiAssistantConfigStatus>("/api/ai-assistant/config")
      ]);

      setStatus(nextStatus);
      setConfigStatus(nextConfigStatus);
      syncConfigDraft(nextStatus, nextConfigStatus);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 AI 助手状态失败。");
    } finally {
      setIsStatusLoading(false);
    }
  }

  async function askQuestion(nextQuestion?: string) {
    const finalQuestion = (nextQuestion ?? question).trim();

    if (!finalQuestion) {
      message.warning("请先输入一个问题。");
      return;
    }

    setQuestion(finalQuestion);
    setIsAsking(true);

    try {
      const result = await requestJson<AiAssistantAnswer>("/api/ai-assistant/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: finalQuestion
        })
      });

      setAnswer(result);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "AI 助手回答失败。");
    } finally {
      setIsAsking(false);
    }
  }

  async function saveUpgradeConfig() {
    const provider = providerInput.trim();
    const model = modelInput.trim();
    const baseUrl = baseUrlInput.trim();
    const apiKey = apiKeyInput.trim();
    const keepExistingApiKey = !apiKey && Boolean(configStatus?.runtimeConfig?.apiKeyConfigured);

    if (!provider) {
      message.warning("请填写 provider。");
      return;
    }

    if (!model) {
      message.warning("请填写模型名称。");
      return;
    }

    if (!apiKey && !keepExistingApiKey) {
      message.warning("首次保存升级版 AI 时，请填写 API Key。");
      return;
    }

    setIsConfigSaving(true);

    try {
      const result = await requestJson<SaveAiAssistantConfigResponse>("/api/ai-assistant/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          provider,
          model,
          baseUrl,
          apiKey,
          keepExistingApiKey
        })
      });

      setApiKeyInput("");
      setConfigStatus({
        source: "runtime",
        mode: "llm",
        llmEnabled: true,
        provider,
        model,
        baseUrl: baseUrl || null,
        runtimeConfig: result.config
      });
      setStatus((current) =>
        current
          ? {
              ...current,
              llmEnabled: true,
              provider,
              model,
              mode: "llm",
              source: "runtime",
              baseUrl: baseUrl || null,
              runtimeConfig: result.config
            }
          : current
      );
      message.success("升级版 AI 配置已保存。");
      await loadAssistantMeta();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存升级版 AI 配置失败。");
    } finally {
      setIsConfigSaving(false);
    }
  }

  async function clearUpgradeConfig() {
    setIsConfigSaving(true);

    try {
      await requestJson<{ message: string }>("/api/ai-assistant/config", {
        method: "DELETE"
      });

      setApiKeyInput("");
      message.success("已切回本地模板模式。");
      await loadAssistantMeta();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "切回本地模板模式失败。");
    } finally {
      setIsConfigSaving(false);
    }
  }

  useEffect(() => {
    void loadAssistantMeta();
  }, []);

  const heroSection = (
    <section className={variant === "drawer" ? "ai-assistant-compact-hero" : "page-hero"}>
      <div className="placeholder-meta">
        <span className="placeholder-icon">
          <RobotOutlined />
        </span>
        <div>
          <Typography.Title level={variant === "drawer" ? 4 : 2} style={{ margin: 0 }}>
            AI 助手
          </Typography.Title>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            默认就是本地模板 AI，想接入 DeepSeek 或其他 OpenAI 兼容大模型时，再切到升级版 AI 助手并填写后端配置。
          </Typography.Paragraph>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
            DeepSeek 官方当前推荐使用 `https://api.deepseek.com`，模型优先填 `deepseek-v4-flash` 或 `deepseek-v4-pro`。
          </Typography.Paragraph>
        </div>
      </div>

      <div className="placeholder-badges">
        <Tag color="blue">真实库存问答</Tag>
        <Tag color="cyan">后端受控查询</Tag>
        <Tag color={status?.llmEnabled ? "green" : "orange"}>
          {status?.llmEnabled ? "升级版 AI 已启用" : "本地模板模式"}
        </Tag>
        <Tag color="gold">{status ? sourceLabelMap[status.source] : "状态加载中"}</Tag>
      </div>
    </section>
  );

  const statCards = (
    <Row gutter={[variant === "drawer" ? 12 : 20, variant === "drawer" ? 12 : 20]}>
      <Col xs={24} md={variant === "drawer" ? 8 : 8}>
        <Card className="stat-card">
          <Statistic title="回答模式" value={status?.mode === "llm" ? "升级版 AI" : "本地模板"} />
        </Card>
      </Col>
      <Col xs={24} md={variant === "drawer" ? 8 : 8}>
        <Card className="stat-card">
          <Statistic title="当前来源" value={status ? sourceLabelMap[status.source] : "-"} />
        </Card>
      </Col>
      <Col xs={24} md={variant === "drawer" ? 8 : 8}>
        <Card className="stat-card">
          <Statistic title="Provider" value={status?.provider ?? "-"} />
        </Card>
      </Col>
    </Row>
  );

  const statusAlert = (
    <Alert
      type={status?.llmEnabled ? "success" : "warning"}
      showIcon
      message={status?.llmEnabled ? "当前已启用升级版 AI 回答" : "当前处于本地模板模式"}
      description={buildSourceDescription(status)}
    />
  );

  const askCard = (
    <Card className="placeholder-card" title="直接提问">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          支持批次库存、合同库存、指定日期入库/出库、二维码生命周期和未回款合同等问题。
        </Typography.Paragraph>

        <Space.Compact style={{ width: "100%" }}>
          <Input
            size="large"
            prefix={<MessageOutlined />}
            placeholder="例如：这批货现在还有多少？"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onPressEnter={() => void askQuestion()}
          />
          <Button type="primary" size="large" loading={isAsking} onClick={() => void askQuestion()}>
            提问
          </Button>
        </Space.Compact>

        <div>
          <Typography.Text strong>建议问题</Typography.Text>
          <div className="placeholder-badges" style={{ marginTop: 12 }}>
            {isStatusLoading ? (
              <Spin size="small" />
            ) : (
              (status?.suggestedQuestions ?? []).map((item) => (
                <Button key={item} onClick={() => void askQuestion(item)}>
                  {item}
                </Button>
              ))
            )}
          </div>
        </div>
      </Space>
    </Card>
  );

  const upgradeCard = (
    <Card
      className="placeholder-card"
      title={
        <Space>
          <ThunderboltOutlined />
          <span>升级版 AI 助手</span>
        </Space>
      }
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="安全原则"
          description="API Key 只会发送到后端并保存在本机运行时配置里，前端后续只显示是否已配置和脱敏状态，不会回显完整 Key。"
        />

        <Alert
          type="success"
          showIcon
          message="DeepSeek 官方快捷参数"
          description="截至 2026-06-08，DeepSeek 官方 OpenAI 兼容 Base URL 是 https://api.deepseek.com，推荐模型为 deepseek-v4-flash 与 deepseek-v4-pro。旧模型 deepseek-chat / deepseek-reasoner 将于 2026-07-24 15:59 UTC 停止使用。"
        />

        <div className="placeholder-badges">
          <Button onClick={() => applyProviderPreset("deepseek", deepSeekFlashModel, deepSeekRecommendedBaseUrl)}>
            填充 DeepSeek Flash
          </Button>
          <Button onClick={() => applyProviderPreset("deepseek", deepSeekProModel, deepSeekRecommendedBaseUrl)}>
            填充 DeepSeek Pro
          </Button>
        </div>

        <div className="ai-upgrade-grid">
          <div>
            <Typography.Text strong>当前运行来源</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {status ? sourceLabelMap[status.source] : "加载中"}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Text strong>已保存升级配置</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {configStatus?.runtimeConfig
                ? `${configStatus.runtimeConfig.provider} / ${configStatus.runtimeConfig.model}`
                : "当前没有网页保存的升级配置"}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Text strong>API Key 状态</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {configStatus?.runtimeConfig?.apiKeyConfigured
                ? `已配置：${configStatus.runtimeConfig.apiKeyMasked ?? "已保存"}`
                : "未配置"}
            </Typography.Paragraph>
          </div>
          <div>
            <Typography.Text strong>最近更新时间</Typography.Text>
            <Typography.Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
              {configStatus?.runtimeConfig?.updatedAt ? formatDateTime(configStatus.runtimeConfig.updatedAt) : "-"}
            </Typography.Paragraph>
          </div>
        </div>

        <div className="ai-upgrade-form">
          <div className="ai-upgrade-form-row">
            <div className="ai-upgrade-field">
              <Typography.Text strong>Provider</Typography.Text>
              <Input
                placeholder="例如：deepseek"
                value={providerInput}
                onChange={(event) => setProviderInput(event.target.value)}
              />
            </div>
            <div className="ai-upgrade-field">
              <Typography.Text strong>模型名称</Typography.Text>
              <Input
                placeholder={`例如：${deepSeekFlashModel}`}
                value={modelInput}
                onChange={(event) => setModelInput(event.target.value)}
              />
            </div>
          </div>

          <div className="ai-upgrade-form-row">
            <div className="ai-upgrade-field ai-upgrade-field--full">
              <Typography.Text strong>Base URL</Typography.Text>
              <Input
                placeholder={`例如：${deepSeekRecommendedBaseUrl}`}
                value={baseUrlInput}
                onChange={(event) => setBaseUrlInput(event.target.value)}
              />
            </div>
          </div>

          <div className="ai-upgrade-form-row">
            <div className="ai-upgrade-field ai-upgrade-field--full">
              <Typography.Text strong>API Key</Typography.Text>
              <Input.Password
                placeholder={
                  configStatus?.runtimeConfig?.apiKeyConfigured
                    ? "留空则继续使用当前已保存的 Key"
                    : "首次保存时请填写 API Key"
                }
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="ai-upgrade-actions">
          <Button
            type="primary"
            icon={<SettingOutlined />}
            loading={isConfigSaving}
            onClick={() => void saveUpgradeConfig()}
          >
            保存升级版配置
          </Button>
          <Button loading={isConfigSaving} onClick={() => void clearUpgradeConfig()}>
            切回本地模板模式
          </Button>
        </div>
      </Space>
    </Card>
  );

  const answerCard = (
    <Card className="placeholder-card document-detail-card" title="AI 回答" loading={isAsking}>
      {answer ? (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <DescriptionsBlock
            items={[
              { label: "用户问题", value: answer.question },
              { label: "识别意图", value: intentLabelMap[answer.detectedIntent] },
              { label: "回答来源", value: answer.answerMode === "llm" ? "升级版 AI 回答" : "本地模板回答" },
              { label: "生成时间", value: formatDateTime(answer.generatedAt) }
            ]}
          />

          {answer.fallbackReason ? (
            <Alert type="warning" showIcon message="已自动回退到本地模板" description={answer.fallbackReason} />
          ) : null}

          <Alert type="info" showIcon message="回答内容" description={answer.answer} />

          <div>
            <Typography.Text strong>关键信息高亮</Typography.Text>
            <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
              {answer.highlights.map((item) => (
                <Col key={`${item.label}-${item.value}`} xs={24} md={variant === "drawer" ? 24 : 12}>
                  <Card className="stat-card">
                    <Statistic title={item.label} value={item.value} />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </Space>
      ) : (
        <Empty description="提一个问题后，这里会展示 AI 基于真实库存数据生成的回答。" />
      )}
    </Card>
  );

  const evidenceCard = (
    <Card className="placeholder-card document-detail-card" title="回答依据">
      {answer ? (
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <DescriptionsBlock
            items={[
              { label: "批次号", value: answer.references.batchNo ?? "-" },
              { label: "合同号", value: answer.references.contractNo ?? "-" },
              { label: "二维码", value: answer.references.qrCode ?? "-" },
              { label: "Provider", value: answer.provider },
              { label: "模型", value: answer.model ?? "未使用大模型" }
            ]}
          />

          <Alert
            type="warning"
            showIcon
            message="受控查询原则"
            description="这里展示的回答依据全部来自后端受控查询结果。模型只负责组织语言，不能绕过接口直接查库，也不能直接改业务数据。"
          />
        </Space>
      ) : (
        <Empty description="当前还没有回答依据可展示。先提一个问题试试。" />
      )}
    </Card>
  );

  if (variant === "drawer") {
    return (
      <div className="ai-assistant-panel ai-assistant-panel--drawer">
        {heroSection}
        {statCards}
        {statusAlert}
        {askCard}
        {upgradeCard}
        {answerCard}
        {evidenceCard}
      </div>
    );
  }

  return (
    <div className="document-workspace">
      {heroSection}
      {statCards}
      <div style={{ marginTop: 20 }}>{statusAlert}</div>
      <div style={{ marginTop: 20 }}>{askCard}</div>
      <div style={{ marginTop: 20 }}>{upgradeCard}</div>

      <Row gutter={[20, 20]} align="top" style={{ marginTop: 20 }}>
        <Col xs={24} xl={14}>
          {answerCard}
        </Col>
        <Col xs={24} xl={10}>
          {evidenceCard}
        </Col>
      </Row>
    </div>
  );
}

function DescriptionsBlock({
  items
}: {
  items: Array<{
    label: string;
    value: string;
  }>;
}) {
  return (
    <div className="documents-notes">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`}>
          <Typography.Text strong>{item.label}：</Typography.Text>
          <Typography.Text>{item.value}</Typography.Text>
        </div>
      ))}
    </div>
  );
}
