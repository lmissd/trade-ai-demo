import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    service: "trade-ai-demo-server",
    timestamp: new Date().toISOString()
  });
});
