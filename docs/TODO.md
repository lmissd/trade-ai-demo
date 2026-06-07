# 国际贸易 ERP 全链路演示版 Demo TODO

> 使用说明：Codex 每次只允许处理一个大环节。完成后必须先自测、更新本文件和 `docs/PROJECT_MEMORY.md`，然后停下来等待用户验证。未经用户确认，不提交本地 Git，也不推送 GitHub。

## 阶段 0：项目初始化与规则固化

- [x] 创建 `docs/PROJECT_DESIGN.md`
- [x] 创建 `docs/TODO.md`
- [x] 创建 `docs/PROJECT_MEMORY.md`
- [x] 创建 `docs/API.md`
- [x] 创建 `.env.example`
- [x] 初始化 Git 并确认 GitHub remote
- [x] 固化“每次只做一个大环节、先验收再提交”的规则

## 阶段 1：前后端基础骨架

- [x] 搭建 React + Vite + TypeScript 前端
- [x] 搭建 Node.js + Express + TypeScript 后端
- [x] 接入 `/api/health`
- [x] 搭建 14 个 ERP 菜单入口骨架
- [x] 保留旧入口兼容跳转
- [x] 保留 `start-demo.bat` / `stop-demo.bat` 双击查看方式

---

## Demo 1.0：核心真实闭环

### 阶段 2：数据库与成熟 ERP Demo 数据库底座

- [x] 检查当前已存在的 Prisma model
- [x] 将演示场景配置正式落到 `DemoConfig`
- [x] 补齐成熟 ERP Demo 所需核心模型
  - [x] 系统基础与权限：`User` `Role` `Permission` `UserRole` `RolePermission` `Company` `Department`
  - [x] 基础资料：`Sku` `Customer` `Supplier` `Warehouse` `WarehouseLocation` `Vehicle` `Driver`
  - [x] 核心闭环：`DemoConfig` `Document` `Contract` `ContractItem` `Batch` `QrItem` `StockMovement` `InventorySnapshot` `StocktakeOrder` `StocktakeItem`
  - [x] 采购物流清关：`PurchaseOrder` `PurchaseOrderItem` `Shipment` `ShipmentNode` `CustomsClearance`
  - [x] 仓储销售配送：`PreReceiveOrder` `InboundOrder` `OutboundOrder` `SalesOrder` `SalesOrderItem` `DeliveryOrder` `DeliveryOrderItem`
  - [x] 财务成本结算：`Payment` `Receivable` `Payable` `Invoice` `CostItem` `ExchangeRate` `BankAccount` `Settlement`
  - [x] 工单审批审计 AI 报表：`WorkOrder` `Approval` `ApprovalStep` `Notification` `AuditLog` `AiLog` `ReportSnapshot`
- [x] 执行数据库迁移
- [x] 生成 Prisma Client
- [x] 更新 seed
  - [x] 默认用户 `demo-owner`
  - [x] 默认 `DemoConfig`
  - [x] 5 个公司主体
  - [x] 6 个部门
  - [x] 示例 SKU / Customer / Supplier / Warehouse / WarehouseLocation
- [x] 更新 `/api/setup/status`
  - [x] 返回所有核心表 counts
  - [x] 返回默认 demo 用户
  - [x] 返回当前 demo 场景配置
- [x] 更新 `docs/PROJECT_MEMORY.md`
- [x] 更新 `docs/TODO.md`
- [x] 完成阶段 2 自测
  - [x] `prisma:generate`
  - [x] `prisma:migrate`
  - [x] `prisma:seed`
  - [x] 后端构建
  - [x] `/api/setup/status` 返回成功
- [ ] 等待用户验证阶段 2
- [ ] 用户确认后执行 `git add .`
- [ ] 用户确认后执行 `git commit -m "feat: 升级阶段2数据库为成熟ERP Demo数据库底座"`
- [ ] 用户确认后执行 `git push`

### 阶段 3：合同 / 箱单上传与 AI Mock 识别

- [ ] 后端实现文件上传接口
- [ ] 后端实现 AI Mock 识别接口
- [ ] 保存 `Document` 与 `AiLog`
- [ ] 前端完成“合同与单据”上传、识别、人工修正
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 4：合同与批次生成

- [ ] 实现合同接口
- [ ] 实现批次接口
- [ ] 从识别结果确认生成 `Contract` 与 `Batch`
- [ ] 前端完成合同与批次列表
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 5：二维码生成与二维码追溯

- [ ] 根据批次数量生成 `QrItem`
- [ ] 提供二维码列表、详情、图片接口
- [ ] 前端完成“二维码追溯”页面
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 6：仓储扫码入库

- [ ] 实现扫码入库接口
- [ ] 更新 `QrItem` 状态与 `StockMovement`
- [ ] 前端完成手机网页扫码入库
- [ ] 提供 Demo 批量入库辅助能力
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 7：仓储扫码出库

- [ ] 实现扫码出库接口
- [ ] 更新 `QrItem` 状态与 `StockMovement`
- [ ] 前端完成手机网页扫码出库
- [ ] 提供 Demo 批量出库辅助能力
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 8：库存真实统计

- [ ] 实现库存汇总接口
- [ ] 实现按合同 / 批次 / 仓库统计
- [ ] 库存页真实显示实时库存、在途、可用、冻结、已出库
- [ ] 严格基于 `QrItem` 状态计算，不写死 `80`
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

### 阶段 9：AI 真实库存问答

- [ ] 实现 AI 问答接口
- [ ] 先做规则识别，再根据真实库存结果生成回答
- [ ] 前端完成“AI 助手”页面
- [ ] 支持库存、批次、合同、二维码生命周期查询
- [ ] 自测并更新记忆
- [ ] 等待用户验证后再提交 Git

---

## Demo 1.5：成熟 ERP 模块包装

### 阶段 10：首页驾驶舱展示增强

- [ ] 展示真实库存卡片与 ERP 演示状态卡片
- [ ] 串联最近工单、最近推进、基础状态
- [ ] 自测并更新记忆

### 阶段 11：采购与集货展示模块

- [ ] 列表页
- [ ] 详情页 / 抽屉
- [ ] 模拟状态推进
- [ ] 采购完成联动物流状态

### 阶段 12：国际物流展示模块

- [ ] 列表页
- [ ] 时间轴
- [ ] 模拟离港 / 到港
- [ ] 到港联动清关工单

### 阶段 13：报关清关展示模块

- [ ] 列表页
- [ ] 单据一致性检查展示
- [ ] 模拟清关完成
- [ ] 联动预收货与陆运任务

### 阶段 14：仓储管理增强页面

- [ ] 预收货管理
- [ ] 扫码收货验收
- [ ] 库存管理
- [ ] 销售出库管理

### 阶段 15：销售与配送展示模块

- [ ] 列表页
- [ ] 详情页
- [ ] 模拟配送完成
- [ ] 联动财务回款状态

### 阶段 16：财务回款展示模块

- [ ] 应收、已收、账期、核销展示
- [ ] 模拟部分回款
- [ ] 模拟全部回款

### 阶段 17：成本利润展示模块

- [ ] 多币种成本结构展示
- [ ] 毛利与毛利率展示
- [ ] 明确标注 Demo 演示数据

### 阶段 18：多公司主体展示模块

- [ ] 组织结构展示
- [ ] 公司职责说明
- [ ] 标注正式版权限隔离规划

### 阶段 19：自动工单展示模块

- [ ] 工单列表
- [ ] 工单字段完整展示
- [ ] 模板化 AI 工单说明

### 阶段 20：数据报表与业务大盘

- [ ] 采购、在途、库存、销售、回款、成本、利润、二维码报表卡片
- [ ] 库存与二维码数量必须来自真实统计
- [ ] 经营类指标可先用 Demo 演示数据

---

## 当前下一步

- [ ] 下一步进入阶段 3：合同 / 箱单上传与 AI Mock 识别
