# Creem Account Review Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the locally verifiable gaps against Creem Account Review and Prompt Moderation requirements before the merchant applies manually.

**Architecture:** Keep prompt moderation fail-closed at both user-input and final-video-prompt boundaries. Add production-only Creem credential/base-URL validation to the runtime client and health report, enforce the job-state invariant immediately before video-provider submission, and expose the brand support address inside the authenticated billing dashboard.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library, Drizzle/Postgres.

---

### Task 1: Production Creem moderation configuration gate

**Files:**
- Create: `src/lib/providers/creem/config.ts`
- Modify: `src/lib/providers/creem/client.ts`
- Modify: `src/lib/providers/creem/client.test.ts`
- Modify: `src/lib/providers/creem/moderation.ts`
- Modify: `src/lib/providers/creem/moderation.test.ts`
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`
- Modify: `.env.example`

- [x] **Step 1: Write failing tests**

Add tests proving production rejects `https://test-api.creem.io`, rejects a `creem_test_` moderation key, accepts `https://api.creem.io` with a `creem_` live key, and uses a 5,000 ms default timeout.

- [x] **Step 2: Run the focused tests and verify RED**

```powershell
pnpm exec vitest run src/lib/providers/creem/moderation.test.ts src/server/ops/health.test.ts
```

Expected: FAIL because current validation only checks whether values are non-empty and the timeout is 8,000 ms.

- [x] **Step 3: Implement the production-only validation**

Treat invalid production URL/key values as unavailable, retain sandbox support outside production, and report invalid values using the existing `missing` health field without exposing secrets.

- [x] **Step 4: Run the focused tests and verify GREEN**

```powershell
pnpm exec vitest run src/lib/providers/creem/moderation.test.ts src/server/ops/health.test.ts
```

Expected: PASS.

### Task 2: Video provider boundary invariant

**Files:**
- Modify: `src/server/video/segments.ts`
- Modify: `src/server/video/segments.test.ts`

- [x] **Step 1: Write a failing bypass test**

Create a queued segment whose job is still `prompt_moderation_running` and assert `createVideoGeneration` is never called.

- [x] **Step 2: Run the focused test and verify RED**

```powershell
pnpm exec vitest run src/server/video/segments.test.ts
```

Expected: FAIL because a queued segment is currently sufficient to call the provider.

- [x] **Step 3: Enforce allowed generation job states**

Permit submissions only for `segments_queued` and `segment_generating`; fail before claiming the segment, signing assets, or calling a provider for every earlier/later state.

- [x] **Step 4: Run the focused test and verify GREEN**

```powershell
pnpm exec vitest run src/server/video/segments.test.ts
```

Expected: PASS.

### Task 3: Authenticated support contact

**Files:**
- Modify: `src/components/billing/credit-ledger.tsx`
- Create: `src/components/billing/credit-ledger.test.tsx`

- [x] **Step 1: Write a failing dashboard support test**

Render `CreditLedger` and assert a visible `mailto:support@aiclothesvideo.com` link with a three-business-day response expectation.

- [x] **Step 2: Run the focused test and verify RED**

```powershell
pnpm exec vitest run src/components/billing/credit-ledger.test.tsx
```

Expected: FAIL because the dashboard currently has no support contact.

- [x] **Step 3: Add the support section using the shared email constant**

Import `SUPPORT_EMAIL` so the public footer, legal pages, health gate, and authenticated dashboard cannot drift to different addresses.

- [x] **Step 4: Run the focused test and verify GREEN**

```powershell
pnpm exec vitest run src/components/billing/credit-ledger.test.tsx
```

Expected: PASS.

### Task 4: Final verification and manual evidence split

**Files:**
- Modify: `docs/superpowers/plans/2026-07-23-creem-account-review-readiness.md`

- [x] **Step 1: Verify both moderation call sites**

Confirm `generateStoryboardDraft` moderates raw user input before DeepSeek and `confirmStoryboard` moderates the final prompt before credit reservation and segment creation.

- [x] **Step 2: Run repository gates once**

```powershell
pnpm exec vitest run --reporter=dot
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Expected: all commands pass.

- [x] **Step 3: Record non-code review prerequisites**

Keep production uptime, real live-key moderation evidence, domain-email deliverability, Business Details/receipt email matching, KYC/tax/payout setup, trademark checks, and Creem's final decision as manual blockers. Do not store credentials, identity documents, or banking data in Git.

Verification completed on 2026-07-23: 198 test files / 939 tests passed, followed by full lint, typecheck, production build, and diff validation. This is local implementation evidence only; it is not a Creem approval or a production credential check.
