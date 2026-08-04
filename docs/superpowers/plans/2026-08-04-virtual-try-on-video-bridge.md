# Goal 2: Virtual Try-On Video Bridge Implementation Plan

> Goal: let an owner turn the latest locked, Strict-QA-passed appearance pack into one paid video job per create request without bypassing rights, asset analysis, prompt moderation, billing, template permissions, or Post-QA. The same pack may create deliberate duration, ratio, or preset variants under different idempotency keys.

## Scope and acceptance

- API: `POST /api/virtual-try-on/[id]/video` accepts `packId`, `idempotencyKey`, `durationSeconds`, `aspectRatio`, and `presetId`.
- Durations: paid 8/16/24/32 seconds only. The unrelated 40-second beta stays unavailable here.
- Only the latest locked pack with complete required views and a passing Strict QA summary can bridge.
- Source rights must still be active. Generated views become normal `assets` with immutable appearance-pack provenance and inherited active attestations.
- The resulting video job is paid, starts at `asset_analysis_queued`, re-runs normal human-model and `model_views` analysis, and forces Strict Post-QA.
- Existing storyboard and final-prompt Creem moderation remain the fail-closed model gates. Bridge creation does not create a meaningless synthetic moderation result.
- Replaying the same owner idempotency key returns the same video job and does not duplicate assets or jobs; pack-level uniqueness is intentionally not enforced because one locked pack may produce multiple paid video variants.
- Goal 3 marketing sample generation is explicitly out of scope.

## Risk level

Medium-high: this crosses rights revocation, derived-asset provenance, shared video-job creation, idempotency, billing mode, and QA policy. One combined reviewer is required after implementation.

## Task 1: Persistence contracts

Files:

- Modify `drizzle/0020_virtual_tryon.sql`
- Modify `src/lib/db/schema/virtual-tryon.ts`
- Modify `src/lib/db/schema/jobs.ts`
- Modify schema tests

Steps:

1. Add failing schema tests for transfer metadata, materialized asset linkage, bridge idempotency, and video generation-source snapshot.
2. Add `mime_type`, `file_size`, and `materialized_asset_id` to appearance-pack assets.
3. Add `appearance_pack_video_bridges` with owner idempotency and one completed video-job reference.
4. Add `video_jobs.generation_source_snapshot`.
5. Run the focused schema tests.

## Task 2: Preserve valid asset metadata and rights

Files:

- Modify `src/server/virtual-tryon/transfer.ts`
- Modify `src/server/virtual-tryon/runtime.ts`
- Modify `src/server/jobs/create-job.ts`
- Modify focused tests

Steps:

1. Add failing tests that transferred images retain content type and byte size.
2. Persist those values on the appearance-pack view.
3. Add a regression test that redacted rights attestations are not accepted by video-job creation.
4. Keep the existing standard asset-analysis entry state unchanged.

## Task 3: Atomic bridge service

Files:

- Create `src/server/virtual-tryon/video-bridge.ts`
- Create `src/server/virtual-tryon/video-bridge.test.ts`
- Modify `src/server/jobs/create-job.ts`

Steps:

1. Write failing in-memory service tests for owner, latest version, locked status, Strict QA, required views, active rights, paid-only, Strict Post-QA, provenance, and idempotency.
2. Implement one transaction that reserves the idempotency key, locks and revalidates the source asset/attestation rows, materializes missing views, links active source attestations, creates the standard video job, stores generation provenance, and completes the bridge.
3. Allow the internal job creator to force Strict Post-QA and accept a generation-source snapshot; do not expose either override on the public jobs API.
4. Ensure front-only packs only materialize front; three-view packs materialize front/side/back and still rely on template permission checks downstream.

## Task 4: Owner API and UI

UI task model and disclosure contract:

- Primary: create one video job from the locked appearance pack.
- Secondary: choose duration, aspect ratio, and style preset.
- Low-frequency: download individual appearance views.
- Rare: recover from lock or bridge conflicts.
- Flow: `ready -> lock -> locked -> choose specs -> submitting -> video job`; errors return to `locked` with the chosen specs preserved.
- `ready`: show the lock CTA and hide video specs because they cannot be acted on yet.
- `locked`: reveal specs in the existing action band and show one create-video CTA.
- `submitting`: disable lock/spec/download-changing actions and show command progress.
- `error`: show a local actionable message; do not add a permanent help panel.

| Item | Role | First viewport | Show condition | Container |
| --- | --- | --- | --- | --- |
| Appearance views | decision-supporting | yes | deliverable | existing result grid |
| Pack state | status-feedback | yes | always | existing status band |
| Lock command | action-critical | yes | ready | existing action band |
| Video specs | decision-supporting | yes | locked | existing action band |
| Create video | action-critical | yes | locked | existing action band |
| Download | low-frequency | no special promotion | deliverable | per-view icon action |
| Bridge error | exception-handling | conditional | failed request | inline alert |

Files:

- Create `src/app/api/virtual-try-on/[id]/video/route.ts`
- Create `src/app/api/virtual-try-on/[id]/video/route.test.ts`
- Modify `src/server/virtual-tryon/owner.ts`
- Modify `src/components/virtual-try-on/pack-detail.tsx`
- Add/update component tests

Steps:

1. Test authentication, input validation, conflict mapping, replay response, and safe error messages.
2. Mark the owner bridge as enabled only after the pack is locked.
3. Replace the disabled coming-soon action with compact duration/aspect/preset controls and a create-video command.
4. Redirect successful creation to the localized `/jobs/{videoJobId}` page.

## Task 5: Documentation and verification

Files:

- Modify `docs/PRD.md`
- Modify `docs/TECHNICAL_ARCHITECTURE.md`
- Modify `docs/IMPLEMENTATION_PLAN.md`
- Modify `docs/DEVELOPMENT_SPEC.md`
- Modify `docs/STYLE_PRESET_DESIGN.md`
- Modify `docs/VIRTUAL_TRYON_SPEC.md`
- Modify `docs/VIRTUAL_TRYON_UI_GUIDELINES.md`
- Modify `docs/deployment/virtual-try-on.md`

Verification:

```powershell
pnpm exec vitest run src/lib/db/schema/virtual-tryon.test.ts src/server/virtual-tryon/transfer.test.ts src/server/virtual-tryon/runtime.test.ts src/server/jobs/create-job.test.ts src/server/jobs/create-job-drizzle.test.ts src/server/virtual-tryon/video-bridge.test.ts src/app/api/virtual-try-on/[id]/video/route.test.ts src/components/virtual-try-on/pack-detail.test.tsx
pnpm typecheck
pnpm lint
pnpm test -- --reporter=dot
pnpm --dir workers/stitch-worker build
```

Finish with one combined reviewer. Fix Critical and Important findings; record Minor findings without opening an unbounded review loop.
