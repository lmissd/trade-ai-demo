ALTER TABLE "QrItem" ADD COLUMN "unitTraceCode" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "boxTraceCode" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "palletTraceCode" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "freezeReason" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "statusRemark" TEXT;

ALTER TABLE "StocktakeOrder" ADD COLUMN "batchId" TEXT;
ALTER TABLE "StocktakeOrder" ADD COLUMN "contractId" TEXT;
ALTER TABLE "StocktakeOrder" ADD COLUMN "plannedQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StocktakeOrder" ADD COLUMN "actualQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StocktakeOrder" ADD COLUMN "differenceQuantity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StocktakeOrder" ADD COLUMN "note" TEXT;

ALTER TABLE "StocktakeItem" ADD COLUMN "systemLocationCode" TEXT;
ALTER TABLE "StocktakeItem" ADD COLUMN "actualLocationCode" TEXT;

ALTER TABLE "PreReceiveOrder" ADD COLUMN "appointmentNo" TEXT;
ALTER TABLE "PreReceiveOrder" ADD COLUMN "appointmentTime" DATETIME;
ALTER TABLE "PreReceiveOrder" ADD COLUMN "waveNo" TEXT;
ALTER TABLE "PreReceiveOrder" ADD COLUMN "dockNo" TEXT;
ALTER TABLE "PreReceiveOrder" ADD COLUMN "arrivalStatus" TEXT NOT NULL DEFAULT 'SCHEDULED';

ALTER TABLE "OutboundOrder" ADD COLUMN "waveNo" TEXT;
ALTER TABLE "OutboundOrder" ADD COLUMN "pickupListNo" TEXT;
ALTER TABLE "OutboundOrder" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "OutboundOrder" ADD COLUMN "firstReviewerName" TEXT;
ALTER TABLE "OutboundOrder" ADD COLUMN "firstReviewedAt" DATETIME;
ALTER TABLE "OutboundOrder" ADD COLUMN "secondReviewerName" TEXT;
ALTER TABLE "OutboundOrder" ADD COLUMN "secondReviewedAt" DATETIME;
ALTER TABLE "OutboundOrder" ADD COLUMN "pickingStatus" TEXT NOT NULL DEFAULT 'READY';

CREATE TABLE "WarehouseAnomaly" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "anomalyNo" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "anomalyType" TEXT NOT NULL,
  "batchId" TEXT,
  "contractId" TEXT,
  "warehouseId" TEXT,
  "relatedOrderId" TEXT,
  "relatedOrderNo" TEXT,
  "qrCode" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reportedById" TEXT,
  "reportedByName" TEXT,
  "handledById" TEXT,
  "handledByName" TEXT,
  "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "WarehouseAnomaly_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "WarehouseAnomaly_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "WarehouseAnomaly_anomalyNo_key" ON "WarehouseAnomaly"("anomalyNo");
CREATE INDEX "WarehouseAnomaly_mode_status_idx" ON "WarehouseAnomaly"("mode", "status");
CREATE INDEX "WarehouseAnomaly_batchId_reportedAt_idx" ON "WarehouseAnomaly"("batchId", "reportedAt");
