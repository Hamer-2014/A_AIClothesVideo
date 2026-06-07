# Creem Prompt Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Creem Prompt Moderation 客户端、结果记录和服务端 fail-closed 闸门。

**Architecture:** Creem client 只负责外部 API 调用；moderation store 负责写 `prompt_moderation_results`；`checkPrompt` 组合调用、错误处理、结果落库和业务决策。生成链路后续只调用 `checkPrompt`，不直接调用 Creem。

**Tech Stack:** TypeScript, Next.js server modules, Drizzle, Vitest, Creem REST API.

---

### Task 1: Creem Moderation client

**Files:**
- Create: `src/lib/providers/creem/moderation.ts`
- Create: `src/lib/providers/creem/moderation.test.ts`

- [ ] 测试缺少 `CREEM_MODERATION_API_KEY` 抛出 unavailable。
- [ ] 测试请求 `POST /v1/moderation/prompt` 使用 `x-api-key`。
- [ ] 测试解析 `allow`、`flag`、`deny`。
- [ ] 测试 5xx 或异常不伪造成 allow。

### Task 2: Prompt source 与摘要

**Files:**
- Create: `src/server/moderation/prompt-sources.ts`
- Create: `src/server/moderation/prompt-sources.test.ts`

- [ ] 定义 source：`user_input`、`storyboard_prompt`、`final_video_prompt`。
- [ ] 使用 SHA-256 生成 prompt hash。
- [ ] 生成短摘要，避免保存完整 prompt。

### Task 3: Moderation result store

**Files:**
- Create: `src/server/moderation/results.ts`
- Create: `src/server/moderation/results.test.ts`

- [ ] 定义 `ModerationResultStore` 接口。
- [ ] 实现 memory store。
- [ ] 实现 Drizzle store。
- [ ] 测试 memory store 可保存 allow/error 结果。

### Task 4: Check prompt 闸门服务

**Files:**
- Create: `src/server/moderation/check-prompt.ts`
- Create: `src/server/moderation/check-prompt.test.ts`

- [ ] allow 返回 `allowed: true`。
- [ ] flag/deny 返回 `allowed: false`。
- [ ] 缺 key、网络错误、5xx 返回 `allowed: false`。
- [ ] 每次调用都保存 `prompt_moderation_results`。
- [ ] 保存 prompt hash/summary，不保存完整 prompt。

### Task 5: 文档与验证

**Files:**
- Modify: `.env.example`

- [ ] 补充 Creem moderation key 与 base URL 说明。
- [ ] 运行 `npm run lint`。
- [ ] 运行 `npm run typecheck`。
- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
