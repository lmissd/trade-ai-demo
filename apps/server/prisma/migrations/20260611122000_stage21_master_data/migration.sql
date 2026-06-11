ALTER TABLE "Sku" ADD COLUMN "modelNo" TEXT;
ALTER TABLE "Sku" ADD COLUMN "material" TEXT;
ALTER TABLE "Sku" ADD COLUMN "referenceCurrency" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "Customer" ADD COLUMN "taxNo" TEXT;
ALTER TABLE "Customer" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "Customer" ADD COLUMN "bankAddress" TEXT;
ALTER TABLE "Customer" ADD COLUMN "cooperationCompanyId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "cooperationCompanyName" TEXT;
ALTER TABLE "Customer" ADD COLUMN "customerType" TEXT NOT NULL DEFAULT 'CUSTOMER';

ALTER TABLE "Supplier" ADD COLUMN "taxNo" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "bankAccountNo" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "bankAddress" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "cooperationCompanyId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "cooperationCompanyName" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "supplierType" TEXT NOT NULL DEFAULT 'SUPPLIER';

ALTER TABLE "User" ADD COLUMN "employeeNo" TEXT;
ALTER TABLE "User" ADD COLUMN "position" TEXT;
ALTER TABLE "User" ADD COLUMN "workCountry" TEXT;
ALTER TABLE "User" ADD COLUMN "responsibilityScope" TEXT;

ALTER TABLE "Vehicle" ADD COLUMN "vehicleCode" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "vehicleQrCode" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "driverName" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "ownershipCompanyId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "maintenanceNote" TEXT;

ALTER TABLE "Driver" ADD COLUMN "driverCode" TEXT;
ALTER TABLE "Driver" ADD COLUMN "employeeNo" TEXT;
ALTER TABLE "Driver" ADD COLUMN "workCountry" TEXT;
ALTER TABLE "Driver" ADD COLUMN "rewardPenaltyNotes" TEXT;

CREATE UNIQUE INDEX "User_employeeNo_key" ON "User"("employeeNo") WHERE "employeeNo" IS NOT NULL;
CREATE UNIQUE INDEX "Vehicle_vehicleCode_key" ON "Vehicle"("vehicleCode") WHERE "vehicleCode" IS NOT NULL;
CREATE UNIQUE INDEX "Vehicle_vehicleQrCode_key" ON "Vehicle"("vehicleQrCode") WHERE "vehicleQrCode" IS NOT NULL;
CREATE UNIQUE INDEX "Driver_driverCode_key" ON "Driver"("driverCode") WHERE "driverCode" IS NOT NULL;
CREATE UNIQUE INDEX "Driver_employeeNo_key" ON "Driver"("employeeNo") WHERE "employeeNo" IS NOT NULL;
