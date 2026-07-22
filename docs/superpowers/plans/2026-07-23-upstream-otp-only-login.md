# Upstream OTP-Only Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use focused TDD and the project AGENTS.md streamlined review process. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync `upstream/main` through `de55a2d`, complete Email OTP sign-in, remove Magic Link as a login method, then merge the verified feature branch into `main`.

**Architecture:** Keep Google OAuth and Better Auth Email OTP only. Port the upstream OTP verification UX while retaining the current project's structured auth-email failure handling. Remove Magic Link from the UI, client plugin, server plugin, route classification, and current product documentation, while keeping historical database enum values and migrations intact.

**Tech Stack:** Next.js 16, React 19, TypeScript, better-auth, Vitest, Testing Library, Drizzle/PostgreSQL.

---

### Task 1: Complete the Email OTP login flow

**Files:**
- Modify: `src/app/(auth)/login/login-form.test.tsx`
- Modify: `src/app/(auth)/login/login-form.tsx`

- [ ] **Step 1: Write failing login behavior tests**

Add tests proving that sending OTP reveals a six-digit input, submitting calls:

```ts
authClient.signIn.emailOtp({ email: "seller@example.com", otp: "123456" });
```

and successful verification calls `router.replace(callbackURL)` plus `router.refresh()`. Add an invalid-code test and assert no Magic Link control is rendered.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run "src/app/(auth)/login/login-form.test.tsx"`

Expected: failures because the OTP input/sign-in flow is missing and Magic Link is still rendered.

- [ ] **Step 3: Implement the minimal OTP-only form**

Use `useRouter`, keep one synchronous action lock for Google/send/verify, freeze the destination email after sending, accept exactly six numeric digits, and remove all `magic-link` state/actions/buttons.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `pnpm exec vitest run "src/app/(auth)/login/login-form.test.tsx"`

Expected: all login-form tests pass.

### Task 2: Close Magic Link backend and documentation surfaces

**Files:**
- Modify: `src/lib/auth/client.ts`
- Modify: `src/lib/auth/config.test.ts`
- Modify: `src/lib/auth/config.ts`
- Modify: `src/lib/auth/email.test.ts`
- Modify: `src/lib/auth/email.ts`
- Modify: `src/app/api/auth/[...all]/route.test.ts`
- Modify: `src/app/api/auth/[...all]/route.ts`
- Modify: `.env.example`
- Modify: `docs/PRD.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/superpowers/specs/2026-06-06-auth-design.md`

- [ ] **Step 1: Write failing configuration and route tests**

Assert the server plugin list contains Email OTP but never initializes `magicLink`, the client only registers `emailOTPClient()`, and `/sign-in/magic-link` is no longer treated as a supported email-send endpoint.

- [ ] **Step 2: Run auth tests and verify RED**

Run:

```powershell
pnpm exec vitest run "src/lib/auth/config.test.ts" "src/lib/auth/email.test.ts" "src/app/api/auth/[...all]/route.test.ts"
```

Expected: failures while Magic Link imports, plugin registration, templates, or route handling remain.

- [ ] **Step 3: Remove active Magic Link implementation**

Keep the historical `magic_link` database enum for migration compatibility, but reduce active configuration to:

```ts
plugins: [emailOTP({ /* existing OTP delivery and rate limits */ })]
```

and reduce the client to:

```ts
plugins: [emailOTPClient()]
```

Update current product documentation from `Google OAuth + Email OTP/Magic Link` to `Google OAuth + Email OTP`.

- [ ] **Step 4: Run auth tests and verify GREEN**

Run the same focused auth command. Expected: all tests pass.

### Task 3: Sync development runtime and integrate the branch

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Port upstream webpack development mode**

Set:

```json
"dev": "next dev --webpack"
```

- [ ] **Step 2: Run global acceptance**

Run:

```powershell
pnpm test -- --reporter=dot
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Expected: every command exits `0`.

- [ ] **Step 3: Review and commit the feature branch**

Confirm all dirty files belong to the AI Clothes Video implementation, commit them on `feat/ai-clothes-video-v1`, and do not commit secrets or generated build output.

- [ ] **Step 4: Merge into main**

Switch to `main`, merge `feat/ai-clothes-video-v1` without rewriting history, rerun the final smoke gate, and push `main` to `origin` only after the local merge succeeds.
