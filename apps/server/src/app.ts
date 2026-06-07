import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/", (_request, response) => {
    response.json({
      name: "trade-ai-demo-server",
      message: "International Trade AI + QR Demo server is running."
    });
  });

  app.use("/api", healthRouter);

  return app;
}
