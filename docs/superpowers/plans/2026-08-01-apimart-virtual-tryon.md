# APIMart Virtual Try-On Implementation Plan

> For agentic workers: execute every checkbox with TDD; each task has a red test, a minimal green change, a focused command and a commit.

**Goal:** Build paid APIMart GPT Image 2 static appearance packs with front_only/three_view modes, recoverable worker ticks, strict QA, locking and safe download.

**Architecture:** Create validates and moderates, then writes a draft Saga job before reserve. Reserve success CASes draft to queued; stale drafts replay the same ledger idempotency key without provider calls. A locked internal tick submits, polls or transfers one view per invocation. R2/model URLs are transient; all required R2 assets and QA must pass before capture and ready.

**Tech Stack:** Next.js 16, TypeScript, Drizzle/Postgres, Vitest, Cloudflare R2, APIMart, Creem moderation and credits.

---

## Baseline

2026-08-01 baseline: pnpm test PASS (217 files, 1077 tests); pnpm run typecheck PASS. The current last migration is 0019_purchase_reversal_ledger.sql, therefore migration is 0020_virtual_tryon.sql.

### Task 1: Schema and migration

Files: Create src/lib/db/schema/virtual-tryon.ts, src/lib/db/schema/virtual-tryon.test.ts, drizzle/0020_virtual_tryon.sql. Modify src/lib/db/schema/index.ts.

- [ ] Step 1: Write the failing test.

~~~ts
import { appearancePackAssets, appearancePacks, virtualTryonJobs } from "@/lib/db/schema";
test("exports virtual try-on pack tables", () => {
  expect(virtualTryonJobs).toBeDefined();
  expect(appearancePacks).toBeDefined();
  expect(appearancePackAssets).toBeDefined();
});
~~~

- [ ] Step 2: Run pnpm vitest run src/lib/db/schema/virtual-tryon.test.ts. Expected: FAIL, the exports do not exist.
- [ ] Step 3: Add mode enums front_only/three_view; job states draft/queued/generating/qa_queued/ready/locked/failed_released/failed_refunded; jobs, packs, per-view assets, fidelity and state-event tables. Add unique job-version, pack-view, pack-scope-view and owner-create-idempotency indexes in both Drizzle and SQL.

~~~ts
export const appearancePacks = pgTable("appearance_packs", {
  ...id, virtualTryonJobId: uuid("virtual_tryon_job_id").notNull(),
  version: integer("version").notNull(), requiredViews: jsonSnapshot("required_views").notNull(),
  status: appearancePackStatusEnum("status").notNull(), lockedAt: timestamp("locked_at", { withTimezone: true }), ...timestamps,
}, (t) => [uniqueIndex("appearance_packs_job_version_unique").on(t.virtualTryonJobId, t.version)]);
~~~

- [ ] Step 4: Run pnpm vitest run src/lib/db/schema/virtual-tryon.test.ts. Expected: PASS.
- [ ] Step 5: Commit: git add src/lib/db/schema/virtual-tryon.ts src/lib/db/schema/virtual-tryon.test.ts src/lib/db/schema/index.ts drizzle/0020_virtual_tryon.sql; git commit -m "feat: add virtual try-on schema".

### Task 2: Pricing, config and pack mode policy

Files: Create src/server/virtual-tryon/config.ts and src/server/virtual-tryon/config.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("requires front back and detail for three_view", () => {
  expect(() => requiredViewsFor({ mode: "three_view", frontAssetId: "f", backAssetId: null, detailAssetId: "d" })).toThrow("three_view_requires_front_back_detail");
});
test("rejects a zero pack price", () => {
  expect(() => getVirtualTryOnConfig({ VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "0" })).toThrow("virtual_tryon_config_unavailable");
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/config.test.ts. Expected: FAIL, module missing.
- [ ] Step 3: Require APIMART_API_KEY, R2 settings, three VIRTUAL_TRYON_MODEL_*_KEY values and positive VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST/VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST. Return front only required views as front; return three view required views as front/side/back only when all three source IDs exist.

~~~ts
if (input.mode === "front_only") return ["front"] as const;
if (!input.frontAssetId || !input.backAssetId || !input.detailAssetId) throw new Error("three_view_requires_front_back_detail");
return ["front", "side", "back"] as const;
~~~

- [ ] Step 4: Run pnpm vitest run src/server/virtual-tryon/config.test.ts. Expected: PASS.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/config.ts src/server/virtual-tryon/config.test.ts; git commit -m "feat: add virtual try-on configuration".

### Task 3: APIMart image provider

Files: Create src/lib/providers/apimart/image.ts and src/lib/providers/apimart/image.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("sends GPT Image 2 with n one and ordered references", async () => {
  const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { task_id: "task-1" } }), { status: 200 }));
  await createAPIMartImageGeneration({ prompt: "front", imageUrls: ["model", "front", "back", "detail"] }, { fetch: fetchSpy, apiKey: "key" });
  expect(JSON.parse(String(fetchSpy.mock.calls[0][1].body))).toEqual({ model: "gpt-image-2", n: 1, prompt: "front", image_urls: ["model", "front", "back", "detail"] });
});
~~~

- [ ] Step 2: Run pnpm vitest run src/lib/providers/apimart/image.test.ts. Expected: FAIL, provider missing.
- [ ] Step 3: Implement POST /v1/images/generations and GET /v1/tasks/id, max 16 image URLs, task/status parser and in-memory-only output URL.

~~~ts
if (input.imageUrls.length < 1 || input.imageUrls.length > 16) throw new Error("APIMart image generation accepts 1 to 16 image URLs.");
const body = { model: "gpt-image-2", n: 1, prompt: input.prompt, image_urls: input.imageUrls };
~~~

- [ ] Step 4: Run pnpm vitest run src/lib/providers/apimart/image.test.ts. Expected: PASS for limits, unavailable config, malformed response and task parsing.
- [ ] Step 5: Commit: git add src/lib/providers/apimart/image.ts src/lib/providers/apimart/image.test.ts; git commit -m "feat: add APIMart image provider".

### Task 4: Strict QA schema and QA client

Files: Create src/server/virtual-tryon/qa-schema.ts, qa-schema.test.ts, qa.ts and qa.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("fails an unknown view QA", () => expect(isStrictViewQaPass({ verdict: "unknown" } as StrictViewQa)).toBe(false));
test("fails incomplete cross-view evidence", () => expect(isStrictCrossViewQaPass({ verdict: "pass", coverage: "incomplete" } as StrictCrossViewQa)).toBe(false));
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/qa-schema.test.ts src/server/virtual-tryon/qa.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Define exact SPEC JSON for single view silhouette/color/pattern/visible details/anatomy/identity/invented details and cross-view coverage/garment/person. Reject schema/provider/unknown/fail.

~~~ts
export const isStrictViewQaPass = (qa: StrictViewQa) => qa.verdict === "pass" && qa.garment.silhouette === "match" && qa.garment.color === "match" && qa.garment.pattern === "match" && qa.garment.visibleDetails === "match" && qa.person.anatomy === "natural" && qa.person.identityConsistency === "match" && qa.inventedDetails === false;
~~~

- [ ] Step 4: Run pnpm vitest run src/server/virtual-tryon/qa-schema.test.ts src/server/virtual-tryon/qa.test.ts. Expected: PASS.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/qa-schema.ts src/server/virtual-tryon/qa-schema.test.ts src/server/virtual-tryon/qa.ts src/server/virtual-tryon/qa.test.ts; git commit -m "feat: add strict virtual try-on QA".

### Task 5: Create preflight, rights, moderation and reserve

Files: Create src/server/virtual-tryon/store.ts, store.test.ts, create.ts and create.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("moderates before reserve and creates only a queued job", async () => {
  const result = await createVirtualTryOn(input, deps);
  expect(deps.moderate.mock.invocationCallOrder[0]).toBeLessThan(deps.reserve.mock.invocationCallOrder[0]);
  expect(result.job.status).toBe("queued");
  expect(deps.provider.create).not.toHaveBeenCalled();
});
test("rejects a source asset without current image rights", async () => {
  await expect(createVirtualTryOn(input, missingRightsDeps)).rejects.toThrow("virtual_tryon_asset_rights_required");
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/store.test.ts src/server/virtual-tryon/create.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Query owner, uploaded/ready, non-deleted sources with current image_rights_v1 using current rights-attestation tables; snapshot source key/attestation/version. Call checkPrompt source virtual_tryon_generation before create+reserve, keyed virtual-tryon:job:reserve.

~~~ts
if (!moderation.allowed) throw new Error("virtual_tryon_moderation_blocked");
await reserveCredits({ store: creditStore, userId, amount: creditCost, reason: "virtual_tryon_reserve", relatedJobId: job.id, idempotencyKey: "virtual-tryon:" + job.id + ":reserve" });
~~~

- [ ] Step 4: Run pnpm vitest run src/server/virtual-tryon/store.test.ts src/server/virtual-tryon/create.test.ts. Expected: PASS.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/store.ts src/server/virtual-tryon/store.test.ts src/server/virtual-tryon/create.ts src/server/virtual-tryon/create.test.ts; git commit -m "feat: create reserved virtual try-on jobs".

### Task 6: Tick state machine and locks

Files: Create src/server/virtual-tryon/locks.ts, locks.test.ts, worker.ts and worker.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("submits front once then polls in a later tick", async () => {
  await runVirtualTryOnWorkerTick(deps);
  await runVirtualTryOnWorkerTick(deps);
  expect(deps.provider.create).toHaveBeenCalledTimes(1);
  expect(deps.provider.poll).toHaveBeenCalledWith("front-task");
});
test("submits side only after front transfer", async () => {
  await runVirtualTryOnWorkerTick(frontStoredDeps);
  expect(frontStoredDeps.provider.create.mock.calls[0][0].view).toBe("side");
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/locks.test.ts src/server/virtual-tryon/worker.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Use 60-second CAS lock and process one state or one view only; record task/status/attempt/next retry/R2 key. 429, 5xx and timeout retry at 30s/120s; terminal errors release before ready; never resubmit a persisted task.

~~~ts
const view = nextRequiredView(pack);
if (!view.providerTaskId) return submitView({ job, pack, view });
if (view.providerStatus !== "succeeded") return pollView({ job, pack, view });
return transferView({ job, pack, view });
~~~

- [ ] Step 4: Run pnpm vitest run src/server/virtual-tryon/locks.test.ts src/server/virtual-tryon/worker.test.ts. Expected: PASS for order, duplicate tick, retry and front_only.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/locks.ts src/server/virtual-tryon/locks.test.ts src/server/virtual-tryon/worker.ts src/server/virtual-tryon/worker.test.ts; git commit -m "feat: add virtual try-on worker state machine".

### Task 7: Private R2 presign, transfer and provider audit

Files: Create src/server/virtual-tryon/transfer.ts, transfer.test.ts, provider-log.ts and provider-log.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("stores deterministic R2 key without persisted signed URL", async () => {
  const result = await transferGeneratedView(input, deps);
  expect(result.r2Key).toBe("virtual-tryon/job/packs/pack/front.png");
  expect(JSON.stringify(deps.log.listCallLogs())).not.toContain("X-Amz-Signature");
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/transfer.test.ts src/server/virtual-tryon/provider-log.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Presign model/source R2 keys for 300 seconds in memory, then transfer output immediately to the fixed key. Persist log only view/imageCount/task/status/cost.

~~~ts
const modelUrl = await createDownloadSignedUrl({ key: modelKey, expiresIn: 300 });
const r2Key = "virtual-tryon/" + jobId + "/packs/" + packId + "/" + view + ".png";
await transferRemoteObjectToR2({ sourceUrl: outputUrl, destinationKey: r2Key });
~~~

- [ ] Step 4: Run pnpm vitest run src/server/virtual-tryon/transfer.test.ts src/server/virtual-tryon/provider-log.test.ts. Expected: PASS.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/transfer.ts src/server/virtual-tryon/transfer.test.ts src/server/virtual-tryon/provider-log.ts src/server/virtual-tryon/provider-log.test.ts; git commit -m "feat: securely transfer virtual try-on images".

### Task 8: Ready capture, owner read, lock and download

Files: Create src/server/virtual-tryon/service.ts, service.test.ts, src/app/api/virtual-try-on/route.ts, route.test.ts, src/app/api/virtual-try-on/[id]/route.ts, route.test.ts, src/app/api/virtual-try-on/[id]/lock/route.ts, route.test.ts, src/app/api/virtual-try-on/[id]/assets/[assetId]/download/route.ts and route.test.ts.

- [ ] Step 1: Write the failing test.

~~~ts
test("captures only after required R2 assets and QA pass", async () => {
  await finalizeReadyPack({ packId: "pack" }, deps);
  expect(deps.capture).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "virtual-tryon:job:capture" }));
});
test("returns 404 for another owner download", async () => {
  expect((await handleVirtualTryOnDownload(request, params, otherOwnerDeps)).status).toBe(404);
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/virtual-tryon/service.test.ts src/app/api/virtual-try-on/route.test.ts src/app/api/virtual-try-on/[id]/route.test.ts src/app/api/virtual-try-on/[id]/lock/route.test.ts src/app/api/virtual-try-on/[id]/assets/[assetId]/download/route.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Verify required assets and QA, capture with virtual-tryon:job:capture, CAS ready and owner lock; release all terminal pre-ready failures with release key and refund post-capture delivery failures with refund key. Return 404 for non-owner and redirect only an owned ready/locked R2 asset.

~~~ts
if (!allRequiredAssetsStored(pack) || !allStrictQaPassed(pack)) throw new Error("strict_qa_not_passed");
await captureReservedCredits({ store, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_capture", relatedJobId: job.id, idempotencyKey: "virtual-tryon:" + job.id + ":capture" });
~~~

- [ ] Step 4: Run the Step 2 command. Expected: PASS, including immutable lock and owner-only signed download.
- [ ] Step 5: Commit: git add src/server/virtual-tryon/service.ts src/server/virtual-tryon/service.test.ts src/app/api/virtual-try-on; git commit -m "feat: deliver virtual try-on appearance packs".

### Task 9: Internal tick route, UI and navigation

Files: Create src/app/api/internal/virtual-try-on/tick/route.ts, route.test.ts, src/app/(dashboard)/virtual-try-on/page.tsx, page.test.tsx, src/app/(dashboard)/virtual-try-on/[id]/page.tsx, page.test.tsx, src/components/virtual-try-on/create-form.tsx, create-form.test.tsx, src/components/virtual-try-on/pack-detail.tsx and pack-detail.test.tsx. Modify src/app/(dashboard)/workspace/page.tsx.

- [ ] Step 1: Write the failing test.

~~~ts
test("rejects a tick without configured cron secret", async () => {
  expect((await handleVirtualTryOnTick(new Request("http://local"), { env: {} })).status).toBe(503);
});
test("shows unavailable instead of fake success", () => {
  render(<VirtualTryOnCreateForm available={false} />);
  expect(screen.getByText("试穿服务暂不可用，请稍后再试")).toBeInTheDocument();
});
~~~

- [ ] Step 2: Run pnpm vitest run src/app/api/internal/virtual-try-on/tick/route.test.ts src/app/(dashboard)/virtual-try-on/page.test.tsx src/app/(dashboard)/virtual-try-on/[id]/page.test.tsx src/components/virtual-try-on/create-form.test.tsx src/components/virtual-try-on/pack-detail.test.tsx. Expected: FAIL, files missing.
- [ ] Step 3: Copy cron secret validation; expose front_only and three_view exact requirements, queue/QA/error states, download/lock controls and “继续生成视频（即将推出）”. Add workspace navigation href /virtual-try-on.

~~~tsx
return <VirtualTryOnPackDetail pack={pack} videoGeneration="not_enabled" />;
~~~

- [ ] Step 4: Run the Step 2 command. Expected: PASS.
- [ ] Step 5: Commit: git add src/app/api/internal/virtual-try-on src/app/(dashboard)/virtual-try-on src/components/virtual-try-on src/app/(dashboard)/workspace/page.tsx; git commit -m "feat: add virtual try-on dashboard".

### Task 10: Admin list/detail and audit

Files: Create src/server/admin/virtual-tryon.ts, virtual-tryon.test.ts, src/app/api/admin/virtual-try-on/route.ts, route.test.ts, src/app/api/admin/virtual-try-on/[id]/route.ts, route.test.ts, src/app/admin/virtual-try-on/page.tsx, page.test.tsx, src/app/admin/virtual-try-on/[id]/page.tsx and page.test.tsx.

- [ ] Step 1: Write the failing test.

~~~ts
test("admin detail excludes signed and raw output URLs", async () => {
  const detail = await getAdminVirtualTryOnDetail({ jobId: "job" }, store);
  expect(JSON.stringify(detail)).not.toContain("X-Amz-Signature");
  expect(detail.views[0]).toMatchObject({ providerTaskId: "task", providerStatus: "succeeded", attemptCount: 1, r2KeySuffix: "front.png" });
});
~~~

- [ ] Step 2: Run pnpm vitest run src/server/admin/virtual-tryon.test.ts src/app/api/admin/virtual-try-on/route.test.ts src/app/api/admin/virtual-try-on/[id]/route.test.ts. Expected: FAIL, files missing.
- [ ] Step 3: Gate routes with getAdminSession and return only owner/mode/status/pack version/required views/task status/attempt/key suffix/QA/provider/model/ledger/failure/events/provenance.

~~~ts
if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
return { id: job.id, ownerId: job.userId, mode: job.mode, status: job.status, packVersion: pack.version, views, qa, ledgerStatus, events };
~~~

- [ ] Step 4: Run the Step 2 command. Expected: PASS.
- [ ] Step 5: Commit: git add src/server/admin/virtual-tryon.ts src/server/admin/virtual-tryon.test.ts src/app/api/admin/virtual-try-on src/app/admin/virtual-try-on; git commit -m "feat: add virtual try-on admin observability".

### Task 11: Smoke, product docs and final verification

Files: Create scripts/virtual-tryon-smoke.mjs and scripts/virtual-tryon-smoke.test.ts. Modify docs/VIRTUAL_TRYON_SPEC.md, docs/PRD.md, docs/TECHNICAL_ARCHITECTURE.md, docs/IMPLEMENTATION_PLAN.md, docs/DEVELOPMENT_SPEC.md and docs/STYLE_PRESET_DESIGN.md.

- [ ] Step 1: Write the failing test.

~~~ts
test("prints a clear skip when staging credentials are absent", () => {
  expect(runSmoke({}).stdout).toContain("SKIP: virtual try-on staging smoke requires");
});
~~~

- [ ] Step 2: Run pnpm vitest run scripts/virtual-tryon-smoke.test.ts. Expected: FAIL, script missing.
- [ ] Step 3: Check APIMART_API_KEY, three model keys, R2 and DATABASE_URL; skip explicitly when missing. With staging variables create an isTest front_only job, call tick until terminal, verify ready/R2/Strict pass and soft-delete it. Update docs to mark the module static-only and the video bridge unavailable.

~~~js
if (missing.length) {
  console.log("SKIP: virtual try-on staging smoke requires " + missing.join(", "));
  process.exit(0);
}
~~~

- [ ] Step 4: Run pnpm vitest run scripts/virtual-tryon-smoke.test.ts src/lib/providers/apimart/image.test.ts src/server/virtual-tryon/worker.test.ts src/server/virtual-tryon/service.test.ts && node scripts/virtual-tryon-smoke.mjs. Expected: tests PASS; without staging credentials output explicit SKIP.
- [ ] Step 5: Run pnpm run lint && pnpm run typecheck && pnpm test && pnpm run build && git diff --check. Expected: all exit 0.
- [ ] Step 6: Commit: git add docs scripts; git commit -m "docs: specify virtual try-on appearance packs".
