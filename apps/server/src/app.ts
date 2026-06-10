import cors from "cors";
import express from "express";
import { aiAssistantRouter } from "./routes/ai-assistant";
import { batchesRouter } from "./routes/batches";
import { contractsRouter } from "./routes/contracts";
import { uploadsRoot } from "./config/paths";
import { costsRouter } from "./routes/costs";
import { customsRouter } from "./routes/customs";
import { dashboardRouter } from "./routes/dashboard";
import { documentsRouter } from "./routes/documents";
import { financeRouter } from "./routes/finance";
import { healthRouter } from "./routes/health";
import { inventoryRouter } from "./routes/inventory";
import { logisticsRouter } from "./routes/logistics";
import { procurementRouter } from "./routes/procurement";
import { qrItemsRouter } from "./routes/qr-items";
import { salesRouter } from "./routes/sales";
import { setupRouter } from "./routes/setup";
import { warehouseRouter } from "./routes/warehouse";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use("/uploads", express.static(uploadsRoot));
  app.use("/api", (_request, response, next) => {
    response.set({
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store"
    });
    next();
  });

  app.get("/", (_request, response) => {
    response.json({
      name: "trade-ai-demo-server",
      message: "International Trade AI + QR Demo server is running."
    });
  });

  app.use("/api", healthRouter);
  app.use("/api/setup", setupRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/contracts", contractsRouter);
  app.use("/api/batches", batchesRouter);
  app.use("/api/costs", costsRouter);
  app.use("/api/procurement", procurementRouter);
  app.use("/api/logistics", logisticsRouter);
  app.use("/api/customs", customsRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/ai-assistant", aiAssistantRouter);
  app.use("/api/qr-items", qrItemsRouter);
  app.use("/api/warehouse", warehouseRouter);

  return app;
}
