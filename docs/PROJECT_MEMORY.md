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
- 标准演示素材中的 `演示合同-中国采购100箱` 与 `演示箱单-赞比亚仓库100箱`，AI Mock 识别后必须默认落到同一票业务：
  - `contractNoDraft = CTR-DEMO-202606-001`
  - `batchNoDraft = BAT-DEMO-202606-001`
  - 不能再因为 mock 后缀不同而要求用户手动对齐

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
- 阶段 5：已完成，且已与阶段 6/7 一起提交并推送
  - Commit: `25868f7`
  - Message: `feat: 完成阶段5-7二维码追溯与仓储扫码闭环`
- 阶段 6：已完成，已包含在提交 `25868f7`
- 阶段 7：已完成，已包含在提交 `25868f7`
- 阶段 8：已完成，且已提交并推送
  - Commit: `21bab2f`
  - Message: `feat: 完成阶段8库存真实统计`
- 阶段 9：已完成，且已提交并推送
  - Commit: `b6ddc28`
  - Message: `feat: 完成阶段9-11 AI助手、驾驶舱与采购集货模块`
- 阶段 10：已完成，已包含在提交 `b6ddc28`
- 阶段 11：已完成，已包含在提交 `b6ddc28`
- 阶段 12：已完成，且已提交并推送
  - Commit: `a8fbd86`
  - Message: `feat: 完成阶段12-17成熟ERP演示模块`
- 阶段 13：已完成，已包含在提交 `a8fbd86`
- 阶段 14：已完成，已包含在提交 `a8fbd86`
- 阶段 15：已完成，已包含在提交 `a8fbd86`
- 阶段 16：已完成，已包含在提交 `a8fbd86`
- 阶段 17：已完成，已包含在提交 `a8fbd86`
- 当前插入式维护：已完成“首页驾驶舱 / 合同与单据页一键重置到空白演示起点”能力，且已提交并推送
  - Commit: `e8e6d4c`
  - Message: `feat: 增加演示重置能力与单据生成门槛`
- 阶段 18：已完成，用户已确认可提交并推送 Git

## 当前数据库状态

关于“重置到演示状态”的当前最高优先级口径：

- “重置到演示状态” = 回到空白、干净、可重新测试的演示起点
- 重置后应清空当前业务数据：
  - `documents`
  - `contracts`
  - `batches`
  - `qrItems`
  - `stockMovements`
  - 以及相关采购、物流、清关、销售、工单、AI 日志、审计日志
- 重置后不自动恢复正式合同、批次、二维码、库存流水
- 重置后不自动恢复标准演示单据到数据库
- 重置后保留：
  - 基础组织、角色、用户
  - 客户、供应商、SKU、仓库、库位
  - `DemoConfig`
  - 网页保存的升级版 AI 运行时配置
- 重置后默认演示入口应是：
  - 用户从本地目录 `D:\国际贸易多公司一体化管理系统\pics` 手动上传标准图片
  - 再走“上传 -> AI 识别 -> 人工修正 -> 确认生成业务数据”的真实演示流程

当前数据库状态以下内容如果与上面这条重置规则冲突，以上面的重置规则为准。

当前最新数据库关键计数为：

- `documents = 6`
- `contracts = 1`
- `contractItems = 1`
- `batches = 1`
- `purchaseOrders = 1`
- `purchaseOrderItems = 1`
- `shipments = 1`
- `shipmentNodes = 6`
- `customsClearances = 1`
- `payments = 1`
- `receivables = 1`
- `qrItems = 0`
- `stockMovements = 0`
- `preReceiveOrders = 1`
- `inboundOrders = 1`
- `outboundOrders = 1`
- `salesOrders = 1`
- `workOrders = 2`
- `inventorySnapshots = 0`
- `aiLogs = 8`
- `auditLogs = 10`
- `demoConfigs = 1`

当前最新真实库存汇总为：

- `totalQrItems = 0`
- `inTransitInventory = 0`
- `realtimeInventory = 0`
- `availableInventory = 0`
- `frozenInventory = 0`
- `outboundQuantity = 0`
- `totalInboundMovements = 0`
- `totalOutboundMovements = 0`
- `statusAccountedQuantity = 0`
- `isConsistent = true`

这说明当前系统已经进入：

- 单据草稿识别层：已完成
- 正式业务数据层：已完成第一版，且补齐了单据生命周期治理
- 二维码与库存层：已进入真实二维码与扫码阶段
- 二维码生成与追溯层：第一版已完成
- 扫码入库、扫码出库层：已完成第一版
- 库存真实统计层：已完成第一版
- AI 真实库存问答层：已完成第一版
- 首页驾驶舱总览层：已完成第一版
- 采购与集货展示层：已完成第一版
- 仓储管理增强工作台：已完成第一版
- 当前演示数据库状态说明：
  - 当前页面或本地旧记录里如果还出现“恢复为标准演示业务链路”的旧说法，属于历史记忆残留
- 当前应以“重置后回到空白演示起点，再由用户手动上传 `pics` 素材开始”作为最终规则

## 最近一次单据自动配对与驾驶舱口径补充

- 已修复一个真实演示阻塞问题：
  - 标准演示合同与标准演示箱单虽然都已识别，但此前 mock 识别会分别生成不同的 `contractNoDraft / batchNoDraft`
  - 这会导致系统把两份标准素材误判为两票不同业务，从而无法点击“确认生成业务数据”
- 当前最新规则是：
  - 对标准演示图片 `演示合同-中国采购100箱.png`
  - 以及 `演示箱单-赞比亚仓库100箱.png`
  - AI Mock 识别后默认自动配成同一票业务
  - 不再要求用户手动修改草稿号
- 本次已真实自测：
  - 重新识别后，合同与箱单都会落到
    - `CTR-DEMO-202606-001`
    - `BAT-DEMO-202606-001`

- 已补充首页驾驶舱字段口径，避免把“合同总量”和“库存数量”混为一谈
- 当前驾驶舱应按以下口径理解：
  - `合同总量` = 商务承诺总数量
  - `已进入执行` = 已生成二维码、已进入实际执行链路的数量
  - `合同待执行` = 合同总量减去已进入执行数量
  - `当前执行批次量` = 当前主批次的总数量
  - `当前批次在途` = 当前主批次已生成二维码但尚未入库的真实数量
  - `当前批次在库` = 当前主批次已扫码入库且尚未出库的真实数量
  - `当前批次已出库` = 当前主批次已扫码出库的真实数量
- 这意味着：
  - 驾驶舱不再只显示一个“100箱”或“40箱”
  - 而是同时区分合同总量、执行量和真实库存量

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
- 阶段 4 当时自测结果：`qrItems = 0`
- 阶段 4 当时自测结果：`stockMovements = 0`
- 阶段 4 当时库存仍未生成

### 幂等自测

对同一份 `Document` 再次调用确认接口：

- 返回 `created = false`
- 没有重复生成正式业务数据

## 当前演示数据说明

当前关于“重新测试 / 重置到演示状态”的最终记忆是：

- 系统应回到空白、干净的演示起点
- 底座主数据保留
- `DemoConfig` 保留标准值
- 默认单据图片素材保留在本地 `pics/`
- 用户需要手动上传标准合同、箱单、发票、提单图片后，再重新走真实演示链路

当前标准演示素材与标准配置仍然固定为：

- 起点：`中国`
- 商品：`铜缆演示货物`
- 客户：`赞比亚客户 ABC Trading`
- 供应商：`中国供应商 China Supplier Co., Ltd.`
- 目的仓库：`赞比亚仓库`
- 总数量：`100 箱`
- 计划出库：`20 箱`
- 理论剩余：`80 箱`
- 合同金额：`50000 USD`

## 剩余注意事项

- 工作区中仍有未跟踪目录 `pics/`
- 里面是测试素材图片，当前没有加入 Git
- 后续开发不要误删，也不要默认提交，除非用户明确要求

## 最近一次默认演示单据素材补充

- 已新增一组可直接用于“合同与单据”页手动上传的默认演示图片素材，存放于本地目录 `D:\国际贸易多公司一体化管理系统\pics`
- 当前已生成 4 张标准单据图片：
  - `演示合同-中国采购100箱.png`
  - `演示箱单-赞比亚仓库100箱.png`
  - `演示发票-50000USD.png`
  - `演示提单-CONT-DEMO-202606-001.png`
- 这些图片的用途是：
  - 由用户手动在 `合同与单据` 页面上传
  - 由现有 `AI Mock` 识别链路继续完成识别、人工修正、确认生成业务数据演示
- 这一条现在已经成为正式规则：
  - 重置后不自动恢复单据、合同、批次、二维码、库存
  - 仅保留本地图片素材，由用户手动上传开始

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

## 最近一次演示管理员能力补充

- 已在 `首页驾驶舱` 与 `合同与单据` 页面同时补充“演示管理员”入口
- 已新增后端接口：`POST /api/setup/reset-demo`
- 已支持先清空以下演示业务数据：
  - 单据
  - 合同与合同明细
  - 批次
  - 二维码
  - 库存流水
  - 采购单
  - 物流记录
  - 清关记录
  - 预收货 / 入库 / 出库任务
  - 销售单
  - 工单
  - AI 日志
  - 审计日志
- 当前最新规则已经覆盖早期“自动重建标准演示业务链路”的方案：
  - 现在重置后的目标是“空白演示起点”
  - 不再以“自动恢复 4 份标准单据 / 1 份合同 / 1 个批次 / 100 个二维码 / 120 条库存流水”为默认结果
- 已支持清理以下演示文件：
  - `uploads/documents`
  - `uploads/qr-codes`
- 已支持清理后重新生成以下演示文件：
  - 标准合同 / 箱单 / 发票 / 提单文件
  - 标准二维码图片资源
- 已明确保留：
  - 公司、部门、角色、用户
  - 客户、供应商、SKU、仓库、库位
  - 网页保存的升级版 AI 运行时配置
- 已补充标准场景展示：
  - 中国采购 `100 箱`
  - 发往 `赞比亚仓库`
  - 计划出库 `20 箱`
  - 理论剩余 `80 箱`
- 当前应记住的最新目标行为：
  - `POST /api/setup/reset-demo` 成功后，系统应回到空白演示起点
  - 页面保留“演示管理员”入口
  - 用户从 `pics/` 手动上传素材重新开始测试

本次还确认了一条重要现场结论：

- 如果你之前在截图里还看到旧测试单据，不代表后台数据库仍有这些数据
- 这次真实核对结果是：后台已清空，旧内容主要是前端页面当时还停留在旧渲染状态
- 当前前端服务已刷新到最新代码，首页与单据页都已经和后台清空状态对齐

## 最近一次演示管理员最高权限确认补充

- 已把“回到空白演示起点 / 重新测试”从普通确认弹窗升级为“最高权限确认弹窗”
- 当前规则为：
  - 必须先勾选“我确认当前是最高权限用户”
  - 必须手动输入确认短语：`我是最高权限用户`
  - 两项都满足后，前端确认按钮才允许点击
- 后端 `POST /api/setup/reset-demo` 也已同步加固：
  - 如果没有传入 `highestPrivilegeConfirmed = true`
  - 或 `confirmationText !== 我是最高权限用户`
  - 接口会直接返回 `403`
- 这意味着当前重置能力不是只靠前端提醒，而是前后端双重拦截
- 当前 `GET /api/setup/status` 也会返回：
  - `resetCapability.confirmationRequired = true`
  - `resetCapability.confirmationPhrase = 我是最高权限用户`
  - `resetCapability.highestPrivilegeRole = OWNER`
- 本次真实自测已确认：
  - 未确认时调用重置接口：返回 `403`
- 正确确认后调用重置接口：目标行为应返回 `200`
- 重置完成后的目标状态应为：`documents/contracts/batches/qrItems/stockMovements = 0`

## 最近一次成熟版单据关键节点提醒补充

- 已在 `合同与单据` 页面新增“成熟版关键节点提醒”卡片
- 当前页面会直接展示四类关键单据准备状态：
  - `合同`
  - `箱单`
  - `提单`
  - `发票`
- 当前提醒规则明确为：
  - 成熟版首轮正式业务生成前，建议至少具备 `合同 + 箱单`
  - `提单` 通常在国际物流阶段补传
  - `发票` 通常在报关 / 清关阶段补传，并与箱单、提单、其他资料做一致性校验
  - 库存不会因为单据上传或正式业务生成而自动增加，必须等二维码生成并扫码入库后才生效
  - 应收可以先生成草稿，但真正回款、核销和财务完成属于后续财务阶段
- 当前规则已经升级为“成熟版真实门槛”：
  - 页面会明确提示是否已满足 `合同 + 箱单`
  - 没有同时具备同票、已识别的 `合同 + 箱单` 时，“确认生成业务数据”按钮直接禁用
  - 后端 `POST /api/documents/:id/confirm` 也会按同一规则拦截，不能绕过前端强行生成
  - 同票口径明确为相同的 `contractNoDraft + batchNoDraft`
- 本次查看入口仍然是：
  - `http://127.0.0.1:5173/documents`
- 本次前端类型检查已通过：
  - `npx tsc -p apps/web/tsconfig.json --noEmit`

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

## 阶段 8 已完成内容

阶段 8 已经实现：

- 新增真实库存汇总接口 `GET /api/inventory/summary`
- 后端可返回：
  - 总体库存汇总
  - 按合同统计
  - 按批次统计
  - 按仓库统计
  - 最近库存流水摘要
- 库存指标已统一定义为：
  - 在途库存 = `QrItem.status = PENDING_INBOUND`
  - 可用库存 = `QrItem.status = IN_STOCK`
  - 冻结库存 = `QrItem.status = FROZEN`
  - 已出库 = `QrItem.status = OUTBOUND`
  - 实时库存 = 可用库存 + 冻结库存
- 明确保持：合同数量只是业务目标量，不直接回填为库存数量
- `http://127.0.0.1:5173/warehouse` 已新增正式“库存管理”区
- 库存管理区已支持：
  - 真实库存卡片
  - 按批次 / 按合同 / 按仓库切换查看
  - 库存流水摘要
  - 当前任务批次 / 合同 / 仓库高亮
- `http://127.0.0.1:5173/batches` 的过时提示已修正，不再错误声称“当前还没有库存”

阶段 8 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- `GET /api/inventory/summary`：通过
- `GET /api/inventory/summary?batchId=cmq3zx1a30004urgw302sg8j3`：通过
- 浏览器检视 `http://127.0.0.1:5173/warehouse`：通过
- 已确认“库存管理”区位于仓储管理页面内，而不是独立的阶段验证入口
- 已确认“按批次 / 按合同 / 按仓库”三个标签可切换
- 已确认库存统计结果与当前二维码真实状态一致：
  - 在途 `114`
  - 实时 `5`
  - 可用 `5`
  - 冻结 `0`
  - 已出库 `1`

阶段 8 当前继续保持的底线：

- 不把合同数量直接当成库存数量
- 不把批次数量直接当成库存数量
- 库存统计必须继续以 `QrItem.status` 为主数据来源
- 库存流水必须继续以 `StockMovement` 为追溯依据
- 后续阶段 9 的 AI 库存问答，必须建立在这套真实库存汇总结果之上

## 阶段 9 已完成内容

阶段 9 已经实现：

- 新增 AI 助手状态接口 `GET /api/ai-assistant/status`
- 新增 AI 问答接口 `POST /api/ai-assistant/ask`
- 后端已采用：
  - 规则识别意图
  - 受控查询真实业务数据
  - 可选大模型组织语言
  - 大模型不可用时模板兜底
- 新增可复用库存汇总服务 `inventorySummary`
- AI 助手当前已支持：
  - 批次库存问答
  - 合同库存问答
  - 指定日期 / 今日入库问答
  - 指定日期 / 今日出库问答
  - 单个二维码生命周期问答
  - 未回款合同摘要问答
- 所有 AI 回答过程都会写入 `AiLog`
- 前端 `http://127.0.0.1:5173/ai-assistant` 已从占位页升级为真实可提问页面
- 前端页面已支持：
  - 查看当前回答模式
  - 查看 provider / model 状态
  - 直接输入问题
  - 点击建议问题快速提问
  - 查看 AI 回答
  - 查看关键高亮
  - 查看回答依据
- AI 助手入口现已进一步调整为：
  - 左侧栏移除 `AI 助手` 固定菜单项
  - 页面右下角新增全局悬浮入口
  - 任意业务页面都可以直接唤起 AI 助手抽屉
  - 独立路由 `http://127.0.0.1:5173/ai-assistant` 仍然保留，方便单独演示
- 阶段 9 本次继续增强为：
  - 默认保留“本地模板 AI”模式，不要求演示前先配置外部大模型
  - 新增升级版 AI 配置接口：
    - `GET /api/ai-assistant/config`
    - `PUT /api/ai-assistant/config`
    - `DELETE /api/ai-assistant/config`
  - 新增网页内升级版 AI 配置能力：
    - 可填写 `provider`
    - 可填写 `model`
    - 可填写 `baseUrl`
    - 可填写 `apiKey`
  - 网页保存的升级配置只写入后端本地运行时配置文件，不进入前端源码，不进入业务数据库
  - 前端只能看到 Key 是否已配置与脱敏结果，不能回显完整 API Key
  - AI 运行时优先级已经固定为：
    - 网页保存的升级配置
    - 后端 `.env` 配置
    - 本地模板模式
  - 即使升级版 AI 调用失败，也必须继续模板兜底，保证 Demo 链路不中断

阶段 9 严格保持的原则：

- AI 不直接查数据库
- AI 不直接改数据库
- 前端不暴露 API Key
- 所有真实数据先由后端接口汇总，再交给 AI 组织语言
- 即使接入大模型，库存数字来源也只能是 `QrItem.status` 与 `StockMovement`
- 合同数量不直接等于库存数量，只有在真实扫码入库完成后，库存才会与实物状态一致

阶段 9 当前环境状态：

- 当前项目仍然支持“不开 `.env` 也能用模板 AI 跑通 Demo”
- 后端仍然预留：
  - `AI_PROVIDER`
  - `AI_API_KEY`
  - `AI_MODEL`
  - `AI_BASE_URL`
- 当前这台机器的实际运行态已经切到网页保存的升级版配置：
  - `llmEnabled = true`
  - `provider = deepseek`
  - `model = deepseek-v4-flash`
  - `source = runtime`
  - `baseUrl = https://api.deepseek.com`
- 当前运行时配置里已经存在脱敏后的 Key 状态：
  - `apiKeyConfigured = true`
  - `apiKeyMasked = sk-9***0f5c`
- 网页配置文件当前保存在本地运行时目录 `.runtime/`，并已加入 `.gitignore`
- 如果你后续删除网页升级配置，系统仍然会自动回退到 `template / mock` 模式

阶段 9 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- `GET /api/ai-assistant/status`：通过
- `POST /api/ai-assistant/ask`：通过
- `GET /api/ai-assistant/config`：通过
- `PUT /api/ai-assistant/config`：通过
- `DELETE /api/ai-assistant/config`：通过
- 已验证问题：
  - `这批货现在还有多少？`
  - `CTR-20260607-3BP3IZ 这个合同现在还有多少库存？`
  - `BAT-20260607-3BP3IZ-0001 这个二维码现在是什么状态？`
  - `2026/6/8 入库多少箱？`
- 浏览器检视 `http://127.0.0.1:5173/ai-assistant`：通过
- 浏览器检视 `http://127.0.0.1:5173/documents`：通过
- 已确认建议问题按钮可直接触发提问
- 已确认回答区与回答依据区会同步渲染
- 已确认当前模板回答使用的是真实库存与真实库存流水
- 已确认左侧栏不再显示 `AI 助手`
- 已确认右下角悬浮按钮可在非 AI 页面直接唤起 AI 助手抽屉
- 已确认串行链路：
  - 保存网页升级配置后，`status.source = runtime`
  - 升级配置使用不可用测试 Key 时，问答会回退 `template` 回答，但仍保留真实库存答案
  - 删除网页升级配置后，`status.source = template`

阶段 9 验证时需要记住：

- 当前真实库存基线已经变化为：
  - 在途 `104`
  - 实时 `15`
  - 可用 `15`
  - 冻结 `0`
  - 已出库 `1`
- 当前真实流水基线已经变化为：
  - 入库流水 `16`
  - 出库流水 `1`
- 这些数字来自当前数据库实时状态，不再是阶段 8 初次自测时的那组数据

## 阶段 10 已完成内容

阶段 10 已经实现：

- 新增首页驾驶舱聚合接口 `GET /api/dashboard/overview`
- 后端新增统一聚合服务 `dashboardOverview`
- 首页 `http://127.0.0.1:5173/dashboard` 已从占位页升级为正式驾驶舱
- 首页现在已经支持：
  - 真实库存总览卡片
  - 入库 / 出库执行进度卡片
  - 演示场景总览卡片
  - ERP 模块状态卡片
  - 最近工单与待办
  - 最近推进时间线
  - 系统基础状态与 AI 运行状态
- 首页库存与执行进度继续严格来自真实二维码状态与库存流水：
  - `inTransitInventory`
  - `realtimeInventory`
  - `availableInventory`
  - `outboundQuantity`
  - `totalInboundMovements`
  - `totalOutboundMovements`
- 首页同时把成熟 ERP 演示模块串起来展示：
  - 合同与单据
  - 二维码追溯
  - 仓储扫码
  - 财务回款
  - AI 助手
  - 演示场景配置
- 首页“最近推进”已经能混合展示：
  - 仓储流水
  - 单据进展
  - 合同生成
  - 批次推进
  - AI 调用记录
- 首页现在新增“主合同视角”切换：
  - 驾驶舱右侧支持从已有正式合同中自主选择一个主合同
  - 页面通过 `focusContractId` 查询参数驱动当前主合同视角
  - 主合同卡片、主批次、执行进度、主待办会随所选合同切换
  - 全局库存总览卡片仍保持展示全部真实库存统计，不会因为切换主合同而伪造或改写全局库存
  - 如果所选合同尚未进入二维码 / 扫码环节，则只展示该合同基础信息与 0 进度，不伪造库存与仓储执行结果
- 首页现在新增“订单池视角”切换：
  - 默认优先进入 `进行中订单`
  - 同时支持切换：
    - `已完成待归档`
    - `售后订单`
    - `异常订单`
    - `已归档订单`
    - `全部订单`
  - 驾驶舱会优先按订单池筛选可用合同，再在当前池内选择主合同视角
- 首页当前已把订单状态拆成四个维度展示：
  - `主流程状态`
  - `售后状态`
  - `异常状态`
  - `归档状态`
- 当前阶段 10 先按演示版口径实现：
  - 主流程状态依据二维码、扫码、出库、回款草稿状态推导
  - 售后状态当前默认展示 `未触发售后`
  - 异常状态当前依据异常二维码数量推导
  - 归档状态当前依据“主流程是否完成且无售后、无异常”推导
- 长期 ERP 状态设计原则已锁定：
  - “订单完成”不等于“自动归档”
  - 全链路完成后先进入 `待归档`
  - 人工确认后才进入 `已归档`
  - 售后状态与主流程状态分离
  - 异常状态与主流程状态分离
  - 退货、退款、换货等售后处理不能直接删除原始库存和资金历史，正式版应通过冲销、逆向记录或补充单据处理
- 首页“二维码追溯”卡片的统计口径已进一步明确：
  - 该卡片展示系统内所有已生成二维码的全局累计
  - 不跟随主合同视角切换
  - 如果后续新批次再生成 100 个二维码，则首页这里应从 120 变为 220
- 首页进入 `二维码追溯` 模块后的默认展示口径已进一步明确：
  - 二维码追溯页默认进入最新批次视角
  - 若最新批次尚未生成二维码，则二维码列表与二维码详情保持空白
  - 若最新批次已生成二维码，则默认展示该批次的二维码列表与详情
  - 页面顶部当前批次、左侧二维码列表、右侧二维码详情必须严格保持同一批次上下文，不能残留上一批次数据
- 首页空订单池行为已明确：
  - 当前订单池下如果没有合同，首页仍保留全局库存总览、模块总览、最近推进
  - 但主订单视角必须显示为空
  - 不允许自动回退展示其他订单池的合同，避免误导演示
- 首页主订单待办行为已补强：
  - 当前主订单切换后，预收货、入库、出库、销售配送等待办优先跟随当前主合同
  - 不再默认混入其他合同的任务
- 首页没有新增临时“阶段验证入口”
- 最终查看位置就是左侧菜单中的 `首页驾驶舱`

阶段 10 当前接口与页面基线：

- `GET /api/dashboard/overview` 当前已返回：
  - `assistant.provider = deepseek`
  - `assistant.model = deepseek-v4-flash`
  - `assistant.source = runtime`
  - `orderView = active`
  - `orderPools.active.count = 2`
  - `inventory.inTransitInventory = 204`
  - `inventory.realtimeInventory = 15`
  - `inventory.availableInventory = 15`
  - `inventory.outboundQuantity = 1`
  - `inventory.totalInboundMovements = 16`
  - `inventory.totalOutboundMovements = 1`
  - `inventory.isConsistent = true`
  - `focus.contractNo = CTR-20260608-F8RY1S`
  - `focus.batchNo = BAT-20260608-F8RY1S`
  - `focus.mainFlowStatusText = 在途待入库`
  - `statusCards[qrcode].metricLabel = 全局二维码累计`
  - `statusCards[qrcode].metricValue = 220 个码`
- `GET /api/dashboard/overview?orderView=active` 当前已返回：
  - `availableContracts.length = 2`
  - `focus.contractNo = CTR-20260608-F8RY1S`
  - `focus.mainFlowStatusText = 在途待入库`
  - `execution.totalQuantity = 100`
  - `execution.inboundPending = 100`
  - `recentTasks` 已优先跟随当前主合同筛选
- `GET /api/dashboard/overview?orderView=completed` 当前已返回：
  - `availableContracts.length = 0`
  - `focus.contractNo = null`
  - `execution.totalQuantity = 0`
  - 首页已满足“空订单池时主订单视角保持为空，不回退展示其他池合同”
- 首页最近待办当前可根据主合同切换不同引用对象：
  - 当前主合同无匹配仓储任务时，仅保留通用待办，例如单据草稿、财务回款
  - 当前主合同有匹配仓储任务时，再显示对应合同的预收货、入库、出库、销售配送跟进

阶段 10 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- `GET /api/dashboard/overview`：通过
- `GET /api/dashboard/overview?orderView=active`：通过
- `GET /api/dashboard/overview?orderView=completed`：通过
- 已确认首页默认优先进入 `进行中订单`
- 已确认首页支持订单池切换与主合同切换两层视角
- 已确认首页已展示主流程 / 售后 / 异常 / 归档四维状态卡
- 已确认空订单池时不会回退展示其他池子的合同
- 已确认首页二维码卡片口径为“全局二维码累计”，不跟随主合同视角变化
- 已确认二维码追溯页切换批次时会主动清空旧列表与旧详情，避免旧批次二维码残留覆盖新批次视图
- 已确认首页接口返回真实库存、执行进度、AI 状态与最近推进数据
- 已确认首页主订单待办会尽量跟随当前主合同，不再默认混入其他合同任务
- 已确认首页支持自主切换主合同视角，且切换后不会污染全局库存总览
- 已确认首页入口位于正式菜单 `首页驾驶舱`，不是单独临时验证页

## 阶段 11 已完成内容

阶段 11 已经实现：

- 新增采购与集货后端接口：
  - `GET /api/procurement/orders`
  - `GET /api/procurement/orders/:id`
  - `POST /api/procurement/orders/:id/progress`
- 新增前端正式页面：
  - 左侧菜单 `采购与集货`
  - 路由 `http://127.0.0.1:5173/procurement`
- 页面已从骨架页升级为真实演示工作台，支持：
  - 采购单列表
  - 采购单详情抽屉
  - 采购状态步骤条
  - 关联合同号、批次号、SKU、数量、交期、目的仓库展示
  - 关联二维码状态概况展示
  - 关联国际物流记录展示
  - 关联自动工单展示
  - 状态推进历史展示
- 当前采购状态按演示版顺序推进：
  - `DRAFT`
  - `SUPPLIER_SHIPPED`
  - `COLLECTION_COMPLETED`
- 页面交互已限制为只能顺序推进，不允许跳步或回退
- 阶段 11 严格保持：
  - 采购与集货状态推进不会直接改库存
  - 不会直接改 `QrItem.status`
  - 不会直接改 `StockMovement`
  - 库存仍然只能由二维码扫码入库 / 扫码出库驱动
- 当采购状态推进到 `COLLECTION_COMPLETED` 时，系统会自动联动：
  - 创建 `Shipment`
  - 创建 `ShipmentNode`
  - 创建 `WorkOrder`
  - 让采购模块把业务上下文正式交给国际物流阶段
- 关于 `Shipment` 的成熟版原则补充：
  - `Shipment` 应被视为系统内部正式运输业务单，不等于外部 `提单`
  - 成熟版应保持“采购 / 集货完成后自动创建 `Shipment`”这个方向
  - 但自动创建时，优先只生成内部运输单号，例如 `SHP-...`
  - `提单号 / 柜号 / 船公司 / 航次 / ETD / ETA` 等运输资料，成熟版允许先为空
  - 这些资料应在后续国际物流阶段通过两类方式补全：
    - 上传提单等运输单据后，由 AI 识别并经人工确认回填
    - 物流人员在系统中手工录入或修正
  - 在资料未补全前，`Shipment` 的成熟版状态应更偏向：
    - `待补运输资料`
    - `待订舱`
    - `待录入提单`
  - 当前阶段 12 为了先跑通 Demo，暂时使用了自动补出演示提单号与柜号的做法
  - 后续如果升级到更成熟版本，应改为：
    - `Shipment` 自动建单
    - `提单 / 柜号` 后续补全
    - 页面上清楚区分“系统内部运输单”与“外部提单单据”

阶段 11 当前真实演示数据基线：

- 采购单 `PO-20260608-F8RY1S`
  - 当前已推进到 `COLLECTION_COMPLETED`
  - 已自动生成物流记录 `SHP-20260608-F8RY1S`
  - 已自动生成运输安排工单 `WO-LOG-20260608-F8RY1S`
  - 已生成物流节点 `国内集货完成`
- 采购单 `PO-20260607-3BP3IZ`
  - 当前仍保持 `DRAFT`
  - 可继续用于现场演示“供应商已发货”与“国内集货完成”的手动推进

阶段 11 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- `GET /api/procurement/orders`：通过
- `GET /api/procurement/orders/:id`：通过
- `POST /api/procurement/orders/:id/progress`：
  - 已验证 `DRAFT -> SUPPLIER_SHIPPED`
  - 已验证 `SUPPLIER_SHIPPED -> COLLECTION_COMPLETED`
  - 已验证 `COLLECTION_COMPLETED` 后自动生成 `Shipment / ShipmentNode / WorkOrder`
- 已确认采购页详情抽屉可回读：
  - 最新采购状态
  - 最新物流记录
  - 最新工单信息
  - 最新推进历史

## 阶段 12 已完成内容

阶段 12 已经实现：

- 新增国际物流后端接口：
  - `GET /api/logistics/shipments`
  - `GET /api/logistics/shipments/:id`
  - `POST /api/logistics/shipments/:id/progress`
- 新增前端正式页面：
  - 左侧菜单 `国际物流`
  - 路由 `http://127.0.0.1:5173/logistics`
- 页面已从骨架页升级为真实演示工作台，支持：
  - 运输批次列表
  - 运输详情抽屉
  - 运输节点时间轴
  - 关联合同 / 批次 / 采购单 / 柜号 / 提单 / 起运港 / 目的港展示
  - 关联二维码状态概况展示
  - 关联系统单据展示
  - 关联物流工单与清关工单展示
  - 物流状态推进历史展示
- 当前国际物流状态按演示版顺序推进：
  - `COLLECTION_COMPLETED`
  - `DEPARTED`
  - `ARRIVED_DESTINATION`
- 页面交互已限制为只能顺序推进，不允许跳步或回退
- 阶段 12 严格保持：
  - 国际物流状态推进不会直接改库存
  - 不会直接改 `QrItem.status`
  - 不会直接改 `StockMovement`
  - 库存仍然只能由二维码扫码入库 / 扫码出库驱动
- 当国际物流推进到 `ARRIVED_DESTINATION` 时，系统会自动联动：
  - 创建或更新 `CustomsClearance`
  - 创建 `CUSTOMS_CLEARANCE` 工单
  - 生成 AI 单据一致性检查草稿结果
  - 让国际物流模块把业务上下文正式交给报关清关阶段

阶段 12 当前真实演示数据基线：

- 采购单 `PO-DEMO-202606-001`
  - 当前已推进到 `COLLECTION_COMPLETED`
- 运输批次 `SHP-DEMO-202606-001`
  - 当前已推进到 `ARRIVED_DESTINATION`
  - 当前页面状态文案为 `到港待清关`
  - 当前已生成运输节点：
    - `国内集货完成`
    - `已装柜`
    - `已离港`
    - `海运中`
    - `到达目的港`
    - `待清关`
- 清关草稿 `CUS-DEMO-202606-001`
  - 当前状态为 `PENDING`
  - 当前已挂接箱单单据
- 自动工单：
  - `WO-LOG-DEMO-202606-001`
    - 类型：`LOGISTICS_ARRANGEMENT`
    - 当前状态：`COMPLETED`
  - `WO-CUS-DEMO-202606-001`
    - 类型：`CUSTOMS_CLEARANCE`
    - 当前状态：`PENDING`

阶段 12 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npx tsc -p apps/web/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- 已验证 `GET /api/logistics/shipments`
- 已验证 `GET /api/logistics/shipments/:id`
- 已验证 `POST /api/logistics/shipments/:id/progress`
  - 已验证 `COLLECTION_COMPLETED -> DEPARTED`
  - 已验证 `DEPARTED -> ARRIVED_DESTINATION`
  - 已验证到港后自动生成 `CustomsClearance / CUSTOMS_CLEARANCE WorkOrder`
- 已确认国际物流详情抽屉可回读：
  - 最新运输状态
  - 完整时间轴
  - 关联合同 / 批次 / 采购单
  - 关联单据
  - 关联清关草稿
  - 关联物流 / 清关工单
  - 最新推进历史

## 阶段 13 已完成内容

阶段 13 已经实现：

- 新增报关清关后端接口：
  - `GET /api/customs/clearances`
  - `GET /api/customs/clearances/:id`
  - `POST /api/customs/clearances/:id/complete`
- 新增前端正式页面：
  - 左侧菜单 `报关清关`
  - 路由 `http://127.0.0.1:5173/customs`
- 页面已从骨架页升级为真实演示工作台，支持：
  - 清关记录列表
  - 清关详情抽屉
  - 责任公司 / 责任人展示
  - 关联合同 / 批次 / 运输批次展示
  - 箱单 / 发票 / 提单 / 产地证关联系统单据展示
  - AI 单据一致性检查结果展示
  - 清关状态推进历史展示
  - 关联清关工单、境外陆运任务、仓库预收货单与预收货工单展示
- 当前报关清关状态按演示版顺序推进：
  - `PENDING`
  - `COMPLETED`
- 页面交互已限制为只能从 `待清关` 顺序推进到 `已完成清关`，不允许跳步或回退
- 阶段 13 严格保持：
  - 清关推进不会直接改库存
  - 不会直接改 `QrItem.status`
  - 不会直接改 `StockMovement`
  - 库存仍然只能由二维码扫码入库 / 扫码出库驱动
- 当清关推进到 `COMPLETED` 时，系统会自动联动：
  - 创建 `PreReceiveOrder`
  - 创建 `OVERSEAS_LAND_TRANSPORT` 工单
  - 创建 `WAREHOUSE_PRE_RECEIVE` 工单
  - 完成已有 `CUSTOMS_CLEARANCE` 工单
  - 让报关清关模块把业务上下文正式交给仓储管理阶段

阶段 13 当前真实演示数据基线：

- 清关草稿 `CUS-DEMO-202606-001`
  - 当前状态已恢复为 `PENDING`
  - 当前页面状态文案为 `待清关`
  - 当前已挂接箱单单据
  - 当前 AI 一致性检查结果为：
    - `箱单数量 = 100箱`
    - `发票数量 = 100箱`
    - `提单柜号 = CONT-DEMO-202606-001`
    - `AI 判断 = 单据数量一致，可进入清关流程`
- 自动工单：
  - `WO-CUS-DEMO-202606-001`
    - 类型：`CUSTOMS_CLEARANCE`
    - 当前状态：`PENDING`
- 当前为了方便你手动验阶段 13，我已把联动自测后产生的预收货与陆运任务恢复回未生成状态：
  - `preReceiveOrders = 0`
  - `workOrders = 2`
  - 页面上仍然保留“模拟清关完成”按钮，供你现场亲自推进

阶段 13 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npx tsc -p apps/web/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- 已验证 `GET /api/customs/clearances`
- 已验证 `GET /api/customs/clearances/:id`
- 已验证 `POST /api/customs/clearances/:id/complete`
  - 已验证 `PENDING -> COMPLETED`
  - 已验证自动生成：
    - `PR-DEMO-202606-001`
    - `WO-LAND-DEMO-202606-001`
    - `WO-WH-DEMO-202606-001`
  - 已验证清关完成后库存汇总保持不变：
    - `totalQrItems = 0`
    - `realtimeInventory = 0`
    - `stockMovements = 0`
- 已确认报关清关详情抽屉可回读：
  - 最新清关状态
  - AI 一致性检查结果
  - 关联合同 / 批次 / 运输批次
  - 关联系统单据
  - 关联清关 / 陆运 / 预收货工单
  - 最新推进历史
- 已在自测结束后把清关状态恢复回 `PENDING`，避免影响你手动验收阶段 13

## 阶段 14 已完成内容

阶段 14 已经实现：

- 新增仓储工作台后端接口：
  - `GET /api/warehouse/workbench`
- 仓储页面 `http://127.0.0.1:5173/warehouse` 已从单一扫码控制台升级为四分区工作台：
  - `预收货管理`
  - `扫码收货验收`
  - `库存管理`
  - `销售出库管理`
- 阶段 14 严格复用了阶段 6 / 7 / 8 的真实能力，而不是新造一套假仓储流程：
  - 入库仍然通过真实 `POST /api/warehouse/scan/preview`
  - 入库仍然通过真实 `POST /api/warehouse/scan/confirm`
  - 出库仍然通过真实 `POST /api/warehouse/scan/preview`
  - 出库仍然通过真实 `POST /api/warehouse/scan/confirm`
  - 库存统计仍然来自真实 `GET /api/inventory/summary`
- 当前仓储工作台新增的成熟 ERP 视角包括：
  - 预收货任务列表 + 详情区
  - 销售出库任务列表 + 详情区
  - 聚焦仓库库位快照
  - 入库 / 出库扫码上下文分区展示
  - 统一的仓储顶部 KPI 卡片
- 当前页面已补充一个重要演示提示：
  - 如果当前批次还没有生成二维码，仓储页会明确提示“可以先看任务，但暂时不能真实扫码”
  - 避免把“应扫数量存在，但二维码仍为 0”误判成页面故障

阶段 14 当前真实演示数据基线：

- 预收货单：
  - `PR-BAT-DEMO-202606-001`
  - 当前状态：`READY`
- 入库单：
  - `IN-BAT-DEMO-202606-001`
  - 当前状态：`READY`
- 销售单：
  - `SO-BAT-DEMO-202606-001`
  - 当前状态：`READY`
- 出库单：
  - `OUT-BAT-DEMO-202606-001`
  - 当前状态：`READY`
- 当前仍未生成二维码：
  - `qrItems = 0`
  - `stockMovements = 0`
  - `realtimeInventory = 0`
- 这符合当前演示链路：
  - 合同、批次、采购、物流、清关、预收货、出库任务已经建立
  - 但只要二维码还没生成、也还没扫码入库，库存就必须保持为 0

阶段 14 自测结果：

- `npx tsc -p apps/server/tsconfig.json --noEmit`：通过
- `npx tsc -p apps/web/tsconfig.json --noEmit`：通过
- `npm run build --workspace @trade-ai-demo/web`：通过
- 已验证 `GET /api/warehouse/workbench`
- 已验证 `POST /api/warehouse/scan/context`
- 已验证 `GET /api/inventory/summary`
- 已验证仓储页可见 DOM 已包含：
  - `预收货管理`
  - `扫码收货验收`
  - `库存管理`
  - `销售出库管理`
  - `进入扫码收货验收`
- 当前由于演示基线尚未生成二维码，仓储页扫码区展示为：
  - 任务与数量上下文可读
  - 真正扫码执行能力待阶段 5 已生成二维码的数据基线进入后再继续真实操作

关于工单阶段的当前记忆：

- 当前项目里已经开始在采购、物流、清关等环节自动生成必要工单
- 但这些工单目前只是各业务阶段为了联动演示而产生的真实任务记录
- “自动工单”作为统一工作台、统一筛选页、统一字段展示页，仍然保留到 `阶段 19：自动工单展示模块` 再集中做深
- 所以后续如果再次讨论工单，应区分：
  - 前序业务阶段里的“联动生成工单”
  - 阶段 19 的“统一工单模块”

## 最近一次二维码入口优化

- 当某个批次已经生成二维码后，批次详情页主按钮改为“查看本批次二维码”
- 点击后会直接进入 `http://127.0.0.1:5173/qr-items?batchId=...`，自动定位到该批次的二维码列表
- 二维码追溯页也同步做了防误点优化：
  - 已有二维码时主按钮改为“查看当前批次二维码”
  - 点击后会回到该批次的默认查看状态，避免误以为需要重复生成
- 这次改动只优化前端入口，不改变后端幂等保护
- 后端仍然保持：
  - 同一批次再次调用 `POST /api/qr-items/generate` 不会生成第二批二维码
  - 只会返回已有二维码数据

## 最近一次 AI 升级版配置修复

- 已修复“点击保存升级版配置后，界面看起来没有生效”的问题
- 根因更接近“动态接口状态刷新不稳定”，而不是保存接口本身完全失效
- 本次已补强：
  - 后端 `/api/*` 动态接口统一返回 `no-store` 禁缓存响应头
  - 前端 `requestJson` 统一使用 `cache: "no-store"`
  - 升级版 AI 配置保存成功后，前端先立即同步本地显示状态，再重新拉取后端真实状态
- 已重新验证：
  - `PUT /api/ai-assistant/config` 可以写入 `.runtime/ai-assistant.config.json`
  - `GET /api/ai-assistant/config` 可以正确返回已保存配置
  - `DELETE /api/ai-assistant/config` 后会恢复为 `template / mock` 模式

## 最近一次阶段 9 AI 问答补充修复

- 已补充支持“当前模型 / 回答模式 / 运行来源”这类助手状态问答
- 这类问题不再默认落到库存总览意图
- 当前 `AI 助手` 会把以下问题识别为助手状态类：
  - `你现在是什么模型`
  - `当前模型`
  - `回答模式`
  - `运行来源`
  - `provider / model / base url`
- 这类问题当前优先使用后端确定答案，不依赖外部模型生成，因此即使升级版模型临时失败，也能稳定回答当前使用中的 `provider / model / source`

- 同时已补充升级版 AI 失败时的可见性：
  - 如果升级版 AI 调用失败，不再只显示“本地模板回答”
  - 页面会额外显示明确的回退原因

- 当前已确认的快跑配置现状：
  - 页面保存的配置会被识别为：
    - `provider = 快跑`
    - `model = gpt-5.4`
    - `baseUrl = https://kuaipao.ai/v1`
  - 但当前这套地址返回的不是可直接解析的标准 OpenAI 兼容回答内容
  - 已通过真实请求确认：
    - 直接请求该地址时，曾返回网页 HTML
    - 兼容 SDK 调用时，也会返回非标准流式文本片段，而不是正常 `choices[0].message.content`
  - 因此当前系统会自动回退模板回答，并提示类似：
    - `当前 Base URL 返回的是网页 HTML，不是 OpenAI 兼容 API`
    - 或 `当前模型接口返回了非标准流式结果，未能解析出回答内容`

- 当前结论必须记住：
  - 你页面上看到“已保存升级版配置”不等于“升级版模型已成功完成回答”
  - 现在网页配置保存链路已经正常
  - 现在问题的重点已经从“保存是否成功”转为“第三方平台接口地址是否真的是标准 OpenAI 兼容 API 地址”

## 最近一次阶段 9 外部大模型接入深化

- 当前方向已明确收敛为：
  - 产品层不绑定“本机 Codex”
  - 升级版 AI 助手继续保持为“通用外部大模型接入”
  - `DeepSeek` 只是官方推荐且更容易直接接通的示例提供商之一

- 本次后端接入层已继续增强为：
  - 保持网页运行时配置 + `.env` + 本地模板三层优先级
  - 对 OpenAI 兼容调用新增双协议兼容尝试：
    - 先走 `chat.completions`
    - 必要时自动尝试 `responses`
  - 对非标准字符串返回、流式文本片段继续做兼容解析
  - 新增外部模型 SDK 超时控制，避免错误地址长时间卡住问答

- 本次前端升级版 AI 助手已补充：
  - 明确说明“支持 DeepSeek 或其他 OpenAI 兼容大模型”
  - 新增 DeepSeek 官方参数快捷示例
  - 页面直接提示官方推荐：
    - `Base URL = https://api.deepseek.com`
    - `Model = deepseek-v4-flash`
    - `Model = deepseek-v4-pro`
  - 页面已提示：
    - `deepseek-chat`
    - `deepseek-reasoner`
    - 将于 `2026-07-24 15:59 UTC` 停止使用
  - 后端已额外兼容：
    - `api.deepseek.com` 不再被错误自动补成 `/v1`
    - 避免 DeepSeek 官方地址因统一规范化逻辑而连错接口

- 本次最新自测结论必须记住：
  - 当前项目依然保留了之前网页里保存的快跑运行时配置
  - 但在本次双协议兼容增强后，当前这套已保存配置已经能够真正返回外部大模型答案
  - 最新源码级自测结果：
    - 问题：`这批货现在还有多少？`
    - 返回：`answerMode = llm`
    - 返回：`provider = 快跑`
    - 返回：`fallbackReason = null`
  - 说明当前阶段 9 已经不只是“保存配置成功”或“显示当前模型”
  - 而是已经具备“真实调用外部大模型并回答业务问题”的能力

- 当前真实限制也必须记住：
  - 现在本机环境变量里还没有 `DEEPSEEK_API_KEY`
  - 所以虽然页面已经提供 DeepSeek 官方快捷参数，但还没有办法在当前机器上直接替你完成 DeepSeek 真连通自测
  - 如果你后续填入自己的 DeepSeek Key，就可以直接验证这条链路

## 当前开发策略提醒

- 长期 ERP 升级地基已经记录进项目记忆
- 未来“独立手机静态扫码端”也已经记录为升级方向
- 但当前工作仍然回到 Demo 主线，不切去做长期部署改造
- 当前应先等待用户验证阶段 13，再决定是否提交当前未提交的 Git 变更

## 下一步应该做什么

- 当前先等待你验证：
  - `报关清关`
- 你确认满意后：
  - 再决定是否提交当前阶段相关 Git 变更
  - 然后进入 `阶段 14：仓储管理增强页面`

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

## 最近一次口径补充：报关清关任务单

- 现有报关清关设计里已经有系统自动生成的“清关/报关任务单”能力，但要始终区分两层：
  - `CustomsClearance.clearanceNo`，例如 `CUS-DEMO-202606-001`，这是清关业务记录 / 清关单
  - `WorkOrder(type = CUSTOMS_CLEARANCE)`，例如 `WO-CUS-DEMO-202606-001`，这是给人执行的清关工单
- 因此当前 `/customs` 页面底部列表里看到的 `CUS-...`，应理解为“清关记录号 / 清关单号”，不是 `WO-...` 工单号
- 后续如果再优化页面文案或字段标题，必须保持这条口径，避免把“清关记录”和“清关工单”混为一谈

## 阶段 15 已完成内容

- 阶段 15 已从占位页升级为真实的“销售与配送”工作台：
  - 前端页面：`http://127.0.0.1:5173/sales`
  - 后端接口：
    - `GET /api/sales/orders`
    - `GET /api/sales/orders/:id`
    - `POST /api/sales/orders/:id/complete-delivery`
- 当前销售页已经支持：
  - 销售单列表
  - 销售单详情抽屉
  - 配送状态展示
  - 签收状态展示
  - 关联合同号 / 批次号 / 出库单 / 配送单展示
  - “模拟配送完成”按钮
  - 配送完成后联动财务待回款状态
- 当前阶段 15 的核心联动规则已经锁定：
  - 配送完成不会改库存
  - 配送完成不会改 `QrItem.status`
  - 库存仍然只认二维码扫码出库的真实结果
  - 配送完成后会把 `SalesOrder` 推进到：
    - `deliveryStatus = DELIVERED`
    - `signStatus = SIGNED`
    - `status = DELIVERED`
  - 如果当前还没有 `DeliveryOrder`，第一次模拟配送完成时会自动补齐一张配送单
  - 财务联动时优先复用已有应收，避免重复造账：
    - 如果已存在合同级 `Receivable` 草稿，则把它推进到待回款状态，不重复创建第二笔
    - 如果不存在任何可复用 `Receivable`，才新建销售级应收
  - 配送完成后会自动生成或刷新 `RECEIVABLE_FOLLOW_UP` 财务回款跟进工单
- 当前销售页会明确显示应收口径：
  - `销售单级应收`
  - 或 `合同级应收草稿`
- 这样做的原因必须记住：
  - 阶段 4 已经允许在“确认生成业务数据”时先生成应收草稿
  - 阶段 15 不能再无条件重复生成第二笔应收
  - 所以当前 Demo 先采用“优先复用已有应收草稿，再推进到待回款”的保守策略

## 阶段 15 自测结果

- 已通过：
  - `npx tsc -p apps/server/tsconfig.json --noEmit`
  - `npx tsc -p apps/web/tsconfig.json --noEmit`
  - `npm run build --workspace @trade-ai-demo/web`
- 已尝试：
  - `npm run build --workspace @trade-ai-demo/server`
  - 结果：未完成
  - 原因：当前本地正在运行的 server / Prisma Client 占用了 `query_engine-windows.dll.node`，导致 `prisma generate` 在 Windows 下触发 `EPERM rename`
  - 结论：后端源码级类型检查已经通过，当前阻塞的是本机运行时文件占用，不是阶段 15 代码本身的 TypeScript 错误
- 已真实验证接口：
  - `GET /api/sales/orders`
  - `GET /api/sales/orders/:id`
  - `POST /api/sales/orders/:id/complete-delivery`
- 已验证当前手动演示数据口径：
  - 当前有 1 张销售单
  - 当前销售单号为 `SO-BAT-DEMO-202606-001`
  - 当前状态保持为：
    - `deliveryStatus = READY`
    - `signStatus = UNSIGNED`
    - `status = READY`
  - 当前应收仍显示为合同级草稿：
    - `scopeLabel = 合同级应收草稿`
    - `status = UNPAID`
- 已做一次受控的“模拟配送完成”真自测，并已在自测后恢复现场：
  - 自测期间成功联动生成：
    - `DeliveryOrder`
    - 财务跟进工单
    - `Receivable.status = PENDING_COLLECTION`
  - 自测完成后已恢复：
    - 销售单状态回到 `READY / UNSIGNED / READY`
    - 删除自测产生的配送单
    - 删除自测产生的财务工单
    - 删除自测产生的阶段 15 审计日志
    - 恢复应收状态为 `UNPAID`
- 这意味着：
  - 阶段 15 的功能链路已经被真实打通
  - 但我没有把自测结果残留在你当前的演示数据里

## 阶段 16 已完成内容

- 阶段 16 已从占位页升级为真实的“财务回款”工作台：
  - 前端页面：`http://127.0.0.1:5173/finance`
  - 后端接口：
    - `GET /api/finance/receivables`
    - `GET /api/finance/receivables/:id`
    - `POST /api/finance/receivables/:id/collect-partial`
    - `POST /api/finance/receivables/:id/collect-full`
- 当前财务页已经支持：
  - 回款 KPI 卡片
  - 应收列表
  - 账期 / 逾期状态展示
  - 核销状态展示
  - 详情抽屉
  - 关联合同 / 销售单 / 批次 / Payment / 财务工单联动展示
  - “模拟部分回款”按钮
  - “模拟全部回款”按钮
- 当前阶段 16 的核心联动规则已经锁定：
  - 财务回款模块优先复用现有 `Receivable`、`Payment`、`Contract`、`WorkOrder`
  - 不额外发明平行账款模型，避免 Demo 前后口径分裂
  - 部分回款后会同步更新：
    - `Receivable.receivedAmount`
    - `Receivable.status`
    - `Payment.receivedAmount`
    - `Payment.status`
    - `Contract.paymentStatus`
    - 关联财务工单 `status / priority`
  - 全部回款后会继续同步：
    - `Payment.receivedAt / paidAt`
    - `Receivable.reconciliationMeta = 可核销`
    - 财务工单推进为 `COMPLETED`
  - 所有回款动作都会写入 `AuditLog`
  - 财务回款不会反向改库存
  - 财务回款不会改 `QrItem.status`
  - 库存口径仍然只认二维码状态与 `StockMovement`
- 当前 Demo 财务口径必须记住：
  - 回款状态是“合同 / 销售执行后的资金结果”
  - 不是“扫码出库一发生就自动视为已回款”
  - 也不是“合同一创建就自动视为已收款”

## 阶段 16 自测结果

- 已通过：
  - `npx tsc -p apps/server/tsconfig.json --noEmit`
  - `npx tsc -p apps/web/tsconfig.json --noEmit`
  - `npm run build --workspace @trade-ai-demo/web`
- 已真实验证接口：
  - `GET /api/finance/receivables`
  - `GET /api/finance/receivables/:id`
  - `POST /api/finance/receivables/:id/collect-partial`
  - `POST /api/finance/receivables/:id/collect-full`
- 已做过一次受控真自测，并已在自测后恢复现场：
  - 对演示应收 `cmq66xcww000lurigt46my9q9` 成功执行“部分回款 -> 全部回款”
  - 已验证 `Receivable / Payment / Contract / WorkOrder / AuditLog` 联动更新正确
  - 自测结束后已恢复到基线状态，并清理自测产生的财务审计日志
  - 恢复后为保证运行中的接口读到最新 SQLite 状态，已重启一次本地后端服务
- 当前恢复后的基线口径为：
  - `pendingCount = 1`
  - `partialCount = 0`
  - `paidCount = 0`
  - `openAmount = 50000 USD`
  - `receivedAmount = 0 USD`
  - `Receivable.status = PENDING_COLLECTION`
  - `Payment.status = UNPAID`
  - `Contract.paymentStatus = UNPAID`
  - 财务工单 `status = PENDING`

## 阶段 17 已完成内容

- 阶段 17 已从骨架页升级为真实的“成本利润”工作台：
  - 前端页面：`http://127.0.0.1:5173/costs`
  - 后端接口：
    - `GET /api/costs/contracts`
    - `GET /api/costs/contracts/:id`
- 当前成本利润页已经支持：
  - 合同级成本利润列表
  - 详情抽屉
  - 多币种成本结构明细
  - 销售金额 / 总成本 / 预计毛利 / 毛利率展示
  - 关联合同 / 批次 / 采购单 / 物流单 / 销售单 / 应收 / Payment 上下文展示
  - 汇率口径展示
  - Demo 测算时间线展示
- 当前阶段 17 的核心口径已经锁定：
  - 优先复用真实 `Contract / Batch / PurchaseOrder / Shipment / SalesOrder / Receivable / Payment`
  - 如果数据库中尚未录入 `CostItem`，则自动套用 Demo 演示测算模板
  - Demo 模板会输出 6 类成本项：
    - 采购成本
    - 国际运费
    - 清关费
    - 仓储费
    - 本地配送费
    - 杂费
  - Demo 模板采用多币种结构展示：
    - 合同币种
    - `CNY`
    - `ZMW`
  - 当前默认演示合同 `50000 USD` 会得到：
    - 总成本 `38000 USD`
    - 预计毛利 `12000 USD`
    - 毛利率 `24%`
  - 这一页当前只做测算展示，不会写入库存，也不会改 `QrItem`、`StockMovement`、`Receivable` 或 `Payment`
- 当前页面必须始终明确标注：
  - `成本利润为 Demo 演示数据，正式版将按真实费用单据和财务规则核算。`

## 阶段 17 自测结果

- 已通过：
  - `npx tsc -p apps/server/tsconfig.json --noEmit`
  - `npx tsc -p apps/web/tsconfig.json --noEmit`
  - `npm run build --workspace @trade-ai-demo/web`
- 已真实验证接口：
  - `GET /api/costs/contracts`
  - `GET /api/costs/contracts/:id`
- 已验证当前演示合同测算结果：
  - `销售金额 = 50000 USD`
  - `总成本 = 38000 USD`
  - `预计毛利 = 12000 USD`
  - `毛利率 = 24%`
  - 折算人民币口径：
    - `销售金额 = 360000 CNY`
    - `总成本 = 273600 CNY`
    - `预计毛利 = 86400 CNY`
- 已验证当前多币种成本结构明细包含：
  - `USD`
  - `CNY`
  - `ZMW`
- 当前阶段 17 为只读展示阶段：
  - 本次没有新增任何写入型业务接口
  - 本次没有改动库存、二维码或财务实收状态
  - 成本项未落库时仅由后端接口按 Demo 模板实时计算返回

## 阶段 18 已完成内容

- 阶段 18 已从骨架页升级为真实的“多公司主体”展示页：
  - 前端页面：`http://127.0.0.1:5173/companies`
  - 后端接口：
    - `GET /api/companies/organization`
    - `GET /api/companies/organization/:id`
- 当前多公司主体页已经支持：
  - 5 家演示主体列表
  - 组织结构汇总卡片
  - 主体详情抽屉
  - 公司职责说明
  - 部门列表
  - 演示账号列表
  - 覆盖模块展示
  - 业务承接快照展示
  - 正式版权限隔离说明
- 当前阶段 18 的核心口径已经锁定：
  - 第一版只做组织结构展示，不做真实权限隔离
  - 页面明确展示 5 家主体：
    - 境内公司：采购、境内集货
    - 香港公司：资金、结算
    - 新加坡公司：资金、结算
    - 赞比亚公司：销售、仓储、清关、物流
    - 刚果金公司：销售、仓储、清关、物流
  - 页面会始终明确标注：
    - `正式版会按公司、国家、岗位进行权限隔离。`
    - `Demo 版只展示组织结构和职责分工。`
  - 当前页面优先复用真实 `Company / Department / User` 底座数据
  - 再结合演示版业务上下文，补充主体角色定位、覆盖模块与业务快照说明
  - 本阶段为只读展示，不新增写入型业务动作

## 阶段 18 自测结果

- 已通过：
  - `npx tsc -p apps/server/tsconfig.json --noEmit`
  - `npx tsc -p apps/web/tsconfig.json --noEmit`
  - `npm run build --workspace @trade-ai-demo/web`
- 已真实验证接口：
  - `GET /api/companies/organization`
  - `GET /api/companies/organization/:id`
- 已验证当前组织结构口径：
  - `totalCompanies = 5`
  - `operatingCompanies = 3`
  - `settlementCompanies = 2`
  - `departments = 6`
  - `demoUsers = 1`
- 已验证详情接口可返回赞比亚主体的：
  - 清关部 / 仓库部 / 销售部
  - 覆盖模块：报关清关、仓储管理、销售与配送、二维码追溯
  - 业务快照：`customs = 1`、`warehouses = 1`
- 当前阶段 18 为只读展示阶段：
  - 本次没有新增任何写入型业务接口
  - 本次没有改动库存、二维码、财务或单据状态
  - 本次只新增组织结构展示与正式版权限隔离说明

## 当前下一步

- 当前已完成：
  - `多公司主体`
- 当前下一步：
  - 进入 `阶段 19：自动工单展示模块`
- 后续仍需保持：
  - 一次只做一个大环节
  - 完成后先自测
  - 更新 `PROJECT_MEMORY.md` 与 `TODO.md`
  - 再等你确认后提交 Git
