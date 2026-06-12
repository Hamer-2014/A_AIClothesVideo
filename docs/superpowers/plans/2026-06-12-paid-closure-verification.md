# Paid Closure Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce real evidence that paid delivery and paid failure compensation both work, then make `npm run verify:blockers` pass.

**Architecture:** This plan uses existing Next.js APIs, server services, Neon tables, Cloud Run stitch worker, R2 storage, and verification scripts. It should prefer exercising real system paths over adding new product features; code changes are allowed only when the real run exposes a bug or missing operator tooling.

**Tech Stack:** Next.js, TypeScript, Drizzle, Neon Postgres, Cloudflare R2, Cloud Run stitch-worker, Vitest, Node scripts, Creem moderation, DeepSeek, EvoLink.

---

## Scope

Implement only the closure work described in `docs/superpowers/specs/2026-06-12-paid-closure-verification-design.md`.

Do not start UI redesign, pricing changes, template expansion, model provider refactors, or landing page work in this session.

## Key Files

- Read: `docs/PRD.md`
- Read: `docs/IMPLEMENTATION_PLAN.md`
- Read: `docs/API_TEST_STATUS.md`
- Read: `docs/verification/backend-api-blockers.md`
- Read: `src/server/storyboard/confirm.ts`
- Read: `src/server/post-qa/resolve.ts`
- Read: `src/server/admin/job-actions.ts`
- Read: `src/server/video/segments.ts`
- Read: `src/server/stitch/jobs.ts`
- Use: `scripts/admin-adjust-credits.mjs`
- Use: `scripts/backend-smoke.mjs`
- Use: `scripts/verify-blockers.mjs`
- Use: `scripts/generation-debug.mjs`
- Modify if needed: `scripts/lib/backend-smoke-utils.mjs`
- Modify if needed: `scripts/lib/blocker-verification-utils.mjs`
- Modify when done: `docs/API_TEST_STATUS.md`
- Modify when done: `docs/verification/backend-api-blockers.md`

## Task 1: Baseline Verification

**Files:**
- Read: `docs/API_TEST_STATUS.md`
- Read: `docs/verification/backend-api-blockers.md`
- No code changes expected.

- [ ] **Step 1: Confirm clean working tree**

Run:

```bash
git status --short
```

Expected:

- Empty output, or only unrelated user changes. Do not revert user changes.

- [ ] **Step 2: Run baseline typecheck**

Run:

```bash
npm run typecheck
```

Expected:

- Exit code `0`.

- [ ] **Step 3: Run baseline tests**

Run:

```bash
npm test
```

Expected:

- Exit code `0`.
- All tests pass.

- [ ] **Step 4: Run baseline build**

Run:

```bash
npm run build
```

Expected:

- Exit code `0`.
- Next.js route list includes `/api/internal/post-qa/resolve`, `/api/internal/stitch/jobs`, `/api/internal/worker/tick`, `/api/jobs/[id]/confirm`, `/api/webhooks/creem`.

- [ ] **Step 5: Capture current blocker state**

Run:

```bash
npm run verify:blockers -- --json
```

Expected at task start:

- `paid_delivery.passed = false`
- `failure_compensation.passed = false`
- `audit_evidence.passed = true`

If `paid_delivery` or `failure_compensation` is already true, record the job id from the JSON and skip the matching evidence creation task.

## Task 2: Prepare Test User Credits

**Files:**
- Use: `scripts/admin-adjust-credits.mjs`
- Read if needed: `src/server/admin/billing.ts`
- No code changes expected unless the script fails for a real bug.

- [ ] **Step 1: Pick a real test user**

Use an existing test user that can log into the app. The user must exist in the `users` table and must not be a fake row inserted directly for this task.

Record:

```text
TEST_USER_EMAIL=<the selected user's email>
```

- [ ] **Step 2: Add enough credits through the admin script**

Run with the actual email:

```bash
node scripts/admin-adjust-credits.mjs --email "<TEST_USER_EMAIL>" --amount 500 --reason "paid closure verification credits" --json
```

Expected:

- Exit code `0`.
- JSON output contains `ledger.type = "admin_adjust"`.
- JSON output contains `wallet.availableBalance >= 500`.
- JSON output contains `auditId`.

- [ ] **Step 3: Verify audit evidence still passes**

Run:

```bash
npm run verify:blockers -- --json
```

Expected:

- `audit_evidence.passed = true`.
- It is acceptable for `paid_delivery` and `failure_compensation` to remain false here.

## Task 3: Produce Paid Delivery Evidence

**Files:**
- Use: `src/app/(dashboard)/workspace/page.tsx`
- Use: `src/app/api/jobs/route.ts`
- Use: `src/app/api/jobs/[id]/analyze/route.ts`
- Use: `src/app/api/jobs/[id]/storyboard/route.ts`
- Use: `src/app/api/jobs/[id]/confirm/route.ts`
- Use: `scripts/generation-debug.mjs`
- Use: `scripts/backend-smoke.mjs`
- Modify code only if the real paid path exposes a defect.

- [ ] **Step 1: Create a non-trial paid task**

Through the logged-in app, create a job with:

```text
durationSeconds=8
aspectRatio=9:16
isTrial=false
isTest=true
```

Use a real test garment image from `test-assets/` or another owned test asset. Do not use a database-only fake asset.

Expected:

- A new `video_jobs.id` exists.
- `video_jobs.credit_cost > 0`, normally `70` for 8 seconds.

Record:

```text
PAID_DELIVERY_JOB_ID=<new job id>
```

- [ ] **Step 2: Analyze assets and generate storyboard**

Complete these through the UI where possible:

- Run asset analysis.
- Select one available low-risk template.
- Generate storyboard with a normal product prompt.
- Confirm storyboard.

Expected after confirmation:

- `credit_ledger` for `PAID_DELIVERY_JOB_ID` contains `reserve`.
- `video_segments` contains exactly 1 row for an 8 second task.
- Job reaches `segments_queued` or `segment_generating`.

- [ ] **Step 3: Inspect generation status**

Run:

```bash
node scripts/generation-debug.mjs <PAID_DELIVERY_JOB_ID> status
```

Expected:

- Output includes `JOB`, `SEGMENTS`, `PROVIDER_LOGS`, and `EVENTS`.
- If a provider call failed, read the real error and fix the concrete cause. Do not mark the task succeeded manually.

- [ ] **Step 4: Let generation, stitch, and Post-QA complete**

Use the app, worker tick, or existing smoke script to progress the task. If the job reaches `segment_succeeded` and no stitch job exists, run:

```bash
npm run smoke:backend -- --job-id <PAID_DELIVERY_JOB_ID>
```

Expected:

- Cloud Run health check passes.
- Final stitched video exists in R2.
- QA frames exist in R2.
- Job eventually reaches `deliverable`.

- [ ] **Step 5: Run full backend smoke on paid delivery job**

Run:

```bash
npm run smoke:backend -- --job-id <PAID_DELIVERY_JOB_ID>
```

Expected:

- Exit code `0`.
- JSON output includes `snapshot.job.status = "deliverable"`.
- JSON output includes `snapshot.job.credit_cost > 0`.
- JSON output includes both `reserve` and `capture` in `snapshot.ledger`.
- JSON output includes `artifacts.finalVideoExists = true`.
- JSON output includes `artifacts.frameCount > 0`.

If this fails because `capture` is missing, inspect `src/server/post-qa/resolve.ts` and the latest `post_qa_results`; fix the real bug and add or update focused tests.

## Task 4: Produce Paid Failure Compensation Evidence

**Files:**
- Use: `src/app/api/internal/post-qa/resolve/route.ts`
- Use: `src/server/post-qa/resolve.ts`
- Use: `scripts/generation-debug.mjs`
- Use: `scripts/verify-blockers.mjs`
- Modify code only if release/refund is not written by the real service path.

- [ ] **Step 1: Create a second non-trial paid task**

Create a separate job with:

```text
durationSeconds=8
aspectRatio=9:16
isTrial=false
isTest=true
```

Record:

```text
FAILED_COMPENSATION_JOB_ID=<new job id>
```

Expected:

- `video_jobs.credit_cost > 0`.
- This job id is different from `PAID_DELIVERY_JOB_ID`.

- [ ] **Step 2: Confirm storyboard to reserve credits**

Run the same analysis, template selection, storyboard generation, and confirmation flow as Task 3.

Expected:

- `credit_ledger` for `FAILED_COMPENSATION_JOB_ID` contains `reserve`.
- `video_jobs.reserved_ledger_id` is not null.

- [ ] **Step 3: Trigger failure through the Post-QA resolve API**

Use PowerShell with real environment values:

```powershell
$appUrl = $env:APP_URL.TrimEnd("/")
$secret = $env:INTERNAL_WORKER_SECRET
$jobId = "<FAILED_COMPENSATION_JOB_ID>"
$body = @{
  jobId = $jobId
  status = "failed"
  mode = "lite"
  frameKeys = @()
  resultJson = @{
    source = "paid_closure_verification"
    reason = "forced_post_qa_failure_drill"
  }
  failureCategory = "forced_post_qa_failure_drill"
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Method Post `
  -Uri "$appUrl/api/internal/post-qa/resolve" `
  -Headers @{ "x-worker-secret" = $secret; "content-type" = "application/json" } `
  -Body $body
```

Expected response:

```json
{
  "jobId": "<FAILED_COMPENSATION_JOB_ID>",
  "status": "failed_released",
  "ledgerType": "release"
}
```

This is a controlled compensation drill. It is acceptable because it uses the existing internal API and service code path; it is not acceptable to update `video_jobs` or `credit_ledger` directly by SQL.

- [ ] **Step 4: Inspect the failed compensation job**

Run:

```bash
node scripts/generation-debug.mjs <FAILED_COMPENSATION_JOB_ID> status
```

Expected:

- `JOB.status` is `failed_released`.
- `EVENTS` contains `post_qa_failed` and `post_qa_failed_released`.

- [ ] **Step 5: Verify blocker check sees failure compensation**

Run:

```bash
npm run verify:blockers -- --json
```

Expected:

- `failure_compensation.passed = true`.
- Evidence contains `FAILED_COMPENSATION_JOB_ID`.

If this fails because `release` is missing, inspect `src/server/post-qa/resolve.ts` and `src/lib/credits/ledger.ts`; fix the actual idempotency or ledger issue and add a focused test.

## Task 5: Final Verification

**Files:**
- Use: all files touched in prior tasks.

- [ ] **Step 1: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

- Exit code `0`.

- [ ] **Step 2: Run tests**

Run:

```bash
npm test
```

Expected:

- Exit code `0`.
- All tests pass.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected:

- Exit code `0`.

- [ ] **Step 4: Run backend smoke for the paid delivery job**

Run:

```bash
npm run smoke:backend -- --job-id <PAID_DELIVERY_JOB_ID>
```

Expected:

- Exit code `0`.
- Paid delivery job remains `deliverable`.
- Paid ledger contains `reserve` and `capture`.

- [ ] **Step 5: Run blocker verification**

Run:

```bash
npm run verify:blockers -- --json
```

Expected:

- Exit code `0`.
- Top-level `passed = true`.
- `paid_delivery.passed = true`.
- `failure_compensation.passed = true`.
- `audit_evidence.passed = true`.

## Task 6: Update Evidence Documentation

**Files:**
- Modify: `docs/API_TEST_STATUS.md`
- Modify: `docs/verification/backend-api-blockers.md`

- [ ] **Step 1: Update API test status**

Append this section to `docs/API_TEST_STATUS.md`, replacing the bracketed values with actual evidence:

```markdown
## 2026-06-12 Paid Closure Verification

- Paid delivery job id: `[PAID_DELIVERY_JOB_ID]`
- Paid delivery smoke command: `npm run smoke:backend -- --job-id [PAID_DELIVERY_JOB_ID]`
- Paid delivery result:
  - `video_jobs.status = deliverable`
  - `credit_cost > 0`
  - `credit_ledger` contains `reserve` and `capture`
  - final video exists in R2
  - QA frames exist in R2
- Failure compensation job id: `[FAILED_COMPENSATION_JOB_ID]`
- Failure compensation trigger: `POST /api/internal/post-qa/resolve` with `status = failed`
- Failure compensation result:
  - `video_jobs.status = failed_released`
  - `credit_ledger` contains `release`
  - `job_state_events` contains failed compensation transitions
- Final blocker command: `npm run verify:blockers -- --json`
- Final blocker result: `passed = true`
- Residual risks:
  - Creem real checkout/webhook approval remains separate if still pending.
  - This verification proves one paid success and one controlled paid failure compensation sample, not large-scale provider stability.
```

- [ ] **Step 2: Update blocker runbook**

In `docs/verification/backend-api-blockers.md`, add a short “最近一次通过证据” section with:

```markdown
## 最近一次通过证据

- Date: 2026-06-12
- Paid delivery job id: `[PAID_DELIVERY_JOB_ID]`
- Failure compensation job id: `[FAILED_COMPENSATION_JOB_ID]`
- Verification command: `npm run verify:blockers -- --json`
- Result: `passed = true`
```

Do not delete the existing “不接受的通过方式” section.

- [ ] **Step 3: Re-run docs-safe verification**

Run:

```bash
npm run typecheck
npm test
npm run verify:blockers -- --json
```

Expected:

- All commands exit `0`.

## Task 7: Handoff Packet For Review

**Files:**
- Read: `git diff --stat`
- Read: `git diff -- docs/API_TEST_STATUS.md docs/verification/backend-api-blockers.md`

- [ ] **Step 1: Summarize changed files**

Run:

```bash
git diff --stat
```

Expected:

- Only relevant code/test/docs files are changed.
- No `.env.local`, generated videos, R2 artifacts, `.next`, or secrets are included.

- [ ] **Step 2: Prepare review summary**

The final message to the reviewer must include:

```text
Paid delivery job id:
Failure compensation job id:
Commands passed:
- npm run typecheck
- npm test
- npm run build
- npm run smoke:backend -- --job-id <PAID_DELIVERY_JOB_ID>
- npm run verify:blockers -- --json
Code changes made:
Docs updated:
Residual risks:
```

## Stop Conditions

Stop and report instead of forcing green if:

- Creem Moderation is unavailable in a non-development mode.
- EvoLink generation repeatedly fails with provider-side errors after normal retry limits.
- Cloud Run health check fails.
- R2 final video or QA frames are missing after stitch success.
- `credit_ledger.capture` or `release` requires direct SQL edits to appear.
- A test user cannot be authenticated or associated with real app-created assets.

If you hit one of these, document the exact command, error, job id, and current state from `scripts/generation-debug.mjs`.

