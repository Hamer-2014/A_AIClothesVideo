# Virtual Try-on Worker Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让本地 Virtual Try-on 队列可以安全地持续推进，避免 tick 路由在开发环境加载时卡死，并让长时间未被 worker 领取的任务显示可诊断状态。

**Architecture:** 内部 tick 端点先完成密钥和参数校验，再动态加载数据库、账本、供应商及 R2 依赖；本地 runner 通过受保护的 HTTP tick 契约循环推进任务，不复制状态机。Owner API 仅返回归一化的 `queueHealth`，前端不获得 worker 密钥或任务推进权限。

**Tech Stack:** Next.js 16、TypeScript、Node.js、Vitest、Drizzle/PostgreSQL。

---

### Task 1: Lightweight Tick Route

**Files:**
- Modify: `src/app/api/internal/virtual-try-on/tick/route.ts`
- Test: `src/app/api/internal/virtual-try-on/tick/route.test.ts`

- [ ] **Step 1: Write the failing source-boundary test**

Add a test that reads `route.ts`, rejects static imports from credit/runtime/maintenance modules, and requires the default runner loader to use dynamic imports.

- [ ] **Step 2: Run the focused route test and verify RED**

Run: `pnpm exec vitest run src/app/api/internal/virtual-try-on/tick/route.test.ts`

Expected: FAIL because the route currently imports all heavy runtime dependencies statically.

- [ ] **Step 3: Implement deferred default runner loading**

Remove the heavy static imports. Make `defaultRunners()` asynchronous and load the credit, maintenance, and generation modules only after the request secret and body limit pass validation.

- [ ] **Step 4: Run the focused route test and verify GREEN**

Run: `pnpm exec vitest run src/app/api/internal/virtual-try-on/tick/route.test.ts`

Expected: all route tests pass.

### Task 2: Protected Local Tick Runner

**Files:**
- Create: `scripts/virtual-try-on-dev-worker.mjs`
- Create: `scripts/virtual-try-on-dev-worker.test.ts`
- Modify: `scripts/mjs-modules.d.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing environment and request tests**

Test that the runner rejects `APP_ENV=production`, requires `VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST=true`, sends `x-cron-secret`, and treats non-2xx responses as failures without printing secrets.

- [ ] **Step 2: Run the focused runner test and verify RED**

Run: `pnpm exec vitest run scripts/virtual-try-on-dev-worker.test.ts`

Expected: FAIL because the runner module does not exist.

- [ ] **Step 3: Implement the minimal runner**

Load `.env.local`, validate development-only cost acknowledgement, POST `{ "limit": 1 }` to `/api/internal/virtual-try-on/tick`, use a bounded interval, and expose a `--once` mode for diagnostics. Add `pnpm dev:virtual-try-on` without changing the default `pnpm dev` command.

- [ ] **Step 4: Run the focused runner test and verify GREEN**

Run: `pnpm exec vitest run scripts/virtual-try-on-dev-worker.test.ts`

Expected: all runner tests pass.

### Task 3: Stale Queue Visibility

**Files:**
- Create: `src/server/virtual-tryon/queue-health.ts`
- Create: `src/server/virtual-tryon/queue-health.test.ts`
- Modify: `src/server/virtual-tryon/owner.ts`
- Modify: `src/server/virtual-tryon/owner.test.ts`
- Modify: `src/components/virtual-try-on/pack-detail.tsx`
- Modify: `src/components/virtual-try-on/pack-detail.test.tsx`

- [ ] **Step 1: Write failing queue classification and UI tests**

Test that a queued task older than two minutes with `attemptCount=0` is `delayed`, while fresh, claimed, and non-queued tasks are `normal`. Test that delayed tasks render a safe operational warning without exposing an internal secret or endpoint.

- [ ] **Step 2: Run focused queue/UI tests and verify RED**

Run: `pnpm exec vitest run src/server/virtual-tryon/queue-health.test.ts src/server/virtual-tryon/owner.test.ts src/components/virtual-try-on/pack-detail.test.tsx`

Expected: FAIL because `queueHealth` and the warning do not exist.

- [ ] **Step 3: Implement queue health projection and warning**

Project `attemptCount` and `updatedAt` only inside the owner store, return `queueHealth: "normal" | "delayed"`, and render a concise bilingual delayed-generation alert. Do not expose raw lock fields or allow the browser to invoke tick.

- [ ] **Step 4: Run focused queue/UI tests and verify GREEN**

Run the same focused command and expect all tests to pass.

### Task 4: Documentation and Verification

**Files:**
- Modify: `docs/deployment/virtual-try-on.md`

- [ ] **Step 1: Document local runner safety contract**

Document `APP_ENV=development`, `VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST=true`, `pnpm dev:virtual-try-on`, and the explicit production refusal.

- [ ] **Step 2: Run focused static checks**

Run: `pnpm exec eslint <changed files>` and `pnpm typecheck`.

- [ ] **Step 3: Run full suite once at the Goal gate**

Run: `pnpm test -- --reporter=dot`.

- [ ] **Step 4: Verify the local server contract without provider cost**

Start port 3000, confirm `/` returns 200, then call the tick endpoint with an invalid secret and confirm it returns 401 promptly. Do not use the real secret during automated verification.

## Self-review

- Spec coverage: covers local worker execution, tick route loading, stale queue visibility, cost/environment safety, and deployment instructions.
- Placeholder scan: no deferred implementation placeholders remain.
- Type consistency: `queueHealth` is consistently `"normal" | "delayed"`; runner uses the existing `{ limit }` tick contract and `x-cron-secret` header.
