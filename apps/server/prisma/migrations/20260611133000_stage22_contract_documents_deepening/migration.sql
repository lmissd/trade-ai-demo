ALTER TABLE "Contract" ADD COLUMN "parentContractId" TEXT;
ALTER TABLE "Contract" ADD COLUMN "executionStatus" TEXT NOT NULL DEFAULT 'DOCUMENT_CONFIRMED';
ALTER TABLE "Contract" ADD COLUMN "executionProgress" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "isOverdue" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contract" ADD COLUMN "overdueDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "breachStatus" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "Contract" ADD COLUMN "breachNote" TEXT;
ALTER TABLE "Contract" ADD COLUMN "plannedReceiptAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "actualReceiptAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "plannedPaymentAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "actualPaymentAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Contract" ADD COLUMN "receiptPaymentPlanJson" JSONB;

UPDATE "Contract"
SET
  "contractType" = CASE
    WHEN "contractType" = 'TRADE' THEN 'PURCHASE'
    ELSE "contractType"
  END,
  "executionStatus" = CASE
    WHEN "status" = 'COMPLETED' THEN 'FULL_CHAIN_COMPLETED'
    WHEN "paymentStatus" = 'PAID' THEN 'READY_TO_ARCHIVE'
    ELSE 'DOCUMENT_CONFIRMED'
  END,
  "executionProgress" = CASE
    WHEN "status" = 'COMPLETED' THEN 100
    WHEN "paymentStatus" = 'PAID' THEN 90
    ELSE 15
  END,
  "plannedReceiptAmount" = "amount",
  "actualReceiptAmount" = 0,
  "plannedPaymentAmount" = ROUND("amount" * 0.6, 2),
  "actualPaymentAmount" = 0,
  "receiptPaymentPlanJson" = json_object(
    'receiptPlan', json_array(json_object(
      'name', '客户回款计划',
      'plannedAmount', "amount",
      'actualAmount', 0,
      'currency', "currency",
      'status', "paymentStatus"
    )),
    'paymentPlan', json_array(json_object(
      'name', '供应商付款计划',
      'plannedAmount', ROUND("amount" * 0.6, 2),
      'actualAmount', 0,
      'currency', "currency",
      'status', 'DEMO_NOT_POSTED'
    )),
    'note', '阶段22补齐的合同收付款计划对比底座，正式版将由真实收付款单据驱动。'
  );

CREATE TABLE "DocumentChangeLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fieldName" TEXT,
  "beforeJson" JSONB,
  "afterJson" JSONB,
  "diffJson" JSONB,
  "reason" TEXT,
  "actorId" TEXT,
  "actorName" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentChangeLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "DocumentChangeLog_documentId_createdAt_idx" ON "DocumentChangeLog"("documentId", "createdAt");
