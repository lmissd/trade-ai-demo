# 公司一体化项目长期开发记忆：ERP 升级地基设计原则

> 本文件作为公司一体化项目的长期开发记忆，用于指导 Codex 在后续开发 demo、扩展功能、重构代码、设计数据库和接口时，始终保留未来升级为成熟 ERP 系统的基础能力。

---

## 1. 项目当前定位

当前项目处于 demo 开发阶段，目标不是一次性做成完整 ERP，而是先跑通核心业务闭环：

```text
单据上传 → AI 识别 → 人工确认 → 生成合同 / 批次 → 二维码 → 仓储扫码入库 / 出库 → 业务追溯
```

但是 demo 阶段不能只追求“能跑”，必须提前保留未来升级为多人协同、真实大数据量、企业级 ERP 的基础设计。

核心原则：

```text
功能可以先简单，但数据结构、状态流转、权限边界、操作日志、业务追溯不能随意。
```

---

## 2. 总体开发原则

后续所有开发必须遵守以下原则：

1. 不要为了 demo 方便而写死业务逻辑。
2. 不要让前端直接决定核心业务状态。
3. 不要让 AI 识别结果直接变成正式业务数据。
4. 所有正式业务生成动作必须经过人工确认。
5. 所有关键业务表必须保留状态字段和审计字段。
6. 所有关键操作必须可追溯：谁、什么时候、对什么数据、做了什么。
7. 所有核心接口要考虑未来多人访问、并发操作、防重复提交。
8. 文件、图片、PDF 等附件不要直接塞进数据库，只保存文件路径和元数据。
9. 所有列表接口必须预留分页、筛选、排序能力。
10. 数据表设计要优先服务未来扩展，而不是只服务当前页面。

---

## 3. AI 识别与正式业务数据必须分离

必须明确区分三类数据：

```text
原始单据文件
AI 识别结果
人工确认后生成的正式业务数据
```

AI 识别结果只是“草稿 / 候选数据”，不能直接作为正式合同、批次、库存数据。

推荐业务链路：

```text
上传单据 Document
→ AI 识别 DocumentRecognitionResult
→ 人工确认 ConfirmedDocumentData
→ 生成正式业务 Contract / Batch / Inventory / ScanLog
```

必须保留：

```text
原始文件
识别结果
人工修改记录
确认人
确认时间
生成的业务记录 ID
生成状态
失败原因
```

---

## 4. 核心业务表必须保留的基础字段

所有核心业务表建议至少包含以下字段：

```text
id
createdAt
updatedAt
createdBy
updatedBy
status
isDeleted
deletedAt
deletedBy
voidReason
remark
```

对于由单据识别生成的业务数据，还应保留：

```text
sourceDocumentId
sourceRecognitionId
businessCreated
businessCreatedAt
businessCreatedBy
```

说明：

- `status` 用于业务状态流转。
- `isDeleted` 用于软删除，不建议直接物理删除核心业务数据。
- `voidReason` 用于记录作废、撤销、删除原因。
- `businessCreated` 用于标记识别结果是否已经生成正式业务，避免重复生成。
- `sourceDocumentId` 用于从正式业务追溯到原始单据。

---

## 5. 软删除与作废原则

成熟 ERP 中，核心业务数据不能随便物理删除。

以下数据建议默认使用软删除或作废：

```text
Document
RecognitionResult
Contract
Batch
InboundOrder
OutboundOrder
InventoryRecord
ScanLog
```

删除或作废时必须记录：

```text
isDeleted = true
deletedAt
deletedBy
voidReason
```

如果数据已经被后续业务引用，例如：

```text
合同已生成批次
批次已入库
库存已变化
财务已引用
扫码记录已产生
```

则原则上不能直接删除，只能作废、撤销或通过反向业务单据冲正。

---

## 6. 状态流转设计原则

每个核心业务对象都应该有明确状态，而不是只用 true / false 判断。

示例：单据 Document 状态：

```text
uploaded          已上传
recognizing       识别中
recognized        已识别
confirmed         已确认
business_created  已生成业务
voided            已作废
failed            失败
```

示例：合同 Contract 状态：

```text
draft       草稿
active      生效
voided      作废
completed   完成
```

示例：批次 Batch 状态：

```text
created       已创建
inbounding    入库中
inbounded     已入库
outbounding   出库中
outbounded    已出库
voided        已作废
```

状态流转必须由后端控制，前端只能发起动作请求，不能直接修改最终状态。

---

## 7. 合同、批次、库存、扫码之间的关系

业务关系要清晰，不能只靠页面展示拼接。

推荐关系：

```text
Document 1 → N RecognitionResult
RecognitionResult 1 → 0/1 Contract
Contract 1 → N Batch
Batch 1 → N InventoryRecord
Batch 1 → N ScanLog
Warehouse 1 → N InventoryRecord
User 1 → N OperationLog
```

二维码应绑定明确业务对象，例如：

```text
batchId
warehouseId
operationType: inbound / outbound
qrType: batch / item / inbound / outbound
```

扫码时必须由后端校验：

```text
二维码类型是否正确
当前操作模式是否匹配
批次状态是否允许操作
是否重复扫码
是否属于当前仓库
当前用户是否有权限
```

---

## 8. 二维码和仓储扫码防呆原则

入库和出库必须防止工人扫错。

设计原则：

1. 入库码和出库码必须在数据层明确区分。
2. 二维码 payload 中必须包含 `qrType` 和 `operationType`。
3. 前端扫码页面必须显示当前模式：入库 / 出库 / 查询。
4. 扫码后必须二次明确提示当前动作。
5. 后端不能只相信二维码内容，必须结合批次状态和用户权限校验。
6. 同一个入库动作或出库动作必须防重复。
7. 重复扫码时应提示“已入库 / 已出库”，不能重复改变库存。
8. 错误类型要清晰提示：扫错码、状态不允许、无权限、仓库不匹配、重复扫码。

推荐扫码记录 ScanLog 字段：

```text
id
batchId
warehouseId
userId
qrCodeId
operationType
scanResult
failureReason
scannedAt
clientDevice
createdAt
```

---

## 9. 多人访问与权限设计预留

即使 demo 阶段只有一个人用，也要预留多人系统设计。

至少预留以下角色：

```text
admin        管理员
sales        业务员
warehouse    仓库员
finance      财务
auditor      审核员
readonly     只读用户
```

权限原则：

```text
业务员可以上传单据、确认识别结果、生成合同和批次
仓库员只能扫码入库 / 出库，不能改合同金额
财务可以查看金额和结算相关数据
审核员可以审核和作废部分业务
只读用户只能查看，不能修改
管理员负责用户、权限、配置管理
```

接口必须预留 `currentUser` 概念，关键操作必须记录操作人。

---

## 10. 并发与防重复提交原则

未来多人同时访问时，必须防止数据错乱。

以下场景必须考虑：

```text
同一张单据重复生成业务
两个用户同时确认同一识别结果
两个仓库员同时扫描同一批次
同一二维码被重复扫码
库存同时增加或减少
合同号 / 批次号重复生成
```

后端应使用：

```text
数据库事务
唯一约束
状态校验
幂等接口
乐观锁或版本号
必要时使用行级锁
```

关键原则：

```text
要么全部成功，要么全部回滚。
不能出现合同生成了但批次没生成，或者库存变化了但扫码日志没写入的情况。
```

---

## 11. 数据库设计原则

demo 阶段可以先快速开发，但未来应支持升级到 PostgreSQL 或 MySQL。

推荐正式 ERP 阶段优先使用：

```text
PostgreSQL
```

原因：

```text
事务能力强
复杂查询能力强
JSON 字段支持好
适合业务系统扩展
```

数据库设计必须预留索引，重点字段包括：

```text
contractNo
batchNo
documentNo
containerNo
warehouseId
status
createdAt
businessCreated
isDeleted
sourceDocumentId
sourceRecognitionId
```

所有列表查询必须支持：

```text
分页
筛选
排序
关键词搜索
时间范围过滤
状态过滤
```

不要一次性查询全部数据。

---

## 12. 附件与文件存储原则

单据图片、PDF、识别附件等文件不要直接存入数据库。

推荐方式：

```text
文件保存在本地文件系统 / 对象存储 / 私有存储服务
数据库只保存文件元数据
```

文件元数据建议包括：

```text
id
fileName
originalName
filePath
fileType
mimeType
fileSize
fileHash
uploadedBy
uploadedAt
relatedBusinessType
relatedBusinessId
```

`fileHash` 可用于判断重复上传。

---

## 13. 操作日志与审计原则

成熟 ERP 必须知道每个关键数据是怎么来的、谁改过、为什么改。

建议建立 OperationLog 表，记录：

```text
id
userId
action
module
businessType
businessId
beforeData
afterData
reason
ip
userAgent
createdAt
```

需要记录日志的操作包括：

```text
上传单据
AI 识别完成
人工确认识别结果
生成合同
生成批次
作废单据
删除单据
扫码入库
扫码出库
库存调整
权限变更
用户登录失败
```

---

## 14. 后端接口设计原则

接口应按照业务模块组织，不要全部堆在一个文件中。

推荐模块：

```text
auth          用户登录与鉴权
users         用户管理
roles         角色权限
documents     单据上传与识别
recognition   AI 识别结果
contracts     合同
batches       批次
warehouse     仓库
inventory     库存
scan          扫码入库 / 出库
logs          操作日志
reports       报表统计
settings      系统配置
```

接口设计原则：

```text
前端发起动作
后端校验权限
后端校验状态
后端执行事务
后端写入日志
后端返回明确结果
```

不要让前端直接传入最终状态并保存。

---

## 15. 前端设计原则

demo 阶段页面可以简单，但要预留成熟 ERP 的使用习惯。

前端列表页面应预留：

```text
分页
搜索
状态筛选
时间筛选
详情页
操作按钮权限控制
异常提示
导入导出入口
```

扫码页面必须重点防呆：

```text
明显显示当前模式：入库 / 出库
扫码后显示货物 / 批次摘要
错误扫码强提示
重复扫码强提示
操作成功后给出明确反馈
```

前端只能控制显示和交互，关键业务状态必须以后端判断为准。

---

## 16. 测试与异常场景记忆

后续开发功能时，必须主动测试异常场景。

重点测试：

```text
重复上传同一单据
AI 识别字段为空
AI 识别字段错误
人工修改识别结果
重复生成合同
重复生成批次
合同编号重复
批次编号重复
同一个二维码重复入库
同一个二维码重复出库
入库码在出库页面被扫描
出库码在入库页面被扫描
非仓库员尝试扫码
已作废批次尝试入库
已出库货物再次出库
删除已生成业务的单据
网络中断后重复提交
```

---

## 17. 未来升级路线记忆

项目升级路线建议如下：

```text
阶段 1：Demo 阶段
跑通核心闭环：单据识别 → 人工确认 → 合同 / 批次 → 二维码 → 入库 / 出库

阶段 2：内部试用阶段
增加用户登录、权限、操作日志、软删除、状态流转、防重复提交

阶段 3：小规模企业使用阶段
升级正式数据库、服务器部署、自动备份、并发控制、报表导出

阶段 4：成熟 ERP 阶段
增加审批流、财务模块、多仓库、多角色、多组织、数据看板、外部系统对接

阶段 5：平台化阶段
支持多租户、SaaS、客户独立空间、计费、运维监控、自动扩容
```

---

## 18. Codex 开发时必须遵守的执行要求

每次新增功能、修改功能、重构代码时，Codex 必须检查：

```text
是否破坏了现有业务链路
是否保留了 createdAt / updatedAt / status / isDeleted 等基础字段
是否需要记录操作日志
是否需要权限校验
是否需要事务
是否需要防重复提交
是否需要软删除而不是物理删除
是否需要从正式业务追溯到原始单据
是否需要支持未来多人访问
是否需要分页和索引
```

如果当前 demo 暂时不实现某项能力，也要在代码结构、字段或 TODO 中预留升级空间。

---

## 19. 最重要的长期原则

```text
不要只为当前 demo 写代码。
要为未来升级成真正 ERP 留地基。
```

具体来说：

```text
功能可以先做最小版；
字段可以先不用完；
权限可以先简化；
日志可以先基础记录；
但数据结构、业务边界、状态流转、追溯关系不能乱。
```

本文件应作为公司一体化项目的长期开发约束，后续 Codex 在执行任何开发任务前，都应优先参考本记忆文件。
