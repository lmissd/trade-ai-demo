# 国际贸易一物一码 + AI 单据识别 Demo 第一版设计方案

## 0. 项目目标

本项目不是完整企业级系统，而是用于向甲方展示核心价值的第一版 Demo。

第一版默认演示场景为：

```text
中国采购 100 箱货
→ 发往赞比亚仓库
→ 上传合同和箱单
→ AI 识别信息
→ 生成 100 个二维码
→ 手机扫码入库
→ 销售出库 20 箱
→ 库存剩余 80 箱
→ 老板问 AI：这批货现在还有多少？
```

重要补充：

- 上述 `100 箱 / 赞比亚仓库 / 出库 20 箱 / 剩余 80 箱` 只是第一版默认演示值，不允许在代码中完全写死。
- 系统设计必须支持后续通过“配置或表单”修改以下演示数据：
  - 商品名称
  - 客户名称
  - 供应商名称
  - 目的仓库
  - 总数量
  - 单位
  - 出库数量
  - 合同金额
  - 币种
- 默认演示场景仍使用上述数值，但运行时应基于当前配置或用户确认后的表单数据生成合同、批次、二维码和库存结果。
- 库存剩余数量必须由系统根据真实二维码状态实时计算，不能在前端、后端或 AI 模板里直接写死为 80。

第一版 Demo 的目标是跑通一条最小业务闭环：

```text
单据上传
→ AI 识别
→ 生成合同与批次草稿
→ 人工确认
→ 生成二维码
→ 手机扫码入库
→ 手机扫码出库
→ 库存变化
→ AI 查询库存
```

## 1. 最重要开发原则

### 1.1 只做第一版 Demo，不做完整系统

第一版不要做：

- 完整 ERP
- 完整财务系统
- 多公司复杂权限
- 多仓库复杂调拨
- 完整成本利润分摊
- 复杂审批流
- 原生 App
- PDA 专用程序
- 海关/物流/财务系统对接

第一版只做：

- 合同和箱单上传
- AI 字段识别
- 合同/批次基础数据
- 100 个二维码生成
- 手机网页扫码入库
- 手机网页扫码出库
- 库存自动增减
- 简单回款记录
- 首页看板
- AI 问答查询库存

### 1.2 Codex 每次只做一个环节

Codex 不允许一次性完成全部功能。

每次工作流程必须是：

```text
读取设计方案
→ 读取 TODO
→ 选择当前未完成的第一个任务
→ 只实现这一个任务
→ 自测
→ 更新本地记忆文件
→ 更新 TODO 勾选状态
→ git commit
→ git push
→ 停下来等待用户确认
```

没有用户确认，不进入下一环节。

### 1.3 每次大环节必须更新本地记忆

每完成一个大环节，必须更新：

```text
docs/PROJECT_MEMORY.md
docs/TODO.md
```

`PROJECT_MEMORY.md` 用于记录：

- 当前已完成什么
- 做了哪些关键技术选择
- 新增了哪些页面
- 新增了哪些接口
- 新增了哪些数据表
- 遇到什么问题
- 下一步要做什么
- 本次 git commit hash

### 1.4 每个环节完成后必须做 Git 版本控制

每完成一个环节，必须执行：

```bash
git status
git add .
git commit -m "feat: 完成xxx环节"
git push
```

如果本地还没有初始化 git，则先：

```bash
git init
git add .
git commit -m "chore: 初始化项目"
```

如果没有配置 GitHub remote，不要假装已经推送，必须暂停并提示用户：

```text
当前项目没有 GitHub remote，请提供 GitHub 仓库地址，或先在 GitHub 创建仓库后再继续。
```

### 1.5 演示数据必须可配置，库存结果必须动态计算

第一版虽然默认演示：

```text
100 箱
赞比亚仓库
出库 20 箱
库存剩余 80 箱
```

但系统实现必须遵守：

- 默认值只用于初始化演示，不作为代码常量写死在业务逻辑中。
- AI 识别结果是“草稿”，前端必须允许用户确认前修改关键字段。
- 合同、批次、二维码数量、扫码辅助按钮、首页看板、AI 回答，都必须读取当前确认后的真实数据。
- 库存剩余值必须来自 `QrItem` 当前状态统计，不能通过 `总数量 - 固定 20` 或直接返回 `80` 得出。
- Demo 辅助功能如果提供“批量入库 / 批量出库”，也必须读取当前批次数量或用户输入数量，不能固定写成 100 和 20。

---

## 2. 推荐技术栈

为了最快做出可演示版本，建议使用 Web 系统 + 手机浏览器扫码。

| 模块 | 技术选择 | 说明 |
|---|---|---|
| 前端 | React + Vite + TypeScript | 开发快，适合 Demo 和后台系统 |
| UI | Ant Design | 表格、表单、弹窗、上传组件现成 |
| 后端 | Node.js + Express + TypeScript | 接口简单，方便接 AI |
| 数据库 | SQLite 第一版 / PostgreSQL 第二版 | Demo 先用 SQLite，后续可换 PostgreSQL |
| ORM | Prisma | 建表和数据访问简单 |
| 二维码生成 | qrcode / node-qrcode | 根据货物编号生成二维码 |
| 手机扫码 | html5-qrcode | 手机浏览器直接调用摄像头扫码 |
| 文件上传 | multer | 上传合同、箱单等文件 |
| AI 接口 | OpenAI / DeepSeek / 通义千问 / 豆包，先抽象 Provider | 第一版可先 mock，后续接真实 API |
| 图表 | ECharts 或 Ant Design Statistic | 首页看板展示库存、入库、出库 |
| 版本控制 | Git + GitHub | 每个环节完成后提交和推送 |

### 2.1 推荐目录结构

```text
trade-ai-demo/
├── README.md
├── package.json
├── .gitignore
├── .env.example
├── docs/
│   ├── PROJECT_DESIGN.md
│   ├── TODO.md
│   ├── PROJECT_MEMORY.md
│   └── API.md
├── apps/
│   ├── web/
│   │   ├── package.json
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── api/
│   │       ├── pages/
│   │       ├── components/
│   │       └── routes/
│   └── server/
│       ├── package.json
│       ├── prisma/
│       │   └── schema.prisma
│       └── src/
│           ├── index.ts
│           ├── routes/
│           ├── services/
│           ├── controllers/
│           └── utils/
├── uploads/
└── generated_qr/
```

---

## 3. 第一版 Demo 用户故事

### 3.1 业务负责人视角

我打开系统后，可以：

1. 上传合同和箱单；
2. 点击 AI 识别，系统自动提取合同号、客户、商品、数量、金额、目的地；
3. 确认 AI 识别结果，并可人工修改商品、客户、供应商、目的仓、数量、单位、金额、币种等关键字段；
4. 系统生成合同和货物批次；
5. 系统根据当前确认后的数量生成对应数量的二维码，默认演示为 100 个；
6. 我可以下载或查看二维码；
7. 仓库人员用手机扫码入库；
8. 销售出库当前设定数量的货物，默认演示为 20 箱，仓库人员扫码出库；
9. 首页看板显示按真实库存计算得到的剩余数量，默认演示为 80 箱；
10. 老板在 AI 问答里问“这批货现在还有多少？”，系统回答当前真实剩余数量，默认演示为“当前剩余 80 箱”。

### 3.2 仓库人员视角

我用手机打开扫码页面，可以：

1. 选择“扫码入库”；
2. 扫描货物二维码；
3. 系统显示货物信息；
4. 点击确认入库；
5. 系统记录入库时间、操作人、状态；
6. 选择“扫码出库”；
7. 扫描在库二维码；
8. 点击确认出库；
9. 系统自动扣减库存。

### 3.3 老板视角

我打开首页，可以看到：

- 总批次数
- 当前库存总数
- 已入库数量
- 已出库数量
- 未回款合同数量

我打开 AI 问答，可以问：

- 这批货现在还有多少？
- HT202606001 合同还有多少库存？
- 今天入库了多少箱？
- 今天出库了多少箱？
- 哪些合同还没有回款？

---

## 4. 第一版页面设计

### 4.1 首页看板 `/dashboard`

展示：

- 合同数量
- 批次数量
- 当前库存总数
- 已入库数量
- 已出库数量
- 未回款合同数量
- 最近扫码记录
- 最近上传单据

页面重点：甲方一打开就看到系统能管库存和状态。

### 4.2 单据上传页 `/documents`

功能：

- 上传合同文件
- 上传箱单文件
- 显示上传记录
- 点击“AI 识别”
- 显示 AI 识别出的字段
- 允许人工修改 AI 草稿字段：商品名称、客户名称、供应商名称、目的仓库、总数量、单位、合同金额、币种
- 点击“确认生成合同与批次草稿”

第一版允许上传：

- PDF
- JPG/PNG
- DOC/DOCX
- XLS/XLSX

如果 AI 接口暂时不可用，必须提供 mock 识别结果，保证 Demo 能跑通。

### 4.3 合同管理页 `/contracts`

字段：

- 合同编号
- 客户名称
- 供应商名称
- 商品名称
- 数量
- 单位
- 金额
- 币种
- 目的地
- 回款状态
- 创建时间

功能：

- 查看合同列表
- 查看合同详情
- 手动新增合同
- 从 AI 识别结果生成合同

### 4.4 货物批次页 `/batches`

字段：

- 批次号
- 合同编号
- 商品名称
- 总数量
- 单位
- 已生成二维码数量
- 目的仓库
- 状态

功能：

- 创建批次
- 查看批次详情
- 点击生成二维码
- 查看该批次下所有二维码货物

### 4.5 二维码管理页 `/qr-items`

字段：

- 二维码编号
- 批次号
- 合同号
- 商品名称
- 当前状态：待入库 / 已入库 / 已出库
- 当前仓库
- 入库时间
- 出库时间

功能：

- 查看二维码列表
- 按批次筛选
- 按状态筛选
- 查看单个二维码图片
- 批量导出二维码图片或 PDF

### 4.6 手机扫码页 `/scan`

页面必须适合手机打开。

功能：

- 选择操作类型：入库 / 出库
- 调用手机摄像头扫码
- 显示扫码结果
- 展示货物信息
- 点击确认
- 更新货物状态和库存
- Demo 辅助操作若提供批量入库/出库，数量必须来自当前批次数量或用户输入，而不是固定常量

入库规则：

```text
只有状态为“待入库”的二维码可以入库。
已经入库或已出库的二维码不能重复入库。
```

出库规则：

```text
只有状态为“已入库”的二维码可以出库。
待入库或已出库的二维码不能出库。
```

### 4.7 库存页 `/inventory`

展示：

- 商品名称
- 批次号
- 合同号
- 仓库
- 总数量
- 待入库数量
- 已入库数量
- 已出库数量
- 当前库存数量

当前库存计算逻辑：

```text
当前库存 = 已入库数量 - 已出库数量
```

并且必须基于真实 `QrItem` 状态实时统计，不能在接口或页面中缓存写死“剩余 80 箱”。

### 4.8 回款记录页 `/payments`

第一版只做简单字段：

- 合同编号
- 应收金额
- 已收金额
- 币种
- 回款状态：未回款 / 部分回款 / 已回款
- 回款时间

### 4.9 AI 问答页 `/ai-assistant`

第一版支持固定问题类型：

- 查询某合同库存
- 查询某批次库存
- 查询今日入库数量
- 查询今日出库数量
- 查询未回款合同
- 查询某二维码生命周期

AI 问答实现原则：

```text
AI 不能直接查询数据库。
后端先识别问题意图，再调用受控接口查询数据库。
查询到真实数据后，再让 AI 生成自然语言回答。
如果 AI 不可用，使用模板回答。
```

---

## 5. 数据库设计第一版

### 5.1 User 用户表

```text
id
name
role
createdAt
updatedAt
```

第一版可不做复杂登录，默认一个演示用户即可。

### 5.2 Document 单据表

```text
id
type              // contract, packing_list, bill_of_lading, invoice
fileName
filePath
aiStatus          // pending, extracted, failed
extractedJson
createdAt
updatedAt
```

`extractedJson` 第一版至少要支持输出：

```json
{
  "contractNo": "HT202606001",
  "customerName": "ABC Trading Zambia",
  "supplierName": "China Supplier Co., Ltd.",
  "productName": "Demo Goods",
  "quantity": 100,
  "unit": "箱",
  "amount": 50000,
  "currency": "USD",
  "destination": "Zambia Warehouse",
  "batchNo": "BATCH202606001"
}
```

### 5.3 Contract 合同表

```text
id
contractNo
customerName
supplierName
productName
quantity
unit
amount
currency
destination
paymentStatus     // unpaid, partial, paid
createdAt
updatedAt
```

### 5.4 Batch 批次表

```text
id
batchNo
contractId
productName
totalQuantity
unit
destinationWarehouse
status             // draft, qr_generated, inbounding, in_stock, partially_outbound, completed
createdAt
updatedAt
```

### 5.5 QrItem 二维码货物表

```text
id
qrCode
batchId
contractId
productName
status             // pending_inbound, in_stock, outbound
warehouse
inboundAt
outboundAt
createdAt
updatedAt
```

### 5.10 DemoScenarioConfig 演示场景配置（可选实现）

为了避免把默认演示数据写死在业务代码中，第一版设计允许增加一个演示配置来源。该来源可以是配置文件、种子数据，或独立数据表。

如果落表，可参考字段：

```text
id
scenarioName
productName
customerName
supplierName
destinationWarehouse
totalQuantity
unit
plannedOutboundQuantity
amount
currency
isDefault
updatedAt
```

说明：

- 第一版不强制必须单独建表，但必须保留“可配置”设计空间。
- 后端 mock 数据、前端默认表单值、批量演示按钮，都应该从同一演示配置来源读取默认值。

### 5.6 Inventory 库存表

第一版可以用视图或接口实时统计，不一定单独存表。

建议先通过 QrItem 状态统计库存：

```text
pendingInboundCount = status = pending_inbound
inStockCount = status = in_stock
outboundCount = status = outbound
```

### 5.7 StockMovement 库存流水表

```text
id
qrItemId
batchId
contractId
type               // inbound, outbound
fromStatus
toStatus
operatorName
warehouse
createdAt
```

### 5.8 Payment 回款表

```text
id
contractId
receivableAmount
receivedAmount
currency
paymentStatus      // unpaid, partial, paid
paidAt
createdAt
updatedAt
```

### 5.9 AiLog AI 调用日志表

```text
id
scenario           // document_extract, qa, work_order
inputText
outputText
parsedJson
createdAt
```

---

## 6. 后端 API 第一版

### 6.1 单据接口

```text
POST   /api/documents/upload
GET    /api/documents
POST   /api/documents/:id/extract
POST   /api/documents/:id/confirm
```

`POST /api/documents/:id/confirm` 设计要求：

- 不直接使用写死 mock 值落库。
- 应接收用户确认后的表单字段，再由后端校验并写入合同与批次。

### 6.2 合同接口

```text
GET    /api/contracts
POST   /api/contracts
GET    /api/contracts/:id
PATCH  /api/contracts/:id
```

### 6.3 批次接口

```text
GET    /api/batches
POST   /api/batches
GET    /api/batches/:id
POST   /api/batches/:id/generate-qr
```

### 6.4 二维码接口

```text
GET    /api/qr-items
GET    /api/qr-items/:qrCode
GET    /api/qr-items/:qrCode/image
```

### 6.5 扫码出入库接口

```text
POST   /api/scan/inbound
POST   /api/scan/outbound
GET    /api/stock-movements
```

入库请求：

```json
{
  "qrCode": "QR202606070001",
  "operatorName": "demo-user",
  "warehouse": "Zambia Warehouse"
}
```

出库请求：

```json
{
  "qrCode": "QR202606070001",
  "operatorName": "demo-user",
  "warehouse": "Zambia Warehouse"
}
```

说明：

- `warehouse` 必须来自当前批次或当前确认后的演示配置，不能写死为 `Zambia Warehouse`。
- 如果实现 Demo 辅助批量出库，应支持传入可配置出库数量，默认值可以是 20。

### 6.6 库存接口

```text
GET    /api/inventory/summary
GET    /api/inventory/by-batch/:batchId
GET    /api/inventory/by-contract/:contractId
```

### 6.7 回款接口

```text
GET    /api/payments
POST   /api/payments
PATCH  /api/payments/:id
```

### 6.8 AI 问答接口

```text
POST   /api/ai/ask
```

请求：

```json
{
  "question": "这批货现在还有多少？"
}
```

返回：

```json
{
  "answer": "当前该批次总数量为 100 箱，已出库 20 箱，剩余库存 80 箱。"
}
```

---

## 7. AI 接入设计

### 7.1 第一阶段允许 Mock

为了保证 Demo 进度，AI 接口第一阶段可以先做 mock。

当用户上传合同或箱单后，点击 AI 识别，返回固定示例：

```json
{
  "contractNo": "HT202606001",
  "customerName": "ABC Trading Zambia",
  "supplierName": "China Supplier Co., Ltd.",
  "productName": "Demo Goods",
  "quantity": 100,
  "unit": "箱",
  "amount": 50000,
  "currency": "USD",
  "destination": "Zambia Warehouse",
  "batchNo": "BATCH202606001"
}
```

补充要求：

- 以上示例只是默认 mock 返回值，不允许直接散落写死在多个路由、多个页面中。
- 最好统一从一个演示场景配置源生成 mock 识别结果和默认表单值。

### 7.2 后续接真实大模型

真实 AI 调用由后端统一封装：

```text
services/aiService.ts
```

不要在前端直接调用大模型 API。

`.env` 中配置：

```text
AI_PROVIDER=openai
AI_API_KEY=xxxx
AI_MODEL=xxxx
```

### 7.3 AI 不能直接修改数据库

AI 只能输出结构化草稿。

所有写入数据库动作必须经过：

```text
AI 输出
→ 前端展示
→ 用户确认
→ 后端校验
→ 写入数据库
```

---

## 8. 关键业务规则

### 8.1 二维码生成规则

批次数量为 `totalQuantity`，则生成 `totalQuantity` 条 `QrItem`。

默认演示场景下 `totalQuantity = 100`，因此默认生成 100 条。

二维码编号格式：

```text
QR + 年月日 + 4位序号
示例：QR202606070001
```

每个二维码唯一。

### 8.2 入库规则

允许入库：

```text
status = pending_inbound
```

不允许入库：

```text
status = in_stock
status = outbound
```

入库成功后：

```text
QrItem.status = in_stock
QrItem.inboundAt = 当前时间
生成 StockMovement(type = inbound)
```

### 8.3 出库规则

允许出库：

```text
status = in_stock
```

不允许出库：

```text
status = pending_inbound
status = outbound
```

出库成功后：

```text
QrItem.status = outbound
QrItem.outboundAt = 当前时间
生成 StockMovement(type = outbound)
```

### 8.4 库存统计规则

```text
总数量 = QrItem 总数
待入库 = pending_inbound 数量
当前库存 = in_stock 数量
已出库 = outbound 数量
```

演示目标：

```text
生成 100 个二维码
扫码入库 100 个
扫码出库 20 个
库存显示 80 个
```

补充说明：

- 上述目标是默认演示口径，不是固定常量。
- 当 `totalQuantity`、`plannedOutboundQuantity` 或单位变化时，首页、库存页、AI 回答都必须跟着真实数据变化。

---

## 9. 演示脚本

向甲方演示时按照以下顺序。若未特别修改演示配置，默认使用 100 箱 / 赞比亚仓 / 出库 20 箱场景：

### 9.1 上传单据

打开单据上传页，上传合同和箱单。

点击 AI 识别。

系统显示：

```text
合同号：HT202606001
客户：ABC Trading Zambia
供应商：China Supplier Co., Ltd.
商品：Demo Goods
数量：100 箱
金额：50000 USD
目的地：Zambia Warehouse
```

如用户在确认页修改了数量、单位、金额、仓库等字段，则后续所有页面与结果必须使用修改后的值。

### 9.2 生成合同和批次

点击确认，系统生成：

```text
合同：HT202606001
批次：BATCH202606001
数量：100 箱
目的仓：Zambia Warehouse
```

### 9.3 生成二维码

进入批次详情，点击生成二维码。

系统按当前确认数量生成二维码。默认场景下生成 100 个二维码。

### 9.4 手机扫码入库

打开手机扫码页。

选择“入库”。

扫码若干个二维码，系统显示入库成功。

为了演示方便，可以提供“模拟批量入库当前批次全部货物”按钮，但要标注为 Demo 辅助功能，数量必须从当前批次读取。

### 9.5 销售出库 20 箱

选择“出库”。

扫码 20 个二维码，系统显示出库成功。

为了演示方便，可以提供“模拟批量出库”按钮，但要标注为 Demo 辅助功能，出库数量必须支持读取当前配置或由用户输入。默认演示为 20 箱。

### 9.6 查看库存

打开库存页，看到：

```text
总数量：100
已入库：100
已出库：20
当前库存：80
```

如果演示场景数量被修改，则这里应同步显示新的真实统计值，而不是仍然显示默认值。

### 9.7 老板问 AI

打开 AI 问答页，输入：

```text
这批货现在还有多少？
```

系统回答：

```text
该批次总数量为 100 箱，已经销售出库 20 箱，目前赞比亚仓库剩余库存 80 箱。
```

如果默认演示数据被修改，AI 问答必须返回按真实库存统计得到的新结果。

---

## 10. 验收标准

第一版 Demo 完成必须满足：

- 可以启动前端和后端；
- 可以上传合同或箱单文件；
- 可以返回 AI 识别结果，至少 mock 可用；
- 可以通过配置或表单修改商品、客户、供应商、目的仓、总数量、单位、出库数量、金额、币种；
- 可以根据识别结果生成合同；
- 可以基于当前确认后的数量生成批次，默认演示为 100 箱；
- 可以基于当前批次数量生成等量且唯一的二维码，默认演示为 100 个；
- 手机网页可以打开扫码页面；
- 入库扫码后库存增加；
- 出库扫码后库存减少；
- 库存页剩余数量来自真实二维码状态统计，默认演示场景下显示剩余 80 箱；
- AI 问答能回答“这批货现在还有多少？”，且答案基于真实库存结果而不是写死文案；
- 每个大环节都有 git commit；
- 每个大环节完成后已 push 到 GitHub；
- `docs/PROJECT_MEMORY.md` 已更新；
- `docs/TODO.md` 已勾选完成项。

---

## 11. Codex 工作规范

Codex 每次工作开始必须执行：

```text
1. 阅读 docs/PROJECT_DESIGN.md
2. 阅读 docs/TODO.md
3. 阅读 docs/PROJECT_MEMORY.md
4. 找到第一个未完成的大环节
5. 只实现这一个环节
6. 自测
7. 更新 PROJECT_MEMORY.md
8. 更新 TODO.md
9. git commit
10. git push
11. 停下来汇报，等待用户确认
```

Codex 不允许：

- 一次性实现多个大环节；
- 跳过 TODO 顺序；
- 不更新记忆文件；
- 不提交 git；
- 不 push GitHub；
- 直接把 API Key 写入前端；
- 让 AI 直接修改数据库；
- 未经用户确认进入下一阶段。

---

## 12. 第一版完成后的下一阶段方向

Demo 完成后，第二阶段可以扩展：

- 多仓库
- 多公司权限
- 真实 AI 单据识别
- 真实 OCR
- 批量二维码 PDF 打印
- 销售订单
- 物流状态
- 清关工单
- 财务回款
- 成本利润
- 经营报表
