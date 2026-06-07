# 项目记忆

## 当前已完成

- 已完成阶段 0 的本地初始化与规则固化，GitHub push 待网络或认证问题解除后完成。
- 已补齐基础目录结构：`apps/`、`apps/web/`、`apps/server/`、`uploads/`、`generated_qr/`。
- 已补齐基础项目文件：`docs/PROJECT_MEMORY.md`、`docs/API.md`、`.env.example`、`.gitignore`。
- 已确认默认演示场景为中国采购 100 箱货发往赞比亚仓库，但该场景只作为默认值，后续实现必须支持配置或表单修改。

## 关键技术选择

- 第一版采用 Web Demo 路线，前端计划使用 React + Vite + TypeScript。
- 后端计划使用 Node.js + Express + TypeScript。
- 数据库第一版计划使用 SQLite，后续可切换 PostgreSQL。
- AI 第一版默认允许使用 mock 数据，真实接入必须放在后端，不允许把 API Key 写入前端。
- 演示数据必须可配置，库存结果必须基于真实二维码状态动态计算，不能把 `100 / 20 / 80` 写死在代码里。

## 已新增页面

- 暂无业务页面，当前阶段仅建立目录结构与文档约束。

## 已新增接口

- 暂无实际接口实现。
- 已在 `docs/API.md` 中整理第一版计划接口清单，供后续阶段按顺序落地。

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
- GitHub remote 已配置为 `https://github.com/lmissd/trade-ai-demo.git`。
- 远端推送预检未通过：当前环境无法正常连接 `github.com:443`，`ssh.github.com:443` 可连通，但本机没有可用 SSH key。

## 遇到的问题

- 当前工作目录最开始不是 Git 仓库，也没有 `docs/PROJECT_MEMORY.md`，已在本阶段补齐并初始化。
- 当前环境无法通过 HTTPS 访问 `github.com:443`。
- 当前环境虽然可以连通 `ssh.github.com:443`，但本机没有可用 SSH 私钥或 agent，因此还不能通过 SSH 推送到 GitHub。

## 下一步要做什么

- 先解决 GitHub 推送问题，完成阶段 0 的远端推送收尾。
- 推送完成并获得用户确认后，再进入阶段 1：搭建前后端基础骨架。

## 本次 Git 提交

- 计划提交信息：`chore: 初始化项目结构和开发规则`
- 本次 git commit hash：以本阶段提交结果为准，最终 hash 在本次汇报中同步给出。
