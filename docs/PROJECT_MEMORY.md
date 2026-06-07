# 项目记忆

## 项目定位

- 当前项目定位：`国际贸易 ERP 全链路成熟演示版 Demo`
- 总原则：`核心链路真实可操作 + 外围模块虚拟展示`
- 第一版默认演示场景仍然是：
  - 中国采购 100 箱货
  - 发往赞比亚仓库
  - 上传合同和箱单
  - AI 识别信息
  - 生成合同和批次
  - 生成二维码
  - 扫码入库
  - 销售出库
  - 库存实时变化
  - AI 回答真实库存

## 当前规则

- 每次开始工作前必须先读取：
  - `docs/PROJECT_DESIGN.md`
  - `docs/TODO.md`
  - `docs/PROJECT_MEMORY.md`
- 每次只允许做 `docs/TODO.md` 中的一个大环节
- 完成后先自测，再更新记忆和 TODO
- 完成后先等用户验证，不立即提交 Git
- 只有用户确认满意后，才执行 `git add`、`git commit`、`git push`
- AI 不能直接写数据库业务结果，所有业务写入都必须经过后端接口和用户确认

## 阶段状态

- 阶段 0：已完成
- 阶段 1：已完成
- 阶段 2：已完成，且已提交并推送
  - Commit: `58787fa`
  - Message: `feat: 升级阶段2数据库为成熟ERP Demo数据库底座`
- 阶段 3：已实现并补充修复验收问题，当前仍在等待用户验证
  - 还没有提交 Git
  - 还没有 push

## 当前数据库与模型状态

当前数据库已经具备演示版底座，核心模型和外围展示模型都已落地。

核心真实闭环相关模型包括：

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

成熟 ERP 展示相关模型包括：

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

当前关键计数（2026-06-07 最新自测后）：

- `documents = 3`
- `contracts = 0`
- `batches = 0`
- `qrItems = 0`
- `stockMovements = 0`
- `payments = 0`
- `receivables = 0`
- `aiLogs = 3`
- `demoConfigs = 1`

这也再次说明：

- 目前阶段 3 还只是“单据草稿识别层”
- 还没有创建正式 `Contract` / `Batch`
- 也还没有任何库存数据

## 阶段 3 已实现内容

### 后端接口

- `GET /api/documents`
- `POST /api/documents/upload`
- `POST /api/documents/:id/extract`
- `PATCH /api/documents/:id/extracted-fields`

### 阶段 3 的业务分层

当前已经明确保持以下链路：

1. 上传文件后先写入 `Document`
2. AI 识别结果写入 `Document.extractedJson`
3. AI 调用日志写入 `AiLog`
4. 前端展示识别结果并允许人工修正
5. 当前阶段还没有生成正式业务数据

当前还没有做的内容：

- 还没有“确认生成业务数据”按钮
- 还没有创建 `Contract`
- 还没有创建 `ContractItem`
- 还没有创建 `Batch`
- 还没有创建 `PurchaseOrder`
- 还没有创建 `Payment / Receivable`

这部分应在下一阶段实现。

### 前端页面

- `http://127.0.0.1:5173/documents`

当前页面已经支持：

- 选择单据类型
- 上传合同 / 箱单 / 提单 / 发票 / 其他
- 查看单据列表
- 执行 AI Mock 识别
- 查看识别结果
- 手工修正字段
- 保存修正结果
- 打开原始文件

## 2026-06-07 阶段 3 验收补充修复

本轮修复了两个阶段 3 验收问题：

1. 中文文件名乱码
2. 历史草稿中的 `unit = ?`

### 本轮代码修复点

- 后端上传时对 `Document.originalName` 做中文文件名解码，避免新上传中文文件名变成乱码
- 后端 `GET /api/documents` 对历史乱码文件名做兼容返回，保证旧记录页面也能正常显示
- 后端对历史草稿里 `extractedJson.unit = "?"` 的情况做兼容修正，返回时统一显示为 `DemoConfig.unit`
- 后端人工修正保存时，如果用户提交 `unit = "?"`，不会再把问号保存成正式草稿字段
- AI 日志中的识别说明文本也改为记录正常文件名

### 本轮自测结果

- `GET http://127.0.0.1:3001/api/documents`：通过
  - 中文文件名记录现在正常返回 `测试单据.png`
  - 历史 `API.md` 草稿中的 `unit` 现在正常返回 `箱`
- 临时上传 `tmp-测试上传.md` 并执行识别：通过
  - `upload.originalName = tmp-测试上传.md`
  - `extract.originalName = tmp-测试上传.md`
  - `extract.extractedJson.unit = 箱`
- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过

### 当前一个已知说明

- `npm run build --workspace @trade-ai-demo/server` 本轮没有跑通
- 原因不是本次代码报错，而是运行中的开发服务占用了 Prisma 的 Windows DLL，导致 `prisma generate` 触发 `EPERM rename`
- 在停止开发服务后，这个构建问题应可恢复到此前状态

## 演示数据说明

当前数据库中已有 3 条 `Document`：

- 1 条早期自测 `API.md`
- 1 条用户上传的中文文件名图片单据
- 1 条本轮用于验证中文文件名上传修复的临时记录

这些记录目前都仍然属于：

- 单据原文件记录
- AI 草稿识别结果

它们都还不是正式合同、批次、采购单或库存记录。

## 下一步应该做什么

- 当前仍停留在阶段 3，等待用户继续验证
- 用户确认阶段 3 满意后，才允许提交 Git
- 用户确认后，下一个大环节应进入：
  - `阶段 4：合同与批次生成`

阶段 4 必须严格实现：

- “确认生成业务数据”按钮
- 从 `Document.extractedJson` 草稿生成正式 `Contract`
- 生成 `ContractItem`
- 生成 `Batch`
- 生成 `PurchaseOrder`
- 生成 `Payment / Receivable` 草稿
- 但此时仍然不能增加库存

库存规则必须继续保持：

- 库存不能由合同数量直接得出
- 只有 `QrItem` 生成后，且扫码入库把状态从 `pending_inbound` 变为 `in_stock`，库存才增加
- 只有扫码出库把状态从 `in_stock` 变为 `outbound`，库存才减少
- 最终库存统计必须基于 `QrItem.status` 和 `StockMovement`
