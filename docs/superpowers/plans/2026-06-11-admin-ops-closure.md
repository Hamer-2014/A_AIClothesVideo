# Admin Ops Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成管理员后台 MVP 排障闭环：异常任务可筛、任务详情可读、敏感操作有 reason 和审计、真实验收状态有记录。

**Architecture:** 基于现有 Next.js admin pages、server admin services 和 admin API 增量增强，不重建后台。服务层负责筛选、诊断摘要和权限审计；页面层只展示可读排障信息；数据库仍以 Drizzle/Neon 表作为唯一事实来源。

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS, Drizzle, Neon Postgres, Vitest.

---

## Reference SPEC

执行前先读：

- `docs/superpowers/specs/2026-06-11-admin-ops-closure-spec.md`
- `docs/API_TEST_STATUS.md`
- `docs/DEVELOPMENT_SPEC.md` 的第 17 节管理员后台 SPEC

不要照 `docs/superpowers/plans/2026-06-09-mvp-closure-next-steps.md` 原样创建 admin 页面。当前 admin 页面和 API 已经存在，本计划是补齐闭环。

---

## Task 1: Admin Job List Filters

**Files:**
- Modify: `src/server/admin/list-jobs.ts`
- Modify: `src/server/admin/list-jobs.test.ts`
- Modify: `src/app/admin/jobs/page.tsx`

- [ ] **Step 1: Write failing tests for list filters**

在 `src/server/admin/list-jobs.test.ts` 增加测试，覆盖：

```ts
it("filters attention jobs including failed and stale running states", async () => {
  const now = new Date("2026-06-11T00:20:00.000Z");
  const jobs = await listAdminJobs({
    store: createInMemoryAdminJobListStore([
      {
        id: "job-failed",
        userId: "user-1",
        status: "segment_failed",
        userVisibleStatus: "failed",
        durationSeconds: 8,
        aspectRatio: "9:16",
        creditCost: 70,
        failureReason: "provider failed",
        isTest: true,
        createdAt: new Date("2026-06-11T00:00:00.000Z"),
        updatedAt: new Date("2026-06-11T00:01:00.000Z"),
      },
      {
        id: "job-stale",
        userId: "user-2",
        status: "post_qa_queued",
        userVisibleStatus: "qa",
        durationSeconds: 8,
        aspectRatio: "9:16",
        creditCost: 70,
        failureReason: null,
        isTest: false,
        createdAt: new Date("2026-06-11T00:02:00.000Z"),
        updatedAt: new Date("2026-06-11T00:05:00.000Z"),
      },
      {
        id: "job-ok",
        userId: "user-3",
        status: "deliverable",
        userVisibleStatus: "downloadable",
        durationSeconds: 8,
        aspectRatio: "9:16",
        creditCost: 70,
        failureReason: null,
        isTest: false,
        createdAt: new Date("2026-06-11T00:03:00.000Z"),
        updatedAt: new Date("2026-06-11T00:19:00.000Z"),
      },
    ]),
    filters: { attention: true },
    now,
  });

  expect(jobs.map((job) => job.id)).toEqual(["job-stale", "job-failed"]);
});
```

再补 `isTest`、`status`、`query` 搜索测试。

- [ ] **Step 2: Run the tests and confirm failure**

Run:

```bash
npm test -- src/server/admin/list-jobs.test.ts
```

Expected: fails because filters and `updatedAt` are not implemented.

- [ ] **Step 3: Implement list filters**

在 `src/server/admin/list-jobs.ts` 增加：

- `updatedAt` 字段。
- `AdminJobListFilters`。
- `isAttentionJob(job, now)`。
- `listAdminJobs({ store, filters, now })` 内存过滤。
- Drizzle store 支持查询足够字段，筛选可先在服务层做，MVP 不需要复杂 SQL。

注意 stale threshold 固定 10 分钟。

- [ ] **Step 4: Update `/admin/jobs` UI**

在 `src/app/admin/jobs/page.tsx` 读取 `searchParams`：

- `attention=1`
- `isTest=true|false`
- `status=<status>`
- `q=<jobId or userId>`

页面顶部提供简单筛选链接或表单。不要引入 table 库。

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/server/admin/list-jobs.test.ts
npm run typecheck
```

Commit:

```bash
git add src/server/admin/list-jobs.ts src/server/admin/list-jobs.test.ts src/app/admin/jobs/page.tsx
git commit -m "feat: add admin job attention filters"
```

---

## Task 2: Admin Job Diagnosis Summary

**Files:**
- Modify: `src/server/admin/jobs.ts`
- Modify: `src/server/admin/jobs.test.ts`
- Create or Modify: `src/components/admin/job-diagnosis-panel.tsx`
- Modify: `src/components/admin/job-detail-panel.tsx`

- [ ] **Step 1: Write failing tests for diagnosis summary**

在 `src/server/admin/jobs.test.ts` 增加测试：

- deliverable + finalVideoKey -> `kind: "deliverable"`
- stale post_qa_queued -> `kind: "post_qa_stalled"`
- failed segment -> `kind: "segment_failed"`
- stitch failure or missing finalVideoKey during stitch -> `kind: "stitch_failed"`
- moderation blocked -> `kind: "moderation_blocked"`
- failed job with reserve but no release/refund/capture -> `kind: "credits_need_attention"`

测试断言 `getAdminJobDetail()` 返回 `diagnosis`。

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/server/admin/jobs.test.ts
```

Expected: fails because `diagnosis` is missing.

- [ ] **Step 3: Implement diagnosis**

在 `src/server/admin/jobs.ts` 增加：

```ts
export interface AdminJobDiagnosis {
  kind:
    | "deliverable"
    | "post_qa_stalled"
    | "segment_failed"
    | "stitch_failed"
    | "moderation_blocked"
    | "credits_need_attention"
    | "in_progress";
  severity: "info" | "warning" | "critical";
  title: string;
  recommendation: string;
}
```

实现 `diagnoseAdminJob({ job, segments, stitchJobs, ledger, now })`，并让 `getAdminJobDetail()` 返回 `diagnosis`。

- [ ] **Step 4: Add diagnosis panel**

创建或修改 `src/components/admin/job-diagnosis-panel.tsx`，只展示：

- title
- severity
- recommendation

在 `src/components/admin/job-detail-panel.tsx` 首屏任务总览下面展示它。

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/server/admin/jobs.test.ts
npm run typecheck
```

Commit:

```bash
git add src/server/admin/jobs.ts src/server/admin/jobs.test.ts src/components/admin/job-diagnosis-panel.tsx src/components/admin/job-detail-panel.tsx
git commit -m "feat: add admin job diagnosis summary"
```

---

## Task 3: Replace JSON-Only Job Detail With Readable Sections

**Files:**
- Modify: `src/server/admin/jobs.ts`
- Modify: `src/server/admin/jobs.test.ts`
- Modify: `src/components/admin/job-detail-panel.tsx`
- Optional Create: `src/components/admin/job-timeline.tsx`
- Optional Create: `src/components/admin/admin-data-table.tsx`

- [ ] **Step 1: Add missing fields to admin detail tests**

在 `src/server/admin/jobs.test.ts` 断言 detail 至少包含：

- job `lastError` 和 `updatedAt`
- segments `lastError` 和 `attemptCount`
- stitch jobs
- post QA results
- provider logs
- moderation results
- credit ledger
- state events

- [ ] **Step 2: Run tests and confirm failure if fields are missing**

Run:

```bash
npm test -- src/server/admin/jobs.test.ts
```

- [ ] **Step 3: Add missing service fields**

在 `src/server/admin/jobs.ts` 的 Drizzle selects 中补字段。只补当前 UI 和诊断需要的字段，不要把所有列无脑塞进首屏。

- [ ] **Step 4: Render readable sections**

改 `src/components/admin/job-detail-panel.tsx`：

- 任务总览卡片保留。
- 新增 Segment table。
- 新增 Provider logs table。
- 新增 Moderation table。
- 新增 Credit ledger table。
- 新增 State events timeline。
- JSON blocks 改为辅助区，放在可读表格之后。

不要做复杂交互。MVP 只需要清楚。

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/server/admin/jobs.test.ts
npm run typecheck
```

Commit:

```bash
git add src/server/admin/jobs.ts src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.tsx
git commit -m "feat: make admin job detail readable"
```

---

## Task 4: Enforce Admin Action Reason Rules

**Files:**
- Modify: `src/server/admin/job-actions.ts`
- Modify: `src/server/admin/job-actions.test.ts`
- Modify: `src/server/admin/providers.ts`
- Modify: `src/server/admin/providers.test.ts`
- Modify: `src/server/admin/billing.ts`
- Modify: `src/server/admin/billing.test.ts`
- Modify: `src/app/api/admin/**/*.test.ts`
- Modify: `src/components/admin/action-form.tsx`

- [ ] **Step 1: Write failing tests for invalid reasons**

Add tests that reject:

- missing reason
- empty reason
- whitespace reason
- reason shorter than 6 characters

Cover at least:

- retry segment
- reopen Post-QA
- mark undeliverable
- admin credit adjustment
- provider key status update
- model route update
- template status update

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- src/server/admin/job-actions.test.ts src/server/admin/providers.test.ts src/server/admin/billing.test.ts
```

- [ ] **Step 3: Implement shared reason validation**

Prefer a small helper in `src/server/admin/audit.ts` or a new focused helper:

```ts
export function normalizeAdminReason(reason: string | undefined) {
  const normalized = reason?.trim() ?? "";
  if (normalized.length < 6) {
    throw new Error("Admin action reason must be at least 6 characters.");
  }
  return normalized;
}
```

Use this before writing audit logs and before mutating state.

- [ ] **Step 4: Improve action form UX**

In `src/components/admin/action-form.tsx`:

- mark reason input required.
- add helper text: `至少 6 个字符，会写入审计日志。`
- keep server-side validation as source of truth.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- src/server/admin/job-actions.test.ts src/server/admin/providers.test.ts src/server/admin/billing.test.ts
npm test -- src/app/api/admin
npm run typecheck
```

Commit:

```bash
git add src/server/admin src/app/api/admin src/components/admin/action-form.tsx
git commit -m "fix: enforce admin action reasons"
```

---

## Task 5: Provider, Template, Billing Minimum Ops Review

**Files:**
- Modify: `src/app/admin/providers/page.tsx`
- Modify: `src/components/admin/provider-table.tsx`
- Modify: `src/app/admin/templates/page.tsx`
- Modify: `src/components/admin/template-status-table.tsx`
- Modify: `src/app/admin/billing/page.tsx`
- Modify: `src/components/admin/billing-table.tsx`
- Modify tests only if service shape changes

- [ ] **Step 1: Review current pages**

Read existing pages and confirm they show the required fields from the SPEC.

- [ ] **Step 2: Patch missing fields only**

Add missing display fields:

- provider key status and masked label, never full key.
- template id/name/status/risk/trial eligibility.
- wallet/orders/ledger in billing.

Do not add charts.

- [ ] **Step 3: Verify and commit**

Run:

```bash
npm run typecheck
npm test
```

Commit:

```bash
git add src/app/admin src/components/admin
git commit -m "feat: tighten admin ops pages"
```

---

## Task 6: Update API Test Status And Final Verification

**Files:**
- Modify: `docs/API_TEST_STATUS.md`

- [ ] **Step 1: Run core verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

All must pass.

- [ ] **Step 2: Run smoke if environment is ready**

If `.env.local` has required runtime values, run:

```bash
npm run smoke:stitch
npm run smoke:backend
```

If smoke cannot run, capture the exact missing env or provider blocker.

- [ ] **Step 3: Update `docs/API_TEST_STATUS.md`**

Record:

- date
- verification commands and result
- smoke result or blocker
- job id if smoke ran
- final video key if available
- QA frame keys if available
- final job status
- credit ledger result
- admin ops changes completed

- [ ] **Step 4: Final status and commit**

Run:

```bash
git status --short
```

Commit:

```bash
git add docs/API_TEST_STATUS.md
git commit -m "docs: record admin ops closure verification"
```

---

## Review Checklist

Before handing back for验收:

- [ ] `/admin/jobs` can filter attention jobs.
- [ ] `/admin/jobs` can filter test/non-test jobs.
- [ ] `/admin/jobs` can search job/user.
- [ ] `/admin/jobs/[id]` shows diagnosis before JSON.
- [ ] Segment, provider logs, moderation, ledger, state events are readable without expanding raw JSON.
- [ ] Admin actions require reason and write audit.
- [ ] Operator cannot modify provider key or model route.
- [ ] Provider keys are not exposed.
- [ ] Post-QA cannot be bypassed to deliverable.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `docs/API_TEST_STATUS.md` is updated.

If any item fails, do not claim completion. Fix it or state it as a known blocker.

