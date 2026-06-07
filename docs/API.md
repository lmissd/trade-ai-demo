# API 规划（第一版）

本文档用于记录第一版 Demo 计划中的接口草案。当前阶段只固化接口范围，不实现业务逻辑。

## 设计原则

- AI 不能直接写数据库。
- 所有写入必须经过后端接口和用户确认。
- 默认演示值可以来自配置，但接口不能把 `100 / 20 / 80 / Zambia Warehouse` 写死在业务逻辑里。
- 库存相关返回值必须来自真实二维码状态统计。

## 单据接口

### `POST /api/documents/upload`

- 用途：上传合同、箱单等单据。

### `GET /api/documents`

- 用途：查询已上传单据列表。

### `POST /api/documents/:id/extract`

- 用途：触发 AI 或 mock 识别。
- 说明：第一版允许返回默认 mock 数据，但默认值应来自统一的演示场景配置。

### `POST /api/documents/:id/confirm`

- 用途：用户确认识别结果后生成合同与批次草稿。
- 说明：应接收用户确认后的商品、客户、供应商、仓库、数量、单位、金额、币种等字段。

## 合同接口

### `GET /api/contracts`

- 用途：查询合同列表。

### `POST /api/contracts`

- 用途：新建合同。

### `GET /api/contracts/:id`

- 用途：查询合同详情。

### `PATCH /api/contracts/:id`

- 用途：更新合同信息。

## 批次接口

### `GET /api/batches`

- 用途：查询批次列表。

### `POST /api/batches`

- 用途：新建批次。

### `GET /api/batches/:id`

- 用途：查询批次详情。

### `POST /api/batches/:id/generate-qr`

- 用途：按批次数量生成二维码货物。
- 说明：二维码数量必须等于当前批次确认后的数量。

## 二维码接口

### `GET /api/qr-items`

- 用途：查询二维码列表。

### `GET /api/qr-items/:qrCode`

- 用途：查询单个二维码货物详情。

### `GET /api/qr-items/:qrCode/image`

- 用途：返回二维码图片。

## 扫码接口

### `POST /api/scan/inbound`

- 用途：扫码入库。

请求示例：

```json
{
  "qrCode": "QR202606070001",
  "operatorName": "demo-user",
  "warehouse": "Zambia Warehouse"
}
```

### `POST /api/scan/outbound`

- 用途：扫码出库。

请求示例：

```json
{
  "qrCode": "QR202606070001",
  "operatorName": "demo-user",
  "warehouse": "Zambia Warehouse"
}
```

### `GET /api/stock-movements`

- 用途：查询库存流水。

## 库存接口

### `GET /api/inventory/summary`

- 用途：查询库存总览。

### `GET /api/inventory/by-batch/:batchId`

- 用途：按批次查询库存。

### `GET /api/inventory/by-contract/:contractId`

- 用途：按合同查询库存。

## 回款接口

### `GET /api/payments`

- 用途：查询回款记录。

### `POST /api/payments`

- 用途：新建回款记录。

### `PATCH /api/payments/:id`

- 用途：更新回款状态。

## AI 问答接口

### `POST /api/ai/ask`

- 用途：根据真实库存、合同、回款数据生成问答结果。
- 说明：AI 回答必须基于后端受控查询结果，不能直接访问数据库，也不能把“剩余 80 箱”写死。
