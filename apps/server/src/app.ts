import cors from "cors";
import express from "express";
import { batchesRouter } from "./routes/batches";
import { contractsRouter } from "./routes/contracts";
import { uploadsRoot } from "./config/paths";
import { documentsRouter } from "./routes/documents";
import { healthRouter } from "./routes/health";
import { inventoryRouter } from "./routes/inventory";
import { qrItemsRouter } from "./routes/qr-items";
import { setupRouter } from "./routes/setup";
import { warehouseRouter } from "./routes/warehouse";

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
  app.use("/api/contracts", contractsRouter);
  app.use("/api/batches", batchesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/qr-items", qrItemsRouter);
  app.use("/api/warehouse", warehouseRouter);

  return app;
}
