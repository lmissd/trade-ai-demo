# API 规划（第一版）

本文档记录当前已经实现和后续计划中的接口范围。

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

### `POST /api/documents/upload`

- 用途：上传合同、箱单、提单、发票等单据。
- 表单字段：
  - `documentType`
  - `file`

### `POST /api/documents/:id/extract`

- 用途：触发 AI Mock 识别。
- 说明：第一版识别结果来自后端 `DemoConfig`，并写入 `Document.extractedJson` 与 `AiLog`。

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

## 阶段 4 计划接口

### `POST /api/documents/:id/confirm`

- 用途：用户确认识别结果后，生成合同与批次。

### `GET /api/contracts`

- 用途：查询合同列表。

### `POST /api/contracts`

- 用途：新建合同。

### `GET /api/contracts/:id`

- 用途：查询合同详情。

### `PATCH /api/contracts/:id`

- 用途：更新合同信息。

### `GET /api/batches`

- 用途：查询批次列表。

### `POST /api/batches`

- 用途：新建批次。

### `GET /api/batches/:id`

- 用途：查询批次详情。

## 阶段 5 计划接口

### `POST /api/batches/:id/generate-qr`

- 用途：按批次数量生成二维码货物。

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

- 用途：根据真实库存、合同、回款等受控查询结果生成 AI 问答。
- 说明：AI 不直接访问数据库，只基于后端受控查询结果组织自然语言回答。
