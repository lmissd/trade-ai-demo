# 项目记忆

## 当前阶段

- 已完成阶段 0：项目初始化与规则固化。
- 已完成阶段 1：前后端基础骨架与 14 个 ERP 菜单入口。
- 当前刚完成阶段 2 升级版：
  `阶段 2：数据库与成熟 ERP Demo 数据库底座`
- 本轮仍未执行 Git 提交和 GitHub 推送，需先等用户验证。

## 本次目标

- 一次性补齐成熟 ERP Demo 后续可能用到的核心数据库底座。
- 保留扫码库存真实闭环所需核心模型。
- 将演示场景配置从纯环境变量升级为数据库 `DemoConfig` 主配置。
- 更新 `/api/setup/status`，让它能展示所有核心表的 `counts`。
- 更新 `docs/TODO.md` 与本记忆文件，明确阶段 2 已达到的程度。

## 当前数据库模型清单

| 表名 / Prisma Model | 是否已存在 | 作用 | 当前关键字段 |
|---|---|---|---|
| User | 是 | 系统用户与操作人 | username, displayName, role, status, companyId, departmentId |
| Role | 是 | 角色主数据 | roleCode, roleName, description, status |
| Permission | 是 | 权限主数据 | permissionCode, permissionName, module, action |
| UserRole | 是 | 用户与角色关联 | userId, roleId |
| RolePermission | 是 | 角色与权限关联 | roleId, permissionId |
| Company | 是 | 多公司主体 | companyCode, name, country, companyType |
| Department | 是 | 部门主数据 | companyId, departmentCode, name, type |
| Sku | 是 | 商品 SKU 主数据 | skuCode, name, spec, unit, category |
| Customer | 是 | 客户主数据 | customerCode, name, country, contactName |
| Supplier | 是 | 供应商主数据 | supplierCode, name, country, contactName |
| Warehouse | 是 | 仓库主数据 | companyId, warehouseCode, name, country, city |
| WarehouseLocation | 是 | 库位主数据 | warehouseId, locationCode, zone, capacity |
| Vehicle | 是 | 车辆主数据 | plateNo, companyId, vehicleType, driverId |
| Driver | 是 | 司机主数据 | name, phone, companyId, licenseNo |
| DemoConfig | 是 | 演示场景配置源 | scenarioName, origin, destinationWarehouse, totalQuantity, plannedOutboundQuantity |
| Document | 是 | 上传单据 | documentType, fileName, filePath, fileUrl, aiStatus |
| Contract | 是 | 合同主表 | contractNo, contractType, customerId, supplierId, amount, paymentStatus |
| ContractItem | 是 | 合同明细 | contractId, skuId, skuCode, quantity, amount |
| Batch | 是 | 货物批次档案 | batchNo, contractId, skuId, totalQuantity, warehouseId, status |
| QrItem | 是 | 单箱二维码货物 | qrCode, batchId, serialNo, status, warehouseId, locationId |
| StockMovement | 是 | 库存流水 | qrItemId, batchId, contractId, movementType, fromStatus, toStatus |
| InventorySnapshot | 是 | 库存快照 | warehouseId, batchId, skuId, snapshotDate, inStockQuantity |
| StocktakeOrder | 是 | 盘点任务单 | stocktakeNo, warehouseId, status, operatorId |
| StocktakeItem | 是 | 盘点明细 | stocktakeOrderId, qrItemId, skuId, differenceType |
| PurchaseOrder | 是 | 采购单 | purchaseNo, contractId, supplierId, skuId, quantity, status |
| PurchaseOrderItem | 是 | 采购单明细 | purchaseOrderId, skuId, skuCode, quantity, amount |
| Shipment | 是 | 国际物流主表 | shipmentNo, contractId, batchId, billOfLadingNo, containerNo, status |
| ShipmentNode | 是 | 物流节点时间轴 | shipmentId, nodeName, nodeStatus, nodeTime |
| CustomsClearance | 是 | 报关清关主表 | clearanceNo, contractId, batchId, shipmentId, status |
| PreReceiveOrder | 是 | 预收货单 | preReceiveNo, batchId, warehouseId, expectedArrivalTime, status |
| InboundOrder | 是 | 入库单 | inboundNo, batchId, warehouseId, quantity, status |
| OutboundOrder | 是 | 出库单 | outboundNo, salesOrderId, batchId, warehouseId, quantity, status |
| SalesOrder | 是 | 销售单 | salesNo, contractId, customerId, amount, deliveryStatus, signStatus |
| SalesOrderItem | 是 | 销售单明细 | salesOrderId, skuId, skuCode, quantity, amount |
| DeliveryOrder | 是 | 配送单 | deliveryNo, salesOrderId, warehouseId, vehicleId, driverId, status |
| DeliveryOrderItem | 是 | 配送明细 | deliveryOrderId, qrItemId, skuId, quantity |
| Payment | 是 | 合同回款 | contractId, customerId, receivableAmount, receivedAmount, status |
| Receivable | 是 | 应收账款 | contractId, salesOrderId, customerId, amount, dueDate, status |
| Payable | 是 | 应付账款 | contractId, supplierId, amount, dueDate, payableType, status |
| Invoice | 是 | 发票 | invoiceNo, contractId, invoiceType, amount, documentId |
| CostItem | 是 | 成本明细 | contractId, batchId, costType, amount, exchangeRate |
| ExchangeRate | 是 | 汇率 | fromCurrency, toCurrency, rate, rateDate |
| BankAccount | 是 | 银行账户 | companyId, bankName, accountName, accountNo, currency |
| Settlement | 是 | 结算单 | settlementNo, contractId, companyId, amount, status |
| WorkOrder | 是 | 自动工单 | workOrderNo, type, title, status, contractId, batchId |
| Approval | 是 | 审批单 | approvalNo, approvalType, entityType, entityId, status |
| ApprovalStep | 是 | 审批步骤 | approvalId, stepNo, approverId, status |
| Notification | 是 | 通知提醒 | userId, title, type, status, relatedEntityType |
| AuditLog | 是 | 操作审计 | userId, username, action, entityType, beforeJson, afterJson |
| AiLog | 是 | AI 调用记录 | taskType, scenario, provider, inputText, outputText, parsedJson |
| ReportSnapshot | 是 | 报表快照 | reportType, snapshotDate, dataJson |

补充：

- 本地迁移执行记录表 `_demo_migrations` 仍然保留，用于自定义 SQL migration 执行器。
- 当前数据库已从原先 8 张核心业务表，扩展为 51 个 Prisma model + 1 张本地迁移记录表。

## 核心真实闭环表

以下表直接服务于 Demo 1.0 的真实闭环：

- `DemoConfig`
- `User`
- `Document`
- `Contract`
- `ContractItem`
- `Batch`
- `QrItem`
- `StockMovement`
- `InventorySnapshot`
- `Payment`
- `Warehouse`
- `WarehouseLocation`
- `AiLog`

## 外围成熟展示模块表

以下表主要服务于 Demo 1.5 的成熟 ERP 形态展示：

- `PurchaseOrder`
- `PurchaseOrderItem`
- `Shipment`
- `ShipmentNode`
- `CustomsClearance`
- `PreReceiveOrder`
- `InboundOrder`
- `OutboundOrder`
- `SalesOrder`
- `SalesOrderItem`
- `DeliveryOrder`
- `DeliveryOrderItem`
- `Receivable`
- `Payable`
- `Invoice`
- `CostItem`
- `ExchangeRate`
- `WorkOrder`
- `ReportSnapshot`

## 企业级扩展预留表

以下表已提前预留，当前阶段可先存在、可先为 0 条数据：

- `Role`
- `Permission`
- `UserRole`
- `RolePermission`
- `Company`
- `Department`
- `Vehicle`
- `Driver`
- `StocktakeOrder`
- `StocktakeItem`
- `BankAccount`
- `Settlement`
- `Approval`
- `ApprovalStep`
- `Notification`
- `AuditLog`

## 当前健康检查接口统计范围

当前 `GET /api/setup/status` 已统计以下模型数量：

- `users`
- `roles`
- `permissions`
- `userRoles`
- `rolePermissions`
- `companies`
- `departments`
- `skus`
- `customers`
- `suppliers`
- `warehouses`
- `warehouseLocations`
- `vehicles`
- `drivers`
- `documents`
- `contracts`
- `contractItems`
- `batches`
- `qrItems`
- `stockMovements`
- `inventorySnapshots`
- `stocktakeOrders`
- `stocktakeItems`
- `purchaseOrders`
- `purchaseOrderItems`
- `shipments`
- `shipmentNodes`
- `customsClearances`
- `preReceiveOrders`
- `inboundOrders`
- `outboundOrders`
- `salesOrders`
- `salesOrderItems`
- `deliveryOrders`
- `deliveryOrderItems`
- `payments`
- `receivables`
- `payables`
- `invoices`
- `costItems`
- `exchangeRates`
- `bankAccounts`
- `settlements`
- `workOrders`
- `approvals`
- `approvalSteps`
- `notifications`
- `auditLogs`
- `aiLogs`
- `reportSnapshots`
- `demoConfigs`

## 当前 seed 已创建的演示数据

- 默认用户：`demo-owner`
- 默认角色：`OWNER` `ADMIN` `WAREHOUSE` `FINANCE`
- 默认用户角色关联：`demo-owner -> OWNER`
- 公司主体 5 条：
  - 境内公司
  - 香港公司
  - 新加坡公司
  - 赞比亚公司
  - 刚果金公司
- 部门 6 条：
  - 采购部
  - 物流部
  - 清关部
  - 仓库部
  - 销售部
  - 财务部
- 示例 SKU 1 条：`SKU-DEMO-001`
- 示例客户 1 条：`ABC Trading Zambia`
- 示例供应商 1 条：`China Supplier Co., Ltd.`
- 示例仓库 1 条：`Zambia Warehouse`
- 示例库位 1 条：`A-01-01`
- 默认演示场景配置 1 条：
  - 起点：`China`
  - 目的仓：`Zambia Warehouse`
  - 商品：`Demo Goods`
  - 数量：`100 箱`
  - 计划出库：`20 箱`
  - 金额：`50000 USD`

## 本轮自测结果

- `npm run prisma:generate --workspace @trade-ai-demo/server`：通过
- `npm run prisma:migrate --workspace @trade-ai-demo/server`：通过
- `npm run prisma:seed --workspace @trade-ai-demo/server`：通过
- `npm run build --workspace @trade-ai-demo/server`：通过
- 临时启动后端并请求 `http://127.0.0.1:3001/api/setup/status`：通过
- 当前返回结果验证通过：
  - `users = 1`
  - `roles = 4`
  - `companies = 5`
  - `departments = 6`
  - `skus = 1`
  - `customers = 1`
  - `suppliers = 1`
  - `warehouses = 1`
  - `warehouseLocations = 1`
  - `demoConfigs = 1`
  - 其余外围业务表当前为 `0`，符合“先建底座、后接业务流程”的阶段目标

## 当前规则状态

- 每次只做 `docs/TODO.md` 中的一个大环节。
- 完成后先自测，再更新记忆与 TODO。
- 完成后先等待用户验证，不立即提交 Git。
- 只有用户确认满意后，才执行 `git add`、`git commit`、`git push`。
- AI 不直接写数据库，所有后续业务写入必须经过后端接口与用户确认。

## 下一步应该做什么

- 当前阶段 2 升级版已经完成并通过自测。
- 下一步应在你验证通过后，进入 `阶段 3：合同 / 箱单上传与 AI Mock 识别`。
- 在你确认前，不进入下一阶段，也不执行 Git 提交与推送。
