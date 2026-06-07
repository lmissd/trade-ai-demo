# 项目记忆

## 项目定位

- 当前项目定位：`国际贸易 ERP 全链路成熟演示版 Demo`
- 总原则：`核心链路真实可操作 + 外围模块虚拟展示`
- 第一版默认演示场景：
  - 中国采购 100 箱货
  - 发往赞比亚仓库
  - 上传合同和箱单
  - AI 识别信息
  - 生成人工确认后的合同和批次
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
- 阶段 3：已完成，且已提交并推送
  - Commit: `35f6952`
  - Message: `feat: 完成合同单据上传和AI模拟识别`
  - 补充设计与实现：单据删除、作废、替换与版本历史已落地
- 阶段 4：已完成，可进入下一阶段

## 当前数据库状态

本次“单据生命周期治理”补充完成后，数据库关键计数为：

- `documents = 7`
- `contracts = 2`
- `contractItems = 2`
- `batches = 2`
- `purchaseOrders = 2`
- `purchaseOrderItems = 2`
- `payments = 2`
- `receivables = 2`
- `qrItems = 0`
- `stockMovements = 0`
- `inventorySnapshots = 0`
- `aiLogs = 6`
- `auditLogs = 3`
- `demoConfigs = 1`

这说明当前系统已经进入：

- 单据草稿识别层：已完成
- 正式业务数据层：已完成第一版，且补齐了单据生命周期治理
- 二维码与库存层：尚未开始

## 阶段 3 已完成内容

阶段 3 已经实现：

- 上传文件写入 `Document`
- AI Mock 识别写入 `Document.extractedJson`
- AI 过程写入 `AiLog`
- 前端展示识别结果与人工修正
- 中文文件名乱码兼容修复
- 历史 `unit = ?` 草稿兼容修复

阶段 3 补充后，新增规则：

- 草稿单据允许删除
- 已生成正式业务数据的单据禁止删除，只能作废、替换或归档
- 删除、作废、替换都会写入 `AuditLog`
- 单据删除、作废、替换都不会反向影响库存
- 单据识别结果只是草稿，人工确认后才是正式业务依据

阶段 3 补充后，新增能力：

- `Document` 已增加生命周期字段：`status`、`isDeleted`、`deletedAt`、`deletedBy`、`voidedAt`、`voidedBy`、`voidReason`、`replacedByDocumentId`、`relatedEntityType`、`relatedEntityId`、`businessCreated`、`version`
- 已实现 `DELETE /api/documents/:id`
- 已实现 `POST /api/documents/:id/void`
- 已实现 `POST /api/documents/:id/replace`
- 已实现 `GET /api/documents/:id/history`
- 前端单据页已按状态展示删除、作废、替换与历史按钮

## 阶段 4 已完成内容

### 业务分层明确

当前系统已经明确区分两层：

1. 草稿识别层
   - `Document`
   - `Document.extractedJson`
   - `AiLog`
2. 正式业务数据层
   - `Contract`
   - `ContractItem`
   - `Batch`
   - `PurchaseOrder`
   - `PurchaseOrderItem`
   - `Payment`
   - `Receivable`

### 已实现后端接口

- `POST /api/documents/:id/confirm`
- `GET /api/contracts`
- `GET /api/contracts/:id`
- `GET /api/batches`
- `GET /api/batches/:id`

### `POST /api/documents/:id/confirm` 当前行为

用户点击“确认生成业务数据”后：

- 从 `Document.extractedJson` 草稿生成正式 `Contract`
- 生成 `ContractItem`
- 生成 `Batch`
- 生成 `PurchaseOrder`
- 生成 `PurchaseOrderItem`
- 生成 `Payment`
- 生成 `Receivable`

同时严格保持：

- 不生成二维码
- 不增加库存
- 不生成库存流水
- 不把合同数量直接当库存数量

### 幂等规则

当前 `POST /api/documents/:id/confirm` 已做幂等：

- 第一次确认：`created = true`
- 重复确认：`created = false`
- 不会重复创建合同、批次、采购草稿和应收草稿

### 前端页面现状

#### `http://127.0.0.1:5173/documents`

当前页面支持：

- 上传单据
- AI Mock 识别
- 人工修正草稿字段
- 确认生成正式业务数据
- 生成后展示正式合同 / 正式批次 / 采购草稿 / 应收草稿摘要
- 生成后锁定草稿编辑，避免草稿与正式数据不一致

#### `http://127.0.0.1:5173/contracts`

当前页面支持：

- 查看正式合同列表
- 查看合同详情
- 查看合同明细
- 查看关联合同批次
- 查看采购草稿与应收草稿
- 页面上明确提示：当前还没有库存

#### `http://127.0.0.1:5173/batches`

当前页面支持：

- 查看正式批次列表
- 查看批次详情
- 查看二维码摘要 `qrSummary`
- 查看库存流水占位
- 页面上明确提示：阶段 4 正常情况下二维码和库存都应为 0

## 阶段 4 自测结果

### 编译与类型检查

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过

### 后端接口自测

以 `Document = API.md` 这条草稿为例，已真实跑通：

1. `POST /api/documents/:id/confirm`
2. `GET /api/contracts`
3. `GET /api/contracts/:id`
4. `GET /api/batches`
5. `GET /api/batches/:id`
6. `GET /api/setup/status`

已验证结果：

- 正式合同已生成
  - `contractNo = CTR-20260607-3BP3IZ`
- 正式批次已生成
  - `batchNo = BAT-20260607-3BP3IZ`
- 采购草稿已生成
  - `purchaseNo = PO-20260607-3BP3IZ`
- Payment 已生成
- Receivable 已生成
- `qrItems = 0`
- `stockMovements = 0`
- 库存仍未生成

### 幂等自测

对同一份 `Document` 再次调用确认接口：

- 返回 `created = false`
- 没有重复生成正式业务数据

## 当前演示数据说明

当前数据库中已经保留一条正式生成样例：

- 来源单据：`API.md`
- 正式合同：`CTR-20260607-3BP3IZ`
- 正式批次：`BAT-20260607-3BP3IZ`
- 商品：`Copper Cable Demo`
- 数量：`120 箱`
- 金额：`62000 USD`

当前这条样例可用于演示：

- 草稿识别
- 人工修正
- 确认生成正式业务数据
- 查看合同数据
- 查看批次数据

但还不能用于演示库存，因为：

- 还没有生成 `QrItem`
- 还没有扫码入库
- 还没有库存流水

本次还额外留下了一组生命周期自测样例：

- `tmp-lifecycle-original.txt`：旧版本，状态已变为 `REPLACED`
- `tmp-lifecycle-replacement.txt`：新版本，状态已变为 `VOIDED`
- 历史链路已验证为 `V1:REPLACED -> V2:VOIDED`
- 草稿删除自测样例已成功删除，并且不会出现在 `GET /api/documents` 返回中

本次自测已明确验证：

- 删除草稿后，`documents` 工作台列表不再显示该单据
- 替换后，旧单据状态会变为 `REPLACED`
- 作废后，当前有效版本状态会变为 `VOIDED`
- `qrItems = 0`
- `stockMovements = 0`
- 说明删除 / 作废 / 替换没有误改库存层

## 剩余注意事项

- 工作区中仍有未跟踪目录 `pics/`
- 里面是测试素材图片，当前没有加入 Git
- 后续开发不要误删，也不要默认提交，除非用户明确要求

## 下一步应该做什么

- 当前阶段 4 已完成
- 下一个大环节应进入：
  - `阶段 5：二维码生成与二维码追溯`

阶段 5 必须继续保持：

- 二维码数量必须根据正式批次数量动态生成
- 不能把 100 个码写死在代码里
- 生成二维码后仍然不能直接增加库存
- 只有扫码入库把 `QrItem.status` 从 `PENDING_INBOUND` 变成 `IN_STOCK` 后，库存才增加
