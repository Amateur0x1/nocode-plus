# Architecture Design

## System Overview

VibeCoding Studio:用户用自然语言描述应用想法,AI(claude-opus-5)生成单文件 HTML 应用,在工作台内实时预览、代码查看、版本切换与迭代修改。前端为 React + shadcn/ui,后端为 Atoms Cloud(Auth + PostgreSQL 实体 + aihub AI)。

## Tech Stack

- 前端:Vite + TypeScript + React + shadcn/ui + Tailwind CSS,`@metagptx/web-sdk`
- 后端:Atoms Cloud(自动生成的实体模型/路由),AI 能力走前端 `client.ai.gentxt`(流式)
- AI 模型:claude-opus-5(gentxt),流式输出,前端提取 HTML 代码块

## Module Design
| Module | Responsibility | Key Files |
|--------|---------------|-----------|
| 数据访问/契约 | SDK 客户端、类型、AI 系统提示词、HTML 提取工具 | app/frontend/src/lib/vibe.ts |
| 首页 | 登录态、项目列表 CRUD、创建项目入口、灵感 chips | app/frontend/src/pages/Index.tsx |
| 工作台 | 对话流式生成、版本管理、预览/代码/设备切换、导出 | app/frontend/src/pages/Workspace.tsx |
| 实体存储 | vibe_projects / chat_messages / app_versions 三表 | app/backend/models/、routers/、services/ |

## Tech Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI 调用位置 | 前端 client.ai.gentxt 流式 | 文本直接展示给用户,需要流式打字机体验,官方文档推荐前端调用 |
| 应用产物形态 | 自包含单文件 HTML | 可直接 iframe srcDoc 预览、可导出、便于版本化存储 |
| 版本策略 | 每次生成成功追加 app_versions 行 | 支持历史版本回看与切换,当前版本由选中 id 决定 |
| 上下文注入 | 生成时注入当前最新 HTML + 最近 8 条消息 | 迭代修改基于现有代码,控制 token 上限 |

## File Tree Plan

```
app/frontend/src/
├── lib/vibe.ts              # SDK client、类型、提示词、HTML 提取
├── pages/Index.tsx          # 首页:创建 + 项目列表
├── pages/Workspace.tsx      # 工作台:对话 + 预览 + 版本
└── App.tsx                  # 路由(/、/project/:id)
app/backend/
├── models/{vibe_projects,chat_messages,app_versions}.py
├── routers/ 同名自动生成路由
└── services/ 同名自动生成服务
```

## Implementation Guide

1. 表已通过 BackendManager.create_tables 创建(user_id 系统托管)。
2. 前端全部通过 web-sdk 访问实体;AI 用 client.ai.gentxt stream:true。
3. 生成流程:用户消息 → gentxt 流式 → extractHtmlCode → 创建 app_versions → 持久化对话消息。
4. 校验:pnpm run lint && pnpm run build;mgx-pycheck 校验后端改动文件。
