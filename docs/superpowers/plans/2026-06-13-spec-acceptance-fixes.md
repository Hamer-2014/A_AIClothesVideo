# MVP Risk Closure SPEC Acceptance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining SPEC acceptance gaps after the first implementation pass, excluding the already-addressed APIMart resolution regression.

**Architecture:** Keep changes narrow and behavior-driven: normalize abuse hashing through one helper, treat cover upload as optional delivery metadata, make `model_routes` fallback behavior explicit, and prove route auditing with a fresh paid deliverable sample. Do not weaken `verify:blockers`; produce evidence that satisfies it.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Drizzle, PostgreSQL, Cloud Run stitch worker, Cloudflare R2.

---

## Current Failed Acceptance Points

- `verify:blockers` fails because existing paid delivery samples lack `provider_call_logs.model_route_id` / `route_snapshot`.
- `workers/stitch-worker/src/stitch.ts` catches cover extraction failure but not cover upload failure.
- `src/server/providers/model-route-resolver.ts` validates fallback margin but never actually selects fallback.
- `src/server/jobs/create-job.ts` hashes `trial_granted` signals with `abuseHashSecret ?? ""`, while eligibility uses the dev fallback secret in non-production.

Do not modify `src/lib/providers/apimart/video.ts` in this plan unless the APIMart resolution fix is still uncommitted and the user explicitly asks you to include it.

---

## Files

- Modify: `src/server/abuse/trial-eligibility.ts`
  - Export a shared hash secret resolver so eligibility checks and grant writes use the same secret.
- Modify: `src/server/jobs/create-job.ts`
  - Use the shared secret resolver when writing `trial_granted` hashes.
- Modify: `src/server/jobs/create-job.test.ts`
  - Add regression coverage for dev fallback hash consistency.
- Modify: `workers/stitch-worker/src/stitch.ts`
  - Catch cover upload errors and return success with `coverKey: null` plus warning.
- Modify: `workers/stitch-worker/src/stitch.test.ts`
  - Add regression coverage for cover upload failure.
- Modify: `src/server/providers/model-route-resolver.ts`
  - Either implement real fallback or remove unsupported fallback claims from code/tests/docs. Recommended for this plan: implement real fallback because SPEC already defines it.
- Modify: `src/server/providers/model-route-resolver.test.ts`
  - Add success case for allowed fallback and keep denial cases.
- Modify: `src/server/video/segments.test.ts`
  - Add or verify route-paused submit failure remains covered.
- Modify: `docs/API_TEST_STATUS.md`
  - Replace any “completed” wording that is only locally true with exact verification status.
- Modify: `docs/IMPLEMENTATION_PLAN.md`
  - Update remaining work and production verification notes.

---

### Task 1: Free Trial Hash Consistency

**Files:**
- Modify: `src/server/abuse/trial-eligibility.ts`
- Modify: `src/server/jobs/create-job.ts`
- Modify: `src/server/jobs/create-job.test.ts`

- [ ] **Step 1: Export the hash secret resolver**

In `src/server/abuse/trial-eligibility.ts`, replace the private `resolveHashSecret` function with an exported function:

```ts
export function resolveAbuseHashSecret({
  hashSecret,
  environment,
}: {
  hashSecret?: string | null;
  environment: string;
}) {
  const explicitSecret = hashSecret?.trim();
  if (explicitSecret) {
    return explicitSecret;
  }

  if (environment === "production") {
    return null;
  }

  return "dev-abuse-hash-secret-do-not-use-in-production";
}
```

Then update `evaluateTrialEligibility`:

```ts
const secret = resolveAbuseHashSecret({ hashSecret, environment });
```

- [ ] **Step 2: Write the failing regression test**

Append this test to `src/server/jobs/create-job.test.ts`:

```ts
it("uses the same dev fallback abuse hash secret for trial check and granted signals", async () => {
  const store = createInMemoryVideoJobCreationStore([
    {
      id: "asset-front",
      userId,
      status: "uploaded",
      detectedRole: "front",
    },
  ]);

  await createVideoJobWithAssets({
    store,
    userId,
    assetIds: ["asset-front"],
    durationSeconds: 8,
    aspectRatio: "9:16",
    useFreeTrialIfAvailable: true,
    email: "seller@example.com",
    emailVerified: true,
    deviceFingerprint: "device-1",
    requestContext: {
      ipAddress: "203.0.113.10",
      userAgent: "Vitest Browser",
      path: "/api/jobs",
    },
    abuseHashSecret: null,
    appEnvironment: "development",
    now: new Date("2026-06-13T08:00:00.000Z"),
  });

  const signals = store.listTrialAbuseSignals();
  const check = signals.find((signal) => signal.eventType === "trial_check");
  const granted = signals.find((signal) => signal.eventType === "trial_granted");

  expect(check).toBeTruthy();
  expect(granted).toBeTruthy();
  expect(granted?.ipHash).toBe(check?.ipHash);
  expect(granted?.deviceFingerprintHash).toBe(check?.deviceFingerprintHash);
  expect(granted?.userAgentHash).toBe(check?.userAgentHash);
});
```

- [ ] **Step 3: Run the test and confirm it fails before implementation**

Run:

```bash
npx vitest run src/server/jobs/create-job.test.ts --reporter=verbose
```

Expected before implementation: the new test fails because granted signal hashes differ from check signal hashes.

- [ ] **Step 4: Use the shared resolver in job creation**

In `src/server/jobs/create-job.ts`, update the import:

```ts
import {
  evaluateTrialEligibility,
  resolveAbuseHashSecret,
  type TrialAbuseSignalInput,
  type TrialEligibilityInput,
  type TrialEligibilityStore,
} from "@/server/abuse/trial-eligibility";
```

Before writing the `trial_granted` signal, compute:

```ts
const resolvedAbuseHashSecret = resolveAbuseHashSecret({
  hashSecret: abuseHashSecret,
  environment: appEnvironment,
});
```

Then replace the three grant hashes:

```ts
ipHash: hashAbuseSignal(requestContext?.ipAddress, resolvedAbuseHashSecret ?? ""),
deviceFingerprintHash: hashAbuseSignal(
  deviceFingerprint,
  resolvedAbuseHashSecret ?? "",
),
userAgentHash: hashAbuseSignal(
  requestContext?.userAgent,
  resolvedAbuseHashSecret ?? "",
),
```

Production with missing secret cannot reach this grant branch because eligibility denies first, so `?? ""` is only a defensive fallback.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run src/server/abuse/hash.test.ts src/server/abuse/trial-eligibility.test.ts src/server/jobs/create-job.test.ts
```

Expected: all tests pass.

---

### Task 2: Cover Upload Failure Must Not Fail Stitch Delivery

**Files:**
- Modify: `workers/stitch-worker/src/stitch.ts`
- Modify: `workers/stitch-worker/src/stitch.test.ts`

- [ ] **Step 1: Add failing worker test**

Append this test to `workers/stitch-worker/src/stitch.test.ts`:

```ts
it("continues delivery when cover upload fails", async () => {
  const uploads: string[] = [];
  const callbacks: unknown[] = [];

  const result = await runStitchJob({
    payload: {
      stitchJobId: "stitch-1",
      videoJobId: "job-1",
      segmentKeys: ["segments/a.mp4"],
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeyPrefix: "jobs/job-1/qa/frames",
      postQaMode: "lite",
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
    },
    config: {
      workerSecret: "secret",
      callbackSecret: "callback-secret",
      bucket: "bucket",
      r2Endpoint: "https://account.r2.cloudflarestorage.com",
      r2AccessKeyId: "access",
      r2SecretAccessKey: "private",
    },
    createWorkDir: async () => "/tmp/stitch-1",
    writeTextFile: async () => {},
    downloadObject: async () => {},
    uploadObject: async ({ key }) => {
      uploads.push(key);
      if (key.endsWith("cover.webp")) {
        throw new Error("cover upload failed");
      }
    },
    stitchSegments: async () => {},
    extractCoverFrame: async () => {},
    extractQaFrames: async () => ["/tmp/stitch-1/frames/frame-0.jpg"],
    listExtractedQaFrames: async () => ["/tmp/stitch-1/frames/frame-0.jpg"],
    sendCallback: async ({ result }) => {
      callbacks.push(result);
    },
    cleanupWorkDir: async () => {},
  });

  expect(result).toMatchObject({
    status: "succeeded",
    finalVideoKey: "jobs/job-1/stitched/final.mp4",
    coverKey: null,
  });
  expect(uploads).toContain("jobs/job-1/stitched/final.mp4");
  expect(uploads).toContain("jobs/job-1/covers/cover.webp");
  expect(callbacks[0]).toMatchObject({
    status: "succeeded",
    coverKey: null,
    warnings: ["cover_upload_failed: cover upload failed"],
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run:

```bash
npx vitest run workers/stitch-worker/src/stitch.test.ts --reporter=verbose
```

Expected before implementation: the new test fails with `cover upload failed`.

- [ ] **Step 3: Catch cover upload errors**

In `workers/stitch-worker/src/stitch.ts`, replace the cover upload block:

```ts
if (generatedCoverKey) {
  await upload({
    key: generatedCoverKey,
    sourcePath: coverPath,
    contentType: "image/webp",
  });
}
```

with:

```ts
if (generatedCoverKey) {
  try {
    await upload({
      key: generatedCoverKey,
      sourcePath: coverPath,
      contentType: "image/webp",
    });
  } catch (error) {
    warnings.push(
      `cover_upload_failed: ${
        error instanceof Error ? error.message : "Unknown cover upload error"
      }`,
    );
    generatedCoverKey = null;
  }
}
```

This preserves final video and QA frame delivery. Do not catch final video upload failure or QA frame upload failure in this task; those are core deliverables.

- [ ] **Step 4: Run worker tests and worker build**

Run:

```bash
npx vitest run workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/stitch.test.ts
cd workers/stitch-worker
npm run build
cd ../..
```

Expected: tests and worker TypeScript build pass.

---

### Task 3: Implement Explicit Model Route Fallback

**Files:**
- Modify: `src/server/providers/model-route-resolver.ts`
- Modify: `src/server/providers/model-route-resolver.test.ts`
- Modify: `src/server/video/segments.test.ts`

**Decision:** Implement fallback because the SPEC already defines `allow_public_fallback`, `fallbackProviderId`, `fallbackModel`, and margin constraints. If the product owner later decides fallback should remain disabled for MVP, remove fallback claims from SPEC and docs instead.

- [ ] **Step 1: Add fallback success test**

Append this test to `src/server/providers/model-route-resolver.test.ts`:

```ts
it("uses fallback provider when public fallback is enabled, primary is unavailable, and margin is valid", async () => {
  const result = await resolveModelRoute({
    store: createInMemoryModelRouteStore({
      routes: [
        {
          id: routeId,
          purpose: "video_generation",
          environment: "production",
          primaryProviderId: providerId,
          primaryModel: "pixverse-v6",
          fallbackProviderId: "fallback-provider",
          fallbackModel: "veo3.1-fast-beta",
          status: "active",
          minMarginPercent: 45,
          allowPublicFallback: "true",
        },
      ],
      providers: [
        { id: providerId, name: "apimart", status: "paused" },
        { id: "fallback-provider", name: "evolink", status: "active" },
      ],
      keys: [
        {
          id: "fallback-key",
          providerId: "fallback-provider",
          environment: "production",
          status: "active",
          currentConcurrency: 0,
          concurrentLimit: 2,
          currentDailyCost: "1.000000",
          dailyCostLimit: "10.000000",
          failureCount: 0,
        },
      ],
    }),
    purpose: "video_generation",
    environment: "production",
    isPublicJob: true,
    estimatedRevenueCredits: 70,
    estimatedCostUsd: 0.2,
  });

  expect(result).toMatchObject({
    routeId,
    provider: "evolink",
    model: "veo3.1-fast-beta",
    providerKeyId: "fallback-key",
    source: "database",
  });
  expect(result.routeSnapshot).toMatchObject({
    routeId,
    primaryProvider: "apimart",
    primaryModel: "pixverse-v6",
    selectedProvider: "evolink",
    selectedModel: "veo3.1-fast-beta",
    routeSource: "database",
    fallbackPolicy: {
      allowPublicFallback: true,
      usedFallback: true,
      minMarginPercent: 45,
    },
  });
});
```

- [ ] **Step 2: Run resolver tests and confirm failure**

Run:

```bash
npx vitest run src/server/providers/model-route-resolver.test.ts --reporter=verbose
```

Expected before implementation: the new fallback success test fails with `Model route provider is not active.`

- [ ] **Step 3: Extend route snapshot for selected provider**

In `src/server/providers/model-route-resolver.ts`, change `routeSnapshot` signature to accept selected provider/model and fallback state:

```ts
function routeSnapshot({
  route,
  primaryProvider,
  selectedProvider,
  selectedModel,
  source,
  usedFallback,
}: {
  route: ModelRouteRecord;
  primaryProvider: ModelProviderRecord;
  selectedProvider: ModelProviderRecord;
  selectedModel: string;
  source: "database";
  usedFallback: boolean;
}): JsonValue {
  return {
    routeId: route.id,
    purpose: route.purpose,
    environment: route.environment,
    primaryProvider: primaryProvider.name,
    primaryModel: route.primaryModel,
    selectedProvider: selectedProvider.name,
    selectedModel,
    fallbackPolicy: {
      allowPublicFallback: route.allowPublicFallback === "true",
      fallbackProviderId: route.fallbackProviderId,
      fallbackModel: route.fallbackModel,
      minMarginPercent: route.minMarginPercent,
      usedFallback,
    },
    routeSource: source,
  };
}
```

- [ ] **Step 4: Add helper to resolve fallback**

Add this helper before `resolveModelRoute`:

```ts
async function resolveFallbackCandidate({
  store,
  route,
  environment,
  isPublicJob,
}: {
  store: ModelRouteStore;
  route: ModelRouteRecord;
  environment: string;
  isPublicJob: boolean;
}) {
  if (
    !isPublicJob ||
    route.allowPublicFallback !== "true" ||
    !route.fallbackProviderId ||
    !route.fallbackModel
  ) {
    return null;
  }

  if (route.minMarginPercent < 45) {
    throw new Error("Public fallback requires at least 45 percent margin.");
  }

  const fallbackProvider = await store.findProvider(route.fallbackProviderId);
  if (!fallbackProvider || fallbackProvider.status !== "active") {
    throw new Error("Model route fallback provider is not active.");
  }

  const fallbackKey = await selectKey({
    store,
    providerId: route.fallbackProviderId,
    environment,
  });
  if (!fallbackKey) {
    throw new Error("No active provider key for fallback video_generation route.");
  }

  return {
    provider: fallbackProvider,
    model: route.fallbackModel,
    key: fallbackKey,
  };
}
```

- [ ] **Step 5: Use fallback when primary provider or primary key is unavailable**

In `resolveModelRoute`, replace primary provider/key handling with this structure:

```ts
const primaryProvider = await store.findProvider(primaryProviderId);
if (!primaryProvider) {
  throw new Error("Model route provider was not found.");
}

let selectedProvider = primaryProvider;
let selectedModel = route.primaryModel;
let selectedKey: ProviderKeyRecord | null = null;
let usedFallback = false;

if (primaryProvider.status === "active") {
  selectedKey = await selectKey({
    store,
    providerId: primaryProviderId,
    environment,
  });
}

if (primaryProvider.status !== "active" || !selectedKey) {
  const fallback = await resolveFallbackCandidate({
    store,
    route,
    environment,
    isPublicJob,
  });

  if (!fallback) {
    if (primaryProvider.status !== "active") {
      throw new Error("Model route provider is not active.");
    }
    throw new Error(`No active provider key for ${purpose} route.`);
  }

  selectedProvider = fallback.provider;
  selectedModel = fallback.model;
  selectedKey = fallback.key;
  usedFallback = true;
}

const videoProvider = providerName(selectedProvider.name);

return {
  routeId: route.id,
  provider: videoProvider,
  model: selectedModel,
  providerKeyId: selectedKey.id,
  routeSnapshot: routeSnapshot({
    route,
    primaryProvider,
    selectedProvider,
    selectedModel,
    source: "database",
    usedFallback,
  }),
  source: "database",
};
```

- [ ] **Step 6: Update existing tests if snapshot shape changes**

Existing tests that assert:

```ts
expect(result.routeSnapshot).toMatchObject({
  primaryProvider: "apimart",
  primaryModel: "pixverse-v6",
  routeSource: "database",
});
```

should continue to pass. If a strict equality test exists, update expected snapshot to include:

```ts
selectedProvider: "apimart",
selectedModel: "pixverse-v6",
fallbackPolicy: {
  allowPublicFallback: false,
  usedFallback: false,
}
```

- [ ] **Step 7: Run route and segment tests**

Run:

```bash
npx vitest run src/server/providers/model-route-resolver.test.ts src/server/video/segments.test.ts src/lib/providers/log-call.test.ts
```

Expected: all tests pass, including route paused fail-closed behavior and provider call log route snapshot behavior.

---

### Task 4: Prove Paid Delivery Route Snapshot Evidence

**Files:**
- Modify only if needed: `docs/API_TEST_STATUS.md`
- Modify only if needed: `docs/IMPLEMENTATION_PLAN.md`

This task is partly operational. Do not weaken `scripts/verify-blockers.mjs`.

- [ ] **Step 1: Confirm database has route snapshot columns**

Run:

```bash
rg -n "model_route_id|route_snapshot" drizzle src/lib/db/schema/providers.ts scripts/verify-blockers.mjs
```

Expected: see `drizzle/0008_provider_call_route_snapshot.sql`, schema fields, and blocker checks.

- [ ] **Step 2: Apply migrations if the local/target DB is stale**

Run:

```bash
npm run db:migrate
```

Expected: migration completes without errors. If migration is already applied, Drizzle should report no pending migrations.

- [ ] **Step 3: Ensure active route/provider/key exist for environment**

Use the admin UI or DB console to ensure:

```text
model_routes.purpose = video_generation
model_routes.environment = current APP_ENV or NODE_ENV used by segment submit
model_routes.status = active
model_providers.name = apimart
model_providers.status = active
provider_keys.environment = same environment
provider_keys.status = active
provider_keys.current_concurrency < concurrent_limit
provider_keys.current_daily_cost < daily_cost_limit, unless daily_cost_limit is null/0
provider_keys.failure_count < 5
```

If these are missing, create/update them through the existing admin/provider management path so audit logs are preserved.

- [ ] **Step 4: Generate a fresh paid job after route resolver code is deployed locally**

Create a paid job with `credit_cost > 0`. Recommended:

```text
durationSeconds = 8
useFreeTrialIfAvailable = false
billingMode should become paid
expected creditCost = 70
```

Run the normal backend flow until the job is `deliverable`. Do not use mock success.

- [ ] **Step 5: Smoke the new job**

Run:

```bash
npm run smoke:backend -- --job-id <new-paid-job-id>
```

Expected: smoke succeeds and confirms final video, QA frames, reserve/capture for paid job, and provider/model evidence.

- [ ] **Step 6: Run blocker verification**

Run:

```bash
npm run verify:blockers -- --json
```

Expected:

```json
{
  "passed": true
}
```

The paid delivery evidence must show `videoRouteLogCount > 0`.

- [ ] **Step 7: If verification still fails, inspect the provider log**

Run this query against the same database used by the app:

```sql
select
  id,
  provider,
  model,
  model_route_id,
  route_snapshot,
  status,
  video_job_id,
  segment_id,
  created_at
from provider_call_logs
where video_job_id = '<new-paid-job-id>'
  and purpose = 'video_generation'
order by created_at desc;
```

Expected:

```text
model_route_id is not null
route_snapshot is not null
route_snapshot.routeSource = database
route_snapshot.purpose = video_generation
```

If missing, the segment submit path did not use the deployed resolver code or the job was generated before this implementation.

- [ ] **Step 8: Update docs with exact evidence**

In `docs/API_TEST_STATUS.md`, add:

```md
## 2026-06-13 SPEC Acceptance Follow-up

- `npm run verify:blockers -- --json` passed after generating fresh paid job `<job-id>`.
- Paid delivery route evidence: `provider_call_logs.model_route_id` and `provider_call_logs.route_snapshot` present for `video_generation`.
- `npm run test`, `npm run typecheck`, `npm run build`, and `workers/stitch-worker npm run build` passed after acceptance fixes.
```

In `docs/IMPLEMENTATION_PLAN.md`, update the “仍未完成或仍需生产验收” section:

```md
- `model_routes` 已有 fresh paid delivery route snapshot 证据；仍需生产环境新任务重复验证一次，避免本地 DB 状态与线上配置漂移。
- Cloud Run 封面生成已覆盖抽帧失败和上传失败降级；仍需部署后用新任务确认 R2 中实际出现 `jobs/{jobId}/covers/cover.webp`。
```

---

### Task 5: Final Verification

**Files:**
- No code changes unless a verification failure identifies a concrete bug.

- [ ] **Step 1: Check worktree**

Run:

```bash
git status --short
```

Expected: only intentional files from this plan plus any user-approved APIMart resolution fix.

- [ ] **Step 2: Run full main-app verification**

Run:

```bash
npm run typecheck
npm run test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 3: Run worker verification**

Run:

```bash
cd workers/stitch-worker
npm run build
cd ../..
```

Expected: worker TypeScript build exits 0.

- [ ] **Step 4: Run blocker verification**

Run:

```bash
npm run verify:blockers -- --json
```

Expected: `passed: true`. Do not edit `verify:blockers` to make this pass.

- [ ] **Step 5: Summarize residual risks**

Final handoff must include:

```text
Verified:
- typecheck
- test
- build
- worker build
- verify:blockers

Residual:
- Production Cloud Run deployed task still needs R2 cover object confirmation if not already run against deployed worker.
- OAuth account signal is service/store supported, but /api/jobs still needs stable better-auth account lookup if not already added.
```

---

## Self-Review Checklist

- Free trial denied path still returns the unified public message.
- Paid job creation still bypasses trial abuse checks.
- Cover extraction failure and cover upload failure both preserve final delivery.
- Final video upload failure still fails the stitch job.
- QA frame extraction/upload failure still fails when QA is required.
- Public `video_generation` cannot resolve `experimental_video`.
- Route paused still fail closes.
- Provider/key inactive still fail closes unless explicit fallback is enabled and valid.
- `provider_call_logs` retains route evidence; `verify:blockers` is not weakened.
