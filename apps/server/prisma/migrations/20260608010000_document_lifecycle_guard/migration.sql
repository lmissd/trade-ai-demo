ALTER TABLE "Document" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Document" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "Document" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "Document" ADD COLUMN "voidedAt" DATETIME;
ALTER TABLE "Document" ADD COLUMN "voidedBy" TEXT;
ALTER TABLE "Document" ADD COLUMN "voidReason" TEXT;
ALTER TABLE "Document" ADD COLUMN "replacedByDocumentId" TEXT;
ALTER TABLE "Document" ADD COLUMN "relatedEntityType" TEXT;
ALTER TABLE "Document" ADD COLUMN "relatedEntityId" TEXT;
ALTER TABLE "Document" ADD COLUMN "businessCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

UPDATE "Document"
SET
  "businessCreated" = true,
  "relatedEntityType" = COALESCE("relatedEntityType", 'CONTRACT'),
  "relatedEntityId" = COALESCE(
    "relatedEntityId",
    (
      SELECT "id"
      FROM "Contract"
      WHERE "Contract"."sourceDocumentId" = "Document"."id"
      LIMIT 1
    )
  )
WHERE EXISTS (
  SELECT 1
  FROM "Contract"
  WHERE "Contract"."sourceDocumentId" = "Document"."id"
);
