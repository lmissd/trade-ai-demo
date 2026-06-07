import cors from "cors";
import express from "express";
import { uploadsRoot } from "./config/paths";
import { documentsRouter } from "./routes/documents";
import { healthRouter } from "./routes/health";
import { setupRouter } from "./routes/setup";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadsRoot));

  app.get("/", (_request, response) => {
    response.json({
      name: "trade-ai-demo-server",
      message: "International Trade AI + QR Demo server is running."
    });
  });

  app.use("/api", healthRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/documents", documentsRouter);

  return app;
}
