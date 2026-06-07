# 任务状态机与 Worker Tick Implementation Plan

**Goal:** 实现任务状态机、任务锁、asset-analysis worker tick 和内部 cron endpoint。

**Architecture:** 状态机服务负责合法流转和事件审计；锁服务负责有限领取和过期恢复；worker tick 编排 queued -> running -> passed/failed；route 只做 secret/session 校验和服务调用。

**Tech Stack:** TypeScript, Drizzle, Next.js Route Handler, Vitest.

---

### Task 1: Job State Machine

**Files:**
- Create: `src/server/jobs/state-machine.ts`
- Create: `src/server/jobs/state-machine.test.ts`

- [x] 定义状态流转白名单。
- [x] 合法流转更新 job status。
- [x] 每次流转写 `job_state_events`。
- [x] 非法流转拒绝。
- [x] Drizzle `JobStore` 可读写 `video_jobs` 和 `job_state_events`。

### Task 2: Job Locks

**Files:**
- Create: `src/server/jobs/locks.ts`
- Create: `src/server/jobs/locks.test.ts`

- [x] 领取最早 eligible job。
- [x] 未过期锁不可重复领取。
- [x] 过期锁可恢复。
- [x] 领取时递增 `attempt_count`。
- [x] Drizzle `JobLockStore` 支持真实 DB 领取。

### Task 3: Worker Tick

**Files:**
- Create: `src/server/workers/tick.ts`
- Create: `src/server/workers/tick.test.ts`

- [x] 单次 tick 按 limit 处理。
- [x] 成功任务进入 passed。
- [x] 失败任务进入 failed 并写 `last_error`。
- [x] 单个任务失败不阻断整轮 tick。
- [x] 领取后复查真实状态，避免重复处理已完成任务。

### Task 4: Asset Analysis Job Integration

**Files:**
- Create: `src/server/assets/job-analysis.ts`
- Create: `src/server/assets/job-analysis.test.ts`
- Create: `src/server/jobs/create-job.ts`
- Create: `src/server/jobs/create-job.test.ts`
- Create: `src/server/jobs/get-job.ts`
- Create: `src/server/jobs/get-job.test.ts`
- Create: `src/app/api/jobs/route.ts`
- Create: `src/app/api/jobs/route.test.ts`
- Create: `src/app/api/jobs/[id]/route.ts`
- Create: `src/app/api/jobs/[id]/route.test.ts`
- Create: `src/app/api/jobs/[id]/analyze/route.ts`
- Create: `src/app/api/jobs/[id]/analyze/route.test.ts`

- [x] 用户可用已上传素材创建 `video_jobs`。
- [x] 创建 job 时绑定 `video_job_assets`。
- [x] 创建 job 只允许当前用户拥有的素材。
- [x] 创建 job 后进入 `asset_analysis_queued`，不冻结点数。
- [x] 只分析绑定到 `video_job_assets` 的素材。
- [x] 校验 job 属于当前用户。
- [x] 使用 R2 signed URL 调用视觉分析。
- [x] 聚合多素材模板推荐。
- [x] 用户 API 可手动触发素材分析。
- [x] 用户可查询 job 状态、素材完整度和模板推荐。

### Task 5: Internal Cron Endpoint

**Files:**
- Create: `src/app/api/internal/worker/tick/route.ts`
- Create: `src/app/api/internal/worker/tick/route.test.ts`

- [x] 校验 `CRON_JOB_SECRET`。
- [x] secret 缺失时 fail closed。
- [x] 授权后运行 worker tick。
- [x] 当前默认只处理 `asset_analysis_queued`。

### Task 6: Deferred Work

- [ ] Lite 视觉预检 worker。
- [ ] `video_segments` worker。
- [ ] stitch worker trigger。
- [ ] Post-QA worker。
- [ ] 前台工作台 UI。

### Task 7: Verification

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] 运行完整验证。
