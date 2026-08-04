# 24 And 32 Second Video Durations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development while implementing each task. Keep review consolidated per the repository AGENTS.md.

**Goal:** Make every Style Preset support 24-second generation and add a production 32-second paid specification composed of four ordered 8-second segments.

**Architecture:** Extend the existing `VideoDuration` specification as the single source of truth with a 32-second, four-segment, 250-credit entry. Reuse the normal paid generation, stitching, and standard/strict QA paths; keep only 40 seconds behind the existing Beta flag and special five-segment composition/QA rules. Update user-visible selectors and product documentation so they match the executable contract.

**Tech Stack:** TypeScript, Next.js, React, Vitest, Cloud Run stitch worker, Markdown product documentation.

---

### Task 1: Core duration and Preset contract

**Files:**
- Modify: `src/lib/video/specs.test.ts`
- Modify: `src/lib/video/specs.ts`
- Modify: `src/lib/presets/catalog.test.ts`
- Modify: `src/lib/presets/catalog.ts`
- Modify: `src/lib/presets/recommend.test.ts`
- Modify: `src/lib/video/template-slots.test.ts`

- [ ] Add failing tests proving 32 seconds is supported, uses four segments, costs 250 credits, is paid and active, and is not gated by `VIDEO_DURATION_40_ENABLED`.
- [ ] Add failing tests proving all three Presets allow both 24 and 32 seconds and that 32-second recommendation selects four ordered templates without inheriting 40-second-only composition constraints.
- [ ] Run the focused core tests and confirm they fail because 32 seconds and social 24 seconds are absent.
- [ ] Extend the duration specification and Preset catalogs with the minimum production changes.
- [ ] Re-run the focused core tests and confirm they pass.

### Task 2: Job creation, storyboard, and workspace behavior

**Files:**
- Modify: `src/server/jobs/create-job.test.ts`
- Modify: `src/server/jobs/create-job.ts` only if an implementation branch requires duration-specific behavior
- Modify: `src/server/storyboard/schema.test.ts`
- Modify: `src/server/storyboard/generate.test.ts`
- Modify: `src/server/storyboard/confirm.test.ts`
- Modify: `src/components/workspace/spec-selector.test.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/jobs/job-continue-panel.test.tsx`
- Modify: `src/components/jobs/job-continue-panel.tsx`

- [ ] Add failing tests proving a 32-second paid job costs 250 credits, produces exactly four storyboard segments, and exposes an always-available 32-second selector option.
- [ ] Add failing tests proving 40-second-only five-slot UI and validation do not appear for 32-second jobs.
- [ ] Run the focused job, storyboard, and workspace tests and confirm the expected failures.
- [ ] Update duration unions and paid-duration copy while preserving the existing 40-second feature gate.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Stitch QA, public contract, and documentation

**Files:**
- Modify: `workers/stitch-worker/src/qa-frame-plan.test.ts`
- Modify: `workers/stitch-worker/src/qa-frame-plan.ts` only if the focused test exposes incorrect four-segment behavior
- Modify: `src/app/page.tsx`
- Modify: `src/app/faq/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `docs/PRD.md`
- Modify: `docs/STYLE_PRESET_DESIGN.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`

- [ ] Add a focused worker test proving four segments use the normal QA plan and do not receive the five-segment 40-second batch plan.
- [ ] Update public duration and pricing copy to list 8/16/24/32 seconds, with 40 seconds remaining a gated Beta.
- [ ] Update product and architecture documents to define 32 seconds as four independent 8-second segments costing 250 credits.
- [ ] Run the focused worker, page, and pricing tests.
- [ ] Run `pnpm typecheck`, then `pnpm test`, and inspect the final diff for stale duration unions or claims.
