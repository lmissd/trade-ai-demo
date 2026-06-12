ALTER TABLE "Document" ADD COLUMN "matchStatus" TEXT NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "Document" ADD COLUMN "matchConfidence" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Document" ADD COLUMN "matchReason" TEXT;
ALTER TABLE "Document" ADD COLUMN "manualMatchLocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DocumentPackageDraft" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageNo" TEXT NOT NULL,
  "contractNoDraft" TEXT,
  "batchNoDraft" TEXT,
  "customerName" TEXT,
  "supplierName" TEXT,
  "productName" TEXT,
  "destinationWarehouse" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "matchSummary" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "DocumentPackageDraft_packageNo_key" ON "DocumentPackageDraft"("packageNo");
CREATE INDEX "DocumentPackageDraft_contract_batch_idx" ON "DocumentPackageDraft"("contractNoDraft", "batchNoDraft");

CREATE TABLE "DocumentPackageItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "packageDraftId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "assignmentType" TEXT NOT NULL DEFAULT 'AUTO',
  "note" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentPackageItem_packageDraftId_fkey" FOREIGN KEY ("packageDraftId") REFERENCES "DocumentPackageDraft" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DocumentPackageItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DocumentPackageItem_documentId_key" ON "DocumentPackageItem"("documentId");
CREATE UNIQUE INDEX "DocumentPackageItem_packageDraftId_documentId_key" ON "DocumentPackageItem"("packageDraftId", "documentId");

CREATE TABLE "DocumentMatchLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "packageDraftId" TEXT,
  "eventType" TEXT NOT NULL,
  "matchStatus" TEXT NOT NULL,
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "detailJson" JSONB,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentMatchLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DocumentMatchLog_packageDraftId_fkey" FOREIGN KEY ("packageDraftId") REFERENCES "DocumentPackageDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DocumentMatchLog_documentId_createdAt_idx" ON "DocumentMatchLog"("documentId", "createdAt");
CREATE INDEX "DocumentMatchLog_packageDraftId_createdAt_idx" ON "DocumentMatchLog"("packageDraftId", "createdAt");
