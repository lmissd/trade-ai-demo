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

## 长期升级地基记忆

已阅读并吸收：

- `docs/ERP_upgrade_foundation_memory.md`

这份记忆的作用不是让当前 Demo 立即重构成完整 ERP，而是要求后续所有 Demo 开发都尽量保留未来升级地基。

当前统一结论：

- 当前主线仍然是 `Demo 开发`
- 仍然严格按 `docs/TODO.md` 的大环节顺序推进
- 不因为长期升级目标而中断当前 Demo 节奏
- 但后续新增代码、接口、表字段、状态流转时，要尽量遵守成熟 ERP 的基础原则

后续开发需要长期保留的基础原则：

- 功能可以先简单，但数据结构、状态流转、权限边界、操作日志、业务追溯不能随意
- 必须继续保持 `原始单据`、`AI 识别草稿`、`人工确认后的正式业务数据` 三层分离
- 所有正式业务生成动作仍然必须经过人工确认
- 核心业务状态必须由后端控制，前端只能发起动作，不能直接决定最终状态
- 核心业务表后续应持续补齐审计字段、软删除字段、来源追溯字段、状态字段
- 核心操作必须考虑幂等、防重复提交、事务一致性、多人并发
- 文件仍然只存路径和元数据，不把附件本体塞进数据库
- 列表接口后续要持续朝 `分页 / 筛选 / 排序 / 关键词搜索 / 时间范围过滤` 预留
- 关键操作必须持续补齐操作日志与审计日志
- 数据库当前仍可继续用 SQLite 做 Demo，但长期升级优先目标是 `PostgreSQL`

需要特别记住的“当前项目优先规则”：

- `ERP_upgrade_foundation_memory.md` 中有一些是通用 ERP 原则
- 如果它与当前项目已经确认过的更具体规则冲突，以当前项目已确认规则为准
- 当前二维码规则仍然是：
  - 一箱货只贴一个货物身份二维码
  - 不拆分“入库二维码”和“出库二维码”
  - 入库还是出库由当前页面、当前任务、当前工单上下文决定

手机扫码端的未来升级方向也已记录：

- 未来可以拆分出独立手机 H5 扫码端
- 未来手机端可以部署到静态网站托管
- 但静态前端不能直接写数据库
- 手机端必须继续通过后端 API 写入现有业务数据
- 如果未来做公网手机扫码，必须解决：
  - 公网可访问后端
  - HTTPS
  - CORS
  - 与当前 ERP 网页共用同一套业务数据

## 本次新增设计记忆

本次针对后续“仓储扫码入库 / 扫码出库”阶段，新增并锁定以下防呆原则：

- 每一箱货物只允许贴一个唯一货物二维码
- 不再拆分“入库二维码”和“出库二维码”
- 货物二维码只代表货物身份
- 当前扫描到底是入库还是出库，必须由当前页面、当前任务、当前工单、当前单据上下文决定
- 扫码命中后不能直接写数据库，必须先校验，再展示确认信息，再由用户确认执行
- 入库成功后才允许把 `QrItem.status` 从 `PENDING_INBOUND` 改为 `IN_STOCK`
- 出库成功后才允许把 `QrItem.status` 从 `IN_STOCK` 改为 `OUTBOUND`
- 每次成功入库或出库都必须写入 `StockMovement`
- 重复扫码、跨批次扫码、跨任务扫码、错误状态扫码都必须被拒绝并给出明确提示
- 前端扫码页必须显式展示操作类型、任务号、合同号、批次号、仓库、应扫数量、已扫数量、剩余数量、最近扫码记录、异常扫码记录

本次决策还明确：

- 这是当时在扫码阶段开始前做的规则固化决策
- 当时只更新了设计方案、TODO 和项目记忆
- 当时没有提前开发阶段 6 / 阶段 7 的业务代码，避免违反“一次只做一个大环节”的规则

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
- 阶段 5：已完成，本次已与阶段 6/7 一起提交并推送
- 阶段 6：已完成，本次已提交并推送
- 阶段 7：已完成，本次已提交并推送

## 当前数据库状态

当前最新数据库关键计数为：

- `documents = 7`
- `contracts = 2`
- `contractItems = 2`
- `batches = 2`
- `purchaseOrders = 2`
- `purchaseOrderItems = 2`
- `payments = 2`
- `receivables = 2`
- `qrItems = 120`
- `stockMovements = 7`
- `preReceiveOrders = 1`
- `inboundOrders = 1`
- `outboundOrders = 1`
- `salesOrders = 1`
- `inventorySnapshots = 0`
- `aiLogs = 6`
- `auditLogs = 4`
- `demoConfigs = 1`

这说明当前系统已经进入：

- 单据草稿识别层：已完成
- 正式业务数据层：已完成第一版，且补齐了单据生命周期治理
- 二维码与库存层：已进入真实二维码与扫码阶段
- 二维码生成与追溯层：第一版已完成
- 扫码入库、扫码出库层：已完成第一版
- 库存真实统计层：下一步进入阶段 8

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

本次阶段 5 完成后，演示数据已更新为：

- `BAT-20260607-3BP3IZ` 已生成 `120` 个真实 `QrItem`
- 这 `120` 个二维码当前全部为 `PENDING_INBOUND`
- 已可通过后端生成并访问真实二维码 SVG 图片
- 仍然没有任何 `StockMovement`
- 仍然没有任何库存增加

本次阶段 6 / 阶段 7 完成并经过最新自测后，演示数据进一步变为：

- `BAT-20260607-3BP3IZ-0001` 已真实完成一次入库再出库链路
- 为了验证 Demo 批量辅助能力，又额外执行了 5 个二维码入库
- 当前二维码状态汇总为：
  - `PENDING_INBOUND = 114`
  - `IN_STOCK = 5`
  - `OUTBOUND = 1`
- 当前库存流水汇总为：
  - `INBOUND = 6`
  - `OUTBOUND = 1`
- 批次状态当前为 `PARTIAL_OUTBOUND`
- 当前出库任务应扫数量仍然受 `DemoConfig.plannedOutboundQuantity` 约束，默认值是 `20`

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

## 最近一次界面修复

- 已修复 `http://127.0.0.1:5173/documents` 中“删除单据”按钮点击无反应的问题。
- 修复方式：
  - 把删除确认从静态 `Modal.confirm` 改为与作废/替换一致的受控 `Modal`
  - 给单据列表表格中的操作按钮统一增加 `event.stopPropagation()`，避免被整行点击选中逻辑打断
- 本次未改动单据删除业务规则：
  - 仍然只允许删除 `businessCreated = false` 的草稿单据
  - 已生成正式业务数据的单据仍然只能作废或替换
  - 删除仍然通过后端 `DELETE /api/documents/:id` 完成，并写入 `AuditLog`
- 本次自测结果：
  - `npm run build --workspace @trade-ai-demo/web` 通过
  - 当前接口仍能查到可删除草稿单据，说明前端删除按钮修复后具备真实可验证对象
- 未直接删除现有草稿测试数据，避免误删用户当前演示数据

## 阶段 5 已完成内容

阶段 5 已经实现：

- 新增真实二维码生成接口 `POST /api/qr-items/generate`
- 新增二维码列表接口 `GET /api/qr-items`
- 新增二维码详情接口 `GET /api/qr-items/:id`
- 后端真实生成二维码 SVG 文件并通过 `/uploads/qr-codes` 提供访问
- 前端“二维码追溯”页面已从占位骨架升级为真实工作台
- 前端支持：
  - 选择批次
  - 按状态筛选
  - 按二维码编号 / 批次号 / 合同号搜索
  - 查看二维码列表
  - 查看二维码详情
  - 查看二维码图片
  - 查看生命周期流水占位
- “批次数据”页面已增加：
  - 生成本批次二维码
  - 查看二维码追溯

阶段 5 严格保持的规则：

- 二维码数量根据正式批次 `totalQuantity` 动态生成
- 没有把 “100 个二维码” 写死在代码里
- 生成二维码不会增加库存
- `QrItem.status` 默认是 `PENDING_INBOUND`
- 只有阶段 6 扫码入库把状态改为 `IN_STOCK` 后，库存才允许增加

阶段 5 自测结果：

- `POST /api/qr-items/generate`：已对 `BAT-20260607-3BP3IZ` 成功生成 `120` 个二维码
- `GET /api/qr-items?batchId=cmq3zx1a30004urgw302sg8j3`：返回 `120` 条记录
- `GET /api/qr-items/:id`：可返回单个二维码详情
- `GET /uploads/qr-codes/BAT-20260607-3BP3IZ-0001.svg`：返回 `200`，且内容为真实 SVG
- `GET /api/batches/:id`：二维码摘要已更新为 `total = 120 / pendingInbound = 120 / inStock = 0 / outbound = 0`
- `npm run build --workspace @trade-ai-demo/web`：通过
- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过

阶段 5 当前已知说明：

- Windows 本地运行中，`npm run build --workspace @trade-ai-demo/server` 的 Prisma generate 会因为 `query_engine-windows.dll.node` 被现有进程占用而报 `EPERM`
- 这不是 TypeScript 代码错误；在当前服务已运行的前提下，后端接口实际自测已通过

## 阶段 6 / 阶段 7 已完成内容

本次已经把“仓储扫码入库 / 扫码出库”从占位骨架升级为真实工作台。

### 已实现后端接口

- `POST /api/warehouse/scan/context`
- `POST /api/warehouse/scan/preview`
- `POST /api/warehouse/scan/confirm`
- `POST /api/warehouse/scan/bulk`

### 已实现后端规则

- 自动生成并绑定当前演示批次的：
  - `PreReceiveOrder`
  - `InboundOrder`
  - `SalesOrder`
  - `OutboundOrder`
- 货物二维码继续保持“一箱一个身份码”，不拆分入库码和出库码
- 入库和出库动作由当前任务上下文决定，而不是由二维码本身决定
- 扫码后不直接写库，必须先经过预检，再人工确认
- 入库只允许 `PENDING_INBOUND`
- 出库只允许 `IN_STOCK`
- 已实现以下拦截提示：
  - 二维码不存在
  - 未入库不能出库
  - 已入库不能重复入库
  - 已出库不能重复出库
  - 冻结不能出库
  - 异常状态不能出库
  - 非当前批次 / 非当前任务不能执行
- 每次成功入库或出库都强制生成 `StockMovement`
- 已额外限制：出库数量不能超过当前出库任务的应扫数量

### 已实现前端页面

当前入口：

- `http://127.0.0.1:5173/warehouse`

当前页面已支持：

- 入库 / 出库模式切换
- 当前任务上下文展示
- 当前批次、合同、仓库、库位展示
- 应扫数量、已扫数量、剩余数量展示
- 最近扫码记录
- 异常扫码记录
- 手工输入二维码预检
- 人工确认入库 / 出库
- Demo 批量处理按钮
- 手机摄像头扫码

### 当前真实链路说明

当前已经验证：

1. 未入库二维码先去出库，会被拒绝
2. 入库预检通过后，人工确认才会把 `QrItem.status` 改成 `IN_STOCK`
3. 同一二维码重复入库会被拒绝
4. 入库后的二维码可以正常预检出库
5. 出库确认后，`QrItem.status` 会改成 `OUTBOUND`
6. 同一二维码重复出库会被拒绝
7. 每次成功动作都会新增一条 `StockMovement`

### 阶段 6 / 7 自测结果

已通过：

- `npx tsc -p apps/server/tsconfig.json --noEmit`
- `npm run build --workspace @trade-ai-demo/web`
- `POST /api/warehouse/scan/context`
- `POST /api/warehouse/scan/preview`
- `POST /api/warehouse/scan/confirm`
- `POST /api/warehouse/scan/bulk`

已明确验证的关键场景：

- 未入库二维码直接出库：返回 `该货物尚未入库，不能出库`
- 同一码重复入库：返回 `该货物已入库，不能重复入库`
- 同一码重复出库：返回 `该货物已出库，不能重复出库`
- 出库数量达到任务目标后继续出库：会被拦截

浏览器侧已打开并验证：

- `http://127.0.0.1:5173/warehouse`
- 页面已显示真实“扫码入库控制台”
- 页面已显示任务上下文、统计卡片、扫码控制区和异常记录区

## 当前开发策略提醒

- 长期 ERP 升级地基已经记录进项目记忆
- 未来“独立手机静态扫码端”也已经记录为升级方向
- 但当前工作仍然回到 Demo 主线，不切去做长期部署改造
- 下一步仍然按 TODO 进入 `阶段 8：库存真实统计`

## 下一步应该做什么

- 当前阶段 4 已完成
- 当前阶段 5 已完成，并将与阶段 6/7 一起作为最近一次提交基线
- 当前阶段 6 已完成，并将作为阶段 8 的开发基线
- 当前阶段 7 已完成，并将作为阶段 8 的开发基线
- 长期升级原则已记住，但当前不切换开发主线
- 下一个大环节应进入：
  - `阶段 8：库存真实统计`

阶段 6 必须继续保持：

- 扫码入库必须基于真实 `QrItem`
- 不能直接按合同数量或批次数量增加库存
- 只有扫码入库把 `QrItem.status` 从 `PENDING_INBOUND` 变成 `IN_STOCK` 后，库存才增加
- 扫码入库必须先做二维码存在校验、任务归属校验、批次归属校验、状态校验
- 扫码命中后必须先展示确认信息，用户确认后才允许写入 `QrItem` 与 `StockMovement`

阶段 7 也必须继续保持：

- 扫码出库必须基于真实 `QrItem`
- 不能直接按合同数量或销售数量减少库存
- 只有扫码出库把 `QrItem.status` 从 `IN_STOCK` 变成 `OUTBOUND` 后，库存才减少
- 扫码出库必须先做二维码存在校验、任务归属校验、批次归属校验、状态校验
- 扫码命中后必须先展示确认信息，用户确认后才允许写入 `QrItem` 与 `StockMovement`

阶段 8 接下来必须保持：

- 库存统计严格基于 `QrItem.status` 与 `StockMovement`
- 不能把合同数量直接当库存数量
- 不能把批次数量直接当库存数量
