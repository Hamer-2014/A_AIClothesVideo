# Post-QA Retry And Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Post-QA provider outages retry with bounded backoff while keeping credits reserved, and make every admin Post-QA reopen create or reuse exactly one auditable reservation that is resolved independently.

**Architecture:** Persist transient Post-QA retries through the existing video job state machine and `next_retry_at`; the job lock must honor that timestamp. Move the paid admin reopen operation into one database transaction that locks the job, determines whether the current reservation is already resolved, reserves when necessary, updates `reserved_ledger_id`, and records both state events. Bind Post-QA capture/release idempotency keys to the concrete reservation ledger ID.

**Tech Stack:** TypeScript, Next.js, Drizzle ORM, PostgreSQL, Vitest.

---

### Task 1: Make scheduled job retries real

**Files:**
- Modify: `src/server/jobs/state-machine.ts`
- Modify: `src/server/jobs/locks.ts`
- Test: `src/server/jobs/state-machine.test.ts`
- Test: `src/server/jobs/locks.test.ts`

- [x] **Step 1: Write failing tests**

Add a lock test proving a queued job with a future `nextRetryAt` is skipped and a due job is claimable. Add a state-store test proving `nextRetryAt` can be set and cleared.

- [x] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run src/server/jobs/locks.test.ts src/server/jobs/state-machine.test.ts`

Expected: FAIL because `JobRecord`/`JobStatusChanges` do not persist `nextRetryAt` and the lock query ignores it.

- [x] **Step 3: Implement the minimal scheduling support**

Add `nextRetryAt` to job record/change types and both in-memory/Drizzle stores. Filter acquisition with:

```ts
or(isNull(videoJobs.nextRetryAt), lte(videoJobs.nextRetryAt, now))
```

Return the field from lock acquisition so tests and diagnostics observe the same state.

- [x] **Step 4: Run the focused tests and verify GREEN**

Run: `pnpm exec vitest run src/server/jobs/locks.test.ts src/server/jobs/state-machine.test.ts`

Expected: PASS.

### Task 2: Retry transient Post-QA provider failures without releasing credits

**Files:**
- Modify: `src/server/post-qa/check.ts`
- Test: `src/server/post-qa/check.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests proving the first two `provider_unavailable` outcomes create failed attempt records, requeue the job with increasing `nextRetryAt`, and leave the wallet reserved. Prove the third outcome uses the existing terminal fail-closed path and releases the reservation. Prove a semantic QA failure and `provider_schema_error` remain terminal immediately.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/server/post-qa/check.test.ts`

Expected: FAIL because the first provider error currently calls `resolvePostQaResult` and releases credits.

- [ ] **Step 3: Implement bounded persisted retry**

Before terminal resolution, count prior `provider_unavailable` results. For the first two failures, save the failed attempt and transition:

```text
post_qa_running -> post_qa_failed -> retrying -> post_qa_queued
```

Set a bounded backoff timestamp, clear the worker lock, and do not call capture/release. On the third failure, retain the existing terminal fail-closed behavior. Do not change mode, model routing, or QA parsing.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/server/post-qa/check.test.ts`

Expected: PASS.

### Task 3: Bind resolution idempotency to each reservation

**Files:**
- Modify: `src/server/post-qa/resolve.ts`
- Test: `src/server/post-qa/resolve.test.ts`

- [ ] **Step 1: Write failing tests**

Resolve two successive reservations for the same job and assert each produces its own capture/release entry. Assert a paid job without `reservedLedgerId` fails closed before wallet mutation.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run src/server/post-qa/resolve.test.ts`

Expected: FAIL because capture/release currently use one fixed key per job/failure type.

- [ ] **Step 3: Implement reservation-scoped keys**

Use keys shaped as:

```ts
`${operation}:job:${jobId}:reserve:${reservedLedgerId}`
```

Keep `reservedLedgerId` in ledger metadata and require it for paid resolution.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run src/server/post-qa/resolve.test.ts`

Expected: PASS.

### Task 4: Make admin Post-QA reopen atomic and idempotent

**Files:**
- Modify: `src/lib/credits/drizzle-store.ts`
- Modify: `src/server/admin/job-actions.ts`
- Modify: `src/app/api/admin/jobs/[id]/reopen-post-qa/route.ts`
- Test: `src/server/admin/job-actions.test.ts`
- Test: `src/app/api/admin/jobs/[id]/reopen-post-qa/route.test.ts`

- [ ] **Step 1: Write failing tests**

Prove a released paid job is re-reserved, `reservedLedgerId` changes to the new reserve, a duplicate call does not freeze twice, an unresolved reservation is reused, and insufficient balance leaves the job failed with no partial state change.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `pnpm exec vitest run src/server/admin/job-actions.test.ts src/app/api/admin/jobs/[id]/reopen-post-qa/route.test.ts`

Expected: FAIL because reopen currently changes only state and has no reservation transaction.

- [ ] **Step 3: Implement the atomic reopen store**

Expose a credit-ledger adapter for an existing Drizzle transaction. In one transaction: lock the job row, validate the successful stitch and frames, detect whether the current reservation has a matching capture/release/refund, reserve only when needed, update `reserved_ledger_id`, clear errors/locks/retry time, set `post_qa_queued`, and insert both state events. Treat a repeated request against the reservation created by this reopen as idempotent. Never auto-grant credits.

- [ ] **Step 4: Map insufficient balance to a conflict response**

Return a stable 409 API response for insufficient available credits rather than a generic 500.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `pnpm exec vitest run src/server/admin/job-actions.test.ts src/app/api/admin/jobs/[id]/reopen-post-qa/route.test.ts`

Expected: PASS.

### Task 5: Regression verification and documentation alignment

**Files:**
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] **Step 1: Update product/implementation rules**

Document bounded retry for transient Post-QA provider outages, no release before exhaustion, reservation-scoped resolution, and atomic paid admin reopen.

- [ ] **Step 2: Run focused regression tests**

Run: `pnpm exec vitest run src/server/jobs/locks.test.ts src/server/jobs/state-machine.test.ts src/server/post-qa/check.test.ts src/server/post-qa/resolve.test.ts src/server/workers/post-qa-tick.test.ts src/server/admin/job-actions.test.ts src/app/api/admin/jobs/[id]/reopen-post-qa/route.test.ts src/lib/credits/ledger.test.ts`

Expected: PASS.

- [ ] **Step 3: Run static verification**

Run: `pnpm exec tsc --noEmit --pretty false`

Expected: exit 0.

- [ ] **Step 4: Run the full suite once**

Run: `pnpm test -- --reporter=dot`

Expected: all tests pass.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check` and inspect only the task-related diff. Confirm no production database writes, no Strict downgrade, no model fallback, and no unrelated worktree changes were reverted.
