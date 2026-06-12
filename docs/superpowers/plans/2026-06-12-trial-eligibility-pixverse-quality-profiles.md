# Trial Eligibility PixVerse Quality Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 服务端判定免费试用资格，并把 PixVerse 试用/付费生成档位贯穿 job、segment、provider 请求、成本记录和后台权限。

**Architecture:** 在 `create-job` 中集中计算 billing/generation profile，新增 `free_trial_usages` 与 `user_access_events` 表承载试用窗口和 IP 证据。确认分镜只信任 job 的 `billing_mode`，segment 创建时复制 job 级生成参数，APIMart adapter 接收并提交 `resolution`/`audio`。后台明文 IP 只通过 admin 专用服务暴露。

**Tech Stack:** Next.js, TypeScript, Drizzle, Vitest, APIMart PixVerse V6.

---

### Task 1: Job Billing Decision

**Files:**
- Modify: `src/server/jobs/create-job.ts`
- Modify: `src/server/jobs/create-job.test.ts`
- Modify: `src/app/api/jobs/route.ts`
- Modify: `src/app/api/jobs/route.test.ts`

- [x] Add failing tests for 24h trial eligibility, client `isTrial` distrust, paid 8/16/24 credit costs, and access event records.
- [ ] Implement billing profile calculation and in-memory store support.
- [ ] Update API route input to use `useFreeTrialIfAvailable` and ignore `isTrial`.
- [ ] Verify `npm test -- src/server/jobs/create-job.test.ts src/app/api/jobs/route.test.ts`.

### Task 2: Schema And Migration

**Files:**
- Modify: `src/lib/db/schema/jobs.ts`
- Modify: `src/lib/db/schema/audit.ts`
- Add: `drizzle/0005_trial_generation_profiles.sql`

- [ ] Add job billing/profile/watermark/trial snapshot fields.
- [ ] Add segment generation profile/resolution/audio/watermark/cost fields.
- [ ] Add `free_trial_usages` and `user_access_events`.
- [ ] Verify schema type tests.

### Task 3: Storyboard Confirmation And Segment Profiles

**Files:**
- Modify: `src/server/storyboard/confirm.ts`
- Modify: `src/server/storyboard/confirm.test.ts`

- [ ] Add failing tests for free trial template rejection and profile copying.
- [ ] Implement trial template guard and segment profile propagation.
- [ ] Verify targeted tests.

### Task 4: APIMart Request And Cost

**Files:**
- Modify: `src/lib/providers/video-generation/router.ts`
- Modify: `src/lib/providers/apimart/video.ts`
- Modify: `src/lib/providers/apimart/video.test.ts`
- Modify: `src/server/video/segments.ts`
- Modify: `src/server/video/segments.test.ts`

- [ ] Add failing tests for `resolution`/`audio` request body and provider cost extraction.
- [ ] Thread segment generation parameters into provider input.
- [ ] Store provider cost on successful poll when returned.
- [ ] Verify targeted tests.

### Task 5: Admin IP Visibility

**Files:**
- Add: `src/server/admin/access-events.ts`
- Add: `src/server/admin/access-events.test.ts`

- [ ] Add tests proving admin sees full IP and operator does not.
- [ ] Implement admin-only access event listing with operator redaction.
- [ ] Verify targeted tests.

### Task 6: Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run typecheck`.
- [ ] Report implemented scope, verification output, and remaining product/doc risks.
