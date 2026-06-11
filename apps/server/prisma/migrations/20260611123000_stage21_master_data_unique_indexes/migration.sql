DROP INDEX IF EXISTS "User_employeeNo_key";
DROP INDEX IF EXISTS "Vehicle_vehicleCode_key";
DROP INDEX IF EXISTS "Vehicle_vehicleQrCode_key";
DROP INDEX IF EXISTS "Driver_driverCode_key";
DROP INDEX IF EXISTS "Driver_employeeNo_key";

CREATE UNIQUE INDEX "User_employeeNo_key" ON "User"("employeeNo");
CREATE UNIQUE INDEX "Vehicle_vehicleCode_key" ON "Vehicle"("vehicleCode");
CREATE UNIQUE INDEX "Vehicle_vehicleQrCode_key" ON "Vehicle"("vehicleQrCode");
CREATE UNIQUE INDEX "Driver_driverCode_key" ON "Driver"("driverCode");
CREATE UNIQUE INDEX "Driver_employeeNo_key" ON "Driver"("employeeNo");
