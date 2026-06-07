# API 规划（第一版）

本文档记录当前已经实现和后续规划中的接口范围。

## 设计原则

- AI 不能直接写数据库。
- 所有写入必须经过后端接口和用户确认。
- 默认演示值可以来自配置或 `DemoConfig`，但业务逻辑不能把 `100 / 20 / 80 / Zambia Warehouse` 写死。
- 库存相关统计最终必须来自真实二维码状态。

## 已实现接口

### `GET /api/health`

- 用途：检查后端服务是否正常运行。

### `GET /api/setup/status`

- 用途：检查数据库连通、核心表数量、默认 demo 用户和当前演示场景配置。

### `GET /api/documents`

- 用途：查询已上传单据列表。
- 当前返回：
  - 原始文件信息
  - 生命周期状态 `status`
  - AI 识别状态
  - 草稿字段
  - 是否已生成业务数据 `businessCreated`
  - 替换关系与版本号
  - 是否已生成正式合同 / 批次
 - 当前默认不返回已删除单据

### `POST /api/documents/upload`

- 用途：上传合同、箱单、提单、发票等单据。
- 表单字段：
  - `documentType`
  - `file`
- 说明：
  - 先写入 `Document`
  - 保存原文件路径与元数据
  - 中文文件名会做兼容解码

### `POST /api/documents/:id/extract`

- 用途：触发 AI Mock 识别。
- 说明：
  - 第一版识别结果来自后端 `DemoConfig`
  - 写入 `Document.extractedJson`
  - 写入 `AiLog`

### `PATCH /api/documents/:id/extracted-fields`

- 用途：保存人工修正后的识别字段。
- 支持字段：
  - `contractNoDraft`
  - `batchNoDraft`
  - `productName`
  - `customerName`
  - `supplierName`
  - `destinationWarehouse`
  - `totalQuantity`
  - `unit`
  - `amount`
  - `currency`
- 说明：
  - 当前仍然只是在修正草稿数据
  - 还不会生成正式业务数据

### `DELETE /api/documents/:id`

- 用途：删除未生成业务数据的草稿单据。
- 关键规则：
  - 只允许删除 `businessCreated = false` 的单据
  - 删除采用软删除，工作台不再显示
  - 会写入 `AuditLog`
  - 不影响任何库存数据
  - 如果单据已生成业务数据，会拒绝并提示“该单据已生成业务数据，不能删除，只能作废”

### `POST /api/documents/:id/void`

- 用途：作废已生成业务数据的单据。
- 请求体：
  - `reason`
- 关键规则：
  - 必须填写作废原因
  - 不删除原文件
  - 不删除合同、批次、采购或应收数据
  - 只更新 `Document.status = VOIDED`
  - 会写入 `AuditLog`
  - 不影响库存

### `POST /api/documents/:id/replace`

- 用途：上传同一业务单据的新版本。
- 表单字段：
  - `file`
- 关键规则：
  - 旧单据状态更新为 `REPLACED`
  - 新单据成为当前有效版本
  - 保留正式业务数据，不删除合同与批次
  - 会写入 `AuditLog`

### `GET /api/documents/:id/history`

- 用途：查询同一单据链路下的版本历史。
- 当前返回：
  - 版本号
  - 生命周期状态
  - 原文件信息
  - 业务状态
  - 作废原因（若有）

### `POST /api/documents/:id/confirm`

- 用途：用户确认识别草稿后，正式生成业务数据。
- 当前正式生成：
  - `Contract`
  - `ContractItem`
  - `Batch`
  - `PurchaseOrder`
  - `PurchaseOrderItem`
  - `Payment`
  - `Receivable`
  - 同时回写 `Document.businessCreated = true`
- 关键规则：
  - 幂等：重复点击不会重复生成
  - 冲突校验：若合同号或批次号已被其他单据占用，会返回冲突错误
  - 不生成库存
  - 不生成二维码
  - 只生成正式业务主数据

### `GET /api/contracts`

- 用途：查询正式合同列表。
- 当前返回：
  - 合同基础信息
  - 关联批次摘要
  - Payment 摘要
  - Receivable 摘要
  - 来源单据

### `GET /api/contracts/:id`

- 用途：查询合同详情。
- 当前返回：
  - 合同主信息
  - 合同明细 `ContractItem`
  - 关联批次
  - 采购草稿
  - Payment
  - Receivable
  - 来源单据

### `GET /api/batches`

- 用途：查询正式批次列表。
- 当前返回：
  - 批次主信息
  - 关联合同信息
  - 来源单据
  - 二维码摘要 `qrSummary`
- 当前阶段正常表现：
  - `qrSummary.total = 0`
  - `qrSummary.inStock = 0`

### `GET /api/batches/:id`

- 用途：查询批次详情。
- 当前返回：
  - 批次主信息
  - 关联合同
  - 来源单据
  - 二维码明细
  - 库存流水
  - `qrSummary`

## 阶段 5 计划接口

### `POST /api/batches/:id/generate-qr`

- 用途：按批次数量生成 `QrItem`。

### `GET /api/qr-items`

- 用途：查询二维码列表。

### `GET /api/qr-items/:qrCode`

- 用途：查询单个二维码详情。

### `GET /api/qr-items/:qrCode/image`

- 用途：返回二维码图片。

## 阶段 6-8 计划接口

### `POST /api/scan/inbound`

- 用途：扫码入库。

### `POST /api/scan/outbound`

- 用途：扫码出库。

### `GET /api/stock-movements`

- 用途：查询库存流水。

### `GET /api/inventory/summary`

- 用途：查询库存总览。

### `GET /api/inventory/by-batch/:batchId`

- 用途：按批次查询库存。

### `GET /api/inventory/by-contract/:contractId`

- 用途：按合同查询库存。

## 阶段 9 计划接口

### `POST /api/ai/ask`

- 用途：基于真实库存、合同、回款等受控查询结果生成 AI 问答。
- 说明：
  - AI 不直接访问数据库
  - 只基于后端受控查询结果组织自然语言回答
