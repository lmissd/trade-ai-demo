-- AlterTable
ALTER TABLE "AiLog" ADD COLUMN "inputText" TEXT;
ALTER TABLE "AiLog" ADD COLUMN "outputText" TEXT;
ALTER TABLE "AiLog" ADD COLUMN "parsedJson" JSONB;
ALTER TABLE "AiLog" ADD COLUMN "scenario" TEXT;

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN "skuId" TEXT;
ALTER TABLE "Batch" ADD COLUMN "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "fileUrl" TEXT;
ALTER TABLE "Document" ADD COLUMN "size" INTEGER;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "customerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "paidAt" DATETIME;

-- AlterTable
ALTER TABLE "QrItem" ADD COLUMN "contractId" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "locationId" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "productName" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "skuId" TEXT;
ALTER TABLE "QrItem" ADD COLUMN "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "fromStatus" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "locationId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "operatorName" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "remark" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "skuId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "toStatus" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "warehouseId" TEXT;

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleCode" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "permissionCode" TEXT NOT NULL,
    "permissionName" TEXT NOT NULL,
    "module" TEXT,
    "action" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "companyType" TEXT,
    "responsibilities" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "departmentCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skuCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "spec" TEXT,
    "unit" TEXT NOT NULL,
    "category" TEXT,
    "purchaseReferencePrice" REAL,
    "salesReferencePrice" REAL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "supplierCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "warehouseCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT,
    "locationCode" TEXT NOT NULL,
    "zone" TEXT,
    "capacity" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plateNo" TEXT NOT NULL,
    "companyId" TEXT,
    "vehicleType" TEXT,
    "driverId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "companyId" TEXT,
    "licenseNo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DemoConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scenarioName" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destinationWarehouse" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "plannedOutboundQuantity" INTEGER NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "skuId" TEXT,
    "warehouseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "skuId" TEXT,
    "skuCode" TEXT NOT NULL,
    "skuName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" REAL,
    "amount" REAL,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InventorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "warehouseId" TEXT,
    "batchId" TEXT,
    "skuId" TEXT,
    "snapshotDate" DATETIME NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "pendingInboundQuantity" INTEGER NOT NULL DEFAULT 0,
    "inStockQuantity" INTEGER NOT NULL DEFAULT 0,
    "outboundQuantity" INTEGER NOT NULL DEFAULT 0,
    "frozenQuantity" INTEGER NOT NULL DEFAULT 0,
    "dataJson" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "StocktakeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stocktakeNo" TEXT NOT NULL,
    "warehouseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "operatorId" TEXT,
    "operatorName" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StocktakeItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stocktakeOrderId" TEXT NOT NULL,
    "qrItemId" TEXT,
    "skuId" TEXT,
    "systemStatus" TEXT,
    "actualStatus" TEXT,
    "differenceType" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseNo" TEXT NOT NULL,
    "contractId" TEXT,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "companyId" TEXT,
    "skuId" TEXT,
    "skuName" TEXT NOT NULL,
    "batchId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "deliveryDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "skuId" TEXT,
    "skuCode" TEXT NOT NULL,
    "skuName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" REAL,
    "amount" REAL,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentNo" TEXT NOT NULL,
    "contractId" TEXT,
    "batchId" TEXT,
    "purchaseOrderId" TEXT,
    "shippingCompany" TEXT,
    "billOfLadingNo" TEXT,
    "containerNo" TEXT,
    "originPort" TEXT,
    "destinationPort" TEXT,
    "departureTime" DATETIME,
    "estimatedArrivalTime" DATETIME,
    "actualArrivalTime" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ShipmentNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "nodeName" TEXT NOT NULL,
    "nodeStatus" TEXT,
    "nodeTime" DATETIME,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CustomsClearance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clearanceNo" TEXT NOT NULL,
    "contractId" TEXT,
    "batchId" TEXT,
    "shipmentId" TEXT,
    "responsibleCompany" TEXT,
    "responsiblePerson" TEXT,
    "packingListDocumentId" TEXT,
    "invoiceDocumentId" TEXT,
    "billOfLadingDocumentId" TEXT,
    "certificateDocumentId" TEXT,
    "aiCheckResult" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PreReceiveOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "preReceiveNo" TEXT NOT NULL,
    "contractId" TEXT,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "expectedArrivalTime" DATETIME,
    "skuName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "suggestedLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InboundOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inboundNo" TEXT NOT NULL,
    "contractId" TEXT,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutboundOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outboundNo" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "contractId" TEXT,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesNo" TEXT NOT NULL,
    "contractId" TEXT,
    "batchId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "companyId" TEXT,
    "skuName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "deliveryMethod" TEXT,
    "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "signStatus" TEXT NOT NULL DEFAULT 'UNSIGNED',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SalesOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "salesOrderId" TEXT NOT NULL,
    "skuId" TEXT,
    "skuCode" TEXT NOT NULL,
    "skuName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" REAL,
    "amount" REAL,
    "currency" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DeliveryOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryNo" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "batchId" TEXT,
    "warehouseId" TEXT,
    "warehouseName" TEXT,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PICKUP',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DeliveryOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deliveryOrderId" TEXT NOT NULL,
    "qrItemId" TEXT,
    "skuId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Receivable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT,
    "salesOrderId" TEXT,
    "customerId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "dueDate" DATETIME,
    "receivedAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Payable" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT,
    "supplierId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "dueDate" DATETIME,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "payableType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceNo" TEXT NOT NULL,
    "contractId" TEXT,
    "invoiceType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "issueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CostItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT,
    "batchId" TEXT,
    "costType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "exchangeRate" REAL,
    "baseCurrencyAmount" REAL,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "rateDate" DATETIME NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "bankName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "settlementNo" TEXT NOT NULL,
    "contractId" TEXT,
    "companyId" TEXT,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "responsibleDepartment" TEXT,
    "responsiblePerson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "startTime" DATETIME,
    "dueTime" DATETIME,
    "contractId" TEXT,
    "batchId" TEXT,
    "documentId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "completionCondition" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalNo" TEXT NOT NULL,
    "approvalType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "applicantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "approvalId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "approverId" TEXT,
    "approverName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "username" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportType" TEXT NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "dataJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractNo" TEXT NOT NULL,
    "contractType" TEXT NOT NULL DEFAULT 'TRADE',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "supplierId" TEXT,
    "supplierName" TEXT NOT NULL,
    "companyId" TEXT,
    "productName" TEXT NOT NULL,
    "totalQuantity" INTEGER NOT NULL,
    "unit" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "destinationWarehouse" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceDocumentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "Document" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("amount", "contractNo", "createdAt", "currency", "customerName", "destinationWarehouse", "id", "productName", "sourceDocumentId", "status", "supplierName", "totalQuantity", "unit", "updatedAt")
SELECT "amount", "contractNo", "createdAt", "currency", "customerName", "destinationWarehouse", "id", "productName", "sourceDocumentId", "status", "supplierName", "totalQuantity", "unit", "updatedAt"
FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "companyId" TEXT,
    "departmentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "displayName", "id", "role", "updatedAt", "username")
SELECT "createdAt", "displayName", "id", "role", "updatedAt", "username"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Role_roleCode_key" ON "Role"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_permissionCode_key" ON "Permission"("permissionCode");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_companyCode_key" ON "Company"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "Department_departmentCode_key" ON "Department"("departmentCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_skuCode_key" ON "Sku"("skuCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_customerCode_key" ON "Customer"("customerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_supplierCode_key" ON "Supplier"("supplierCode");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_warehouseCode_key" ON "Warehouse"("warehouseCode");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseLocation_locationCode_key" ON "WarehouseLocation"("locationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNo_key" ON "Vehicle"("plateNo");

-- CreateIndex
CREATE UNIQUE INDEX "DemoConfig_scenarioName_key" ON "DemoConfig"("scenarioName");

-- CreateIndex
CREATE UNIQUE INDEX "StocktakeOrder_stocktakeNo_key" ON "StocktakeOrder"("stocktakeNo");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_purchaseNo_key" ON "PurchaseOrder"("purchaseNo");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_shipmentNo_key" ON "Shipment"("shipmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "CustomsClearance_clearanceNo_key" ON "CustomsClearance"("clearanceNo");

-- CreateIndex
CREATE UNIQUE INDEX "PreReceiveOrder_preReceiveNo_key" ON "PreReceiveOrder"("preReceiveNo");

-- CreateIndex
CREATE UNIQUE INDEX "InboundOrder_inboundNo_key" ON "InboundOrder"("inboundNo");

-- CreateIndex
CREATE UNIQUE INDEX "OutboundOrder_outboundNo_key" ON "OutboundOrder"("outboundNo");

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_salesNo_key" ON "SalesOrder"("salesNo");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryOrder_deliveryNo_key" ON "DeliveryOrder"("deliveryNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeRate_fromCurrency_toCurrency_rateDate_key" ON "ExchangeRate"("fromCurrency", "toCurrency", "rateDate");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_settlementNo_key" ON "Settlement"("settlementNo");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_workOrderNo_key" ON "WorkOrder"("workOrderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Approval_approvalNo_key" ON "Approval"("approvalNo");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalStep_approvalId_stepNo_key" ON "ApprovalStep"("approvalId", "stepNo");
