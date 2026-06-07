# 项目记忆

## 当前已完成

- 已完成阶段 0：项目初始化与规则固化。
- 已完成阶段 1：搭建前后端基础骨架。
- 已补齐基础目录结构：`apps/`、`apps/web/`、`apps/server/`、`uploads/`、`generated_qr/`。
- 已补齐基础项目文件：`docs/PROJECT_MEMORY.md`、`docs/API.md`、`.env.example`、`.gitignore`。
- 已确认默认演示场景为中国采购 100 箱货发往赞比亚仓库，但该场景只作为默认值，后续实现必须支持配置或表单修改。
- 已完成 Git 初始化、本地提交、GitHub SSH 连通验证与远端推送。
- 已创建前端 React + Vite + TypeScript + Ant Design + React Router 骨架。
- 已创建后端 Node.js + Express + TypeScript 骨架，并接通 `/api/health`。
- 已在根目录建立 workspace 和统一启动脚本，可通过 `npm run dev` 同时启动前后端。

## 关键技术选择

- 第一版采用 Web Demo 路线，前端计划使用 React + Vite + TypeScript。
- 后端计划使用 Node.js + Express + TypeScript。
- 数据库第一版计划使用 SQLite，后续可切换 PostgreSQL。
- AI 第一版默认允许使用 mock 数据，真实接入必须放在后端，不允许把 API Key 写入前端。
- 演示数据必须可配置，库存结果必须基于真实二维码状态动态计算，不能把 `100 / 20 / 80` 写死在代码里。
- 根目录采用 npm workspaces 管理 `apps/web` 与 `apps/server`。
- 统一启动方式采用 `concurrently`，保证演示时一条命令即可拉起前后端。
- 前端阶段 1 使用后台布局 + 9 个页面占位，先把路由和信息架构稳定下来。

## 已新增页面

- `/dashboard`
- `/documents`
- `/contracts`
- `/batches`
- `/qr-items`
- `/scan`
- `/inventory`
- `/payments`
- `/ai-assistant`

## 已新增接口

- `GET /`
- `GET /api/health`
- `docs/API.md` 中已整理后续阶段计划接口清单，供按顺序落地。

## 已新增数据表

- 暂无实际数据表实现。
- 已在设计文档中明确第一版计划数据模型：`User`、`Document`、`Contract`、`Batch`、`QrItem`、`StockMovement`、`Payment`、`AiLog`。

## 项目规则固化

- 每次只允许完成 `docs/TODO.md` 中的一个大环节。
- 每次开始前必须阅读 `docs/PROJECT_DESIGN.md`、`docs/TODO.md`、`docs/PROJECT_MEMORY.md`。
- 完成后必须先自测，再更新 `docs/PROJECT_MEMORY.md` 和 `docs/TODO.md`。
- 每个大环节完成后必须执行 `git commit` 和 `git push`。
- 未经用户确认，不进入下一个大环节。
- AI 不能直接修改数据库，所有写入都必须经过后端接口和用户确认。

## 本阶段自测结果

- 目录结构已创建完成。
- 阶段 0 所需基础文件已补齐。
- 本地 Git 已初始化，当前分支为 `main`。
- GitHub remote 当前已配置为 `git@github.com:lmissd/trade-ai-demo.git`。
- SSH 认证已通过，返回 `Hi lmissd! You've successfully authenticated`。
- `origin/main` 已成功关联并确认包含当前提交 `6b88212a43184e79a0f543b82abceabd3cfac562`。
- `npm install` 成功完成，workspace 依赖安装正常。
- 前端单独构建通过：`npm run build --workspace @trade-ai-demo/web`。
- 后端单独构建通过：`npm run build --workspace @trade-ai-demo/server`。
- 根目录统一构建通过：`npm run build`。
- 根目录统一启动通过：`npm run dev` 可同时启动前后端。
- `GET http://127.0.0.1:3001/api/health` 返回 `status: ok`。
- 前端 9 个占位路由均返回 `200`，包括 `/dashboard`、`/documents`、`/contracts`、`/batches`、`/qr-items`、`/scan`、`/inventory`、`/payments`、`/ai-assistant`。

## 遇到的问题

- 当前工作目录最开始不是 Git 仓库，也没有 `docs/PROJECT_MEMORY.md`，已在本阶段补齐并初始化。
- 初次尝试时 HTTPS 推送失败，后续通过 SSH key 配置恢复了 GitHub 推送能力。
- 前端构建初次因菜单项类型推断报错，已通过拆分 `routeMenuEntries` 和 `routeMenuItems` 修复。
- Vite 构建存在 Ant Design 带来的 chunk size warning，但不影响阶段 1 骨架启动与构建，后续可在优化阶段再做拆包。

## 下一步要做什么

- 等待用户确认后，再进入阶段 2：数据库与基础数据模型。

## 本次 Git 提交

- 阶段 0 初始化提交：`chore: 初始化项目结构和开发规则`
- 已推送提交 hash：`6b88212a43184e79a0f543b82abceabd3cfac562`
- 阶段 0 文档同步提交：`docs: 同步阶段0完成状态`
- 已推送提交 hash：`593d4db47f4df7d2af5c08e417566b479f347e95`
- 阶段 1 功能提交：`feat: 搭建前后端基础骨架`
- 已推送提交 hash：`0b77ae2b68042936b2e2615459dbf4df2929a793`
