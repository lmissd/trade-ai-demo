import { Router } from "express";
import { answerInventoryQuestion, getAiAssistantStatus } from "../services/aiAssistant";
import { clearAiAssistantConfig, getAiAssistantConfigStatus, saveAiAssistantConfig } from "../services/aiAssistantConfig";

export const aiAssistantRouter = Router();

aiAssistantRouter.get("/status", async (_request, response) => {
  response.json(await getAiAssistantStatus());
});

aiAssistantRouter.get("/config", async (_request, response) => {
  response.json(await getAiAssistantConfigStatus());
});

aiAssistantRouter.put("/config", async (request, response) => {
  const payload = request.body as
    | {
        provider?: string;
        model?: string;
        baseUrl?: string;
        apiKey?: string;
        keepExistingApiKey?: boolean;
      }
    | undefined;

  try {
    const config = await saveAiAssistantConfig({
      provider: payload?.provider,
      model: payload?.model,
      baseUrl: payload?.baseUrl,
      apiKey: payload?.apiKey,
      keepExistingApiKey: payload?.keepExistingApiKey
    });

    response.json({
      message: "AI assistant runtime config saved.",
      config
    });
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Failed to save AI assistant runtime config."
    });
  }
});

aiAssistantRouter.delete("/config", async (_request, response) => {
  await clearAiAssistantConfig();

  response.json({
    message: "AI assistant runtime config cleared. Fallback mode restored."
  });
});

aiAssistantRouter.post("/ask", async (request, response) => {
  const payload = request.body as { question?: string } | undefined;
  const question = payload?.question?.trim();

  if (!question) {
    response.status(400).json({ message: "question is required." });
    return;
  }

  try {
    response.json(await answerInventoryQuestion(question));
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "AI assistant failed to answer the question."
    });
  }
});
