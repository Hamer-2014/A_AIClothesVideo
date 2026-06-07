# 基础工程里程碑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可部署 Next.js 基础应用骨架，并满足 `DEVELOPMENT_SPEC.md` 第 1-2 章验收。

**Architecture:** Next.js App Router 负责首页与健康检查 API；Tailwind 提供基础视觉系统；Vitest 覆盖健康检查 handler；外部服务只通过 `.env.example` 声明，不实现伪成功链路。

**Tech Stack:** Next.js, TypeScript, React, Tailwind CSS, ESLint, Vitest.

---

### Task 1: 工程配置

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Modify: `.gitignore`

- [ ] 创建 Next.js、TypeScript、Tailwind、ESLint 和 Vitest 配置。
- [ ] 更新 `.gitignore`，排除 Node、Next、构建和环境文件。
- [ ] 运行 `npm install` 生成 lockfile。

### Task 2: 环境变量模板

**Files:**
- Create: `.env.example`

- [ ] 按 `DEVELOPMENT_SPEC.md` 第 1.1 节写入所有必需环境变量。
- [ ] 不写入任何真实密钥。

### Task 3: App Router 骨架

**Files:**
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/components/ui/.gitkeep`
- Create: `src/lib/.gitkeep`
- Create: `src/server/.gitkeep`

- [ ] 创建根布局和全局样式。
- [ ] 创建最小状态首页，明确显示当前处于 Foundation 阶段。
- [ ] 建立后续代码目录边界。

### Task 4: 健康检查 API

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`

- [ ] 先写 `GET /api/health` 测试，断言状态码和 JSON。
- [ ] 运行测试，确认因 route 不存在或行为未实现而失败。
- [ ] 实现 route handler。
- [ ] 重新运行测试，确认通过。

### Task 5: 验收

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm test`

- [ ] 运行全部验收命令。
- [ ] 记录任何不能完成的项和原因。
