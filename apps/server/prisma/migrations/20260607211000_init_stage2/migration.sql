-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "aiStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "extractedJson" JSONB,
    "contractNoDraft" TEXT,
    "batchNoDraft" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNo" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "destinationWarehouse" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNo" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "destinationWarehouse" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Batch_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Batch_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QrItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrCode" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_INBOUND',
    "currentWarehouse" TEXT,
    "inboundAt" DATETIME,
    "outboundAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QrItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qrItemId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "warehouseName" TEXT,
    "operatorId" TEXT,
    "note" TEXT,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_qrItemId_fkey" FOREIGN KEY ("qrItemId") REFERENCES "QrItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "receivableAmount" REAL NOT NULL,
    "receivedAmount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "dueDate" DATETIME,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "model" TEXT,
    "userId" TEXT,
    "documentId" TEXT,
    "promptText" TEXT,
    "responseText" TEXT,
    "responseJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AiLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AiLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_batchNo_key" ON "Batch"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "QrItem_qrCode_key" ON "QrItem"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "QrItem_batchId_serialNo_key" ON "QrItem"("batchId", "serialNo");
