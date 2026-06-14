# Env-only Video Generation Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove database model routing for video generation and make provider/model/API key selection come only from environment variables.

**Architecture:** The video generation router selects `apimart` or `evolink` from `VIDEO_GENERATION_PROVIDER`; provider clients read their own API key/base URL/model from env. Segment submission and polling no longer resolve database routes or decrypt provider keys. `provider_call_logs` remains as an observability table, with route-related fields empty for env-only calls.

**Tech Stack:** Next.js, TypeScript, Drizzle ORM, Vitest, Cloudflare R2, APIMart/EvoLink provider clients.

---

## Task 1: Restore Env-only Provider Clients And Router

**Files:**
- Modify: `src/lib/providers/apimart/video.ts`
- Modify: `src/lib/providers/apimart/video.test.ts`
- Modify: `src/lib/providers/evolink/video.ts`
- Modify: `src/lib/providers/evolink/video.test.ts`
- Modify: `src/lib/providers/video-generation/router.ts`
- Modify: `src/lib/providers/video-generation/router.test.ts`

- [ ] Change `getAPIMartVideoConfig()` so it reads `APIMART_API_KEY` from env by default, accepts optional explicit overrides only for tests, uses `APIMART_BASE_URL`, and uses `VIDEO_GENERATION_MODEL` before the APIMart default `pixverse-v6`.
- [ ] Change `getEvoLinkVideoConfig()` so it reads `EVOLINK_API_KEY` from env by default, accepts optional explicit overrides only for tests, uses `EVOLINK_BASE_URL`, and uses `VIDEO_GENERATION_MODEL` before the EvoLink default `veo3.1-fast-beta`.
- [ ] Keep `VIDEO_GENERATION_PROVIDER` selection in `router.ts`; remove the assumption that caller must inject `apiKey`.
- [ ] Update tests so they prove env keys are used and missing env keys fail with clear provider-specific errors.
- [ ] Run:

```powershell
npx vitest run src/lib/providers/apimart/video.test.ts src/lib/providers/evolink/video.test.ts src/lib/providers/video-generation/router.test.ts
```

Expected: all tests pass.

## Task 2: Remove DB Route Dependency From Segment Runtime

**Files:**
- Modify: `src/server/video/segments.ts`
- Modify: `src/server/video/segments.test.ts`
- Modify: `src/lib/providers/log-call.ts` only if types require small cleanup

- [ ] Remove imports from `src/server/providers/model-route-resolver`.
- [ ] Make `submitQueuedSegment()` call `createVideoGeneration()` or an injected equivalent without resolving `model_routes`.
- [ ] Keep provider call logs, but write `providerKeyId: null`, `modelRouteId: null`, `routeSnapshot: null`.
- [ ] Remove route snapshot from request snapshots; if useful, replace with `{ configSource: "env" }`.
- [ ] Remove `providerRuntimeAuthForSegment()` and polling-time database key lookup.
- [ ] Make `pollSubmittedSegment()` poll by the stored segment provider when present, using env-only provider clients.
- [ ] Ensure provider task regeneration re-submits through env-only submit logic.
- [ ] Update tests to remove `resolveModelRoute` stubs and assert env-only submission behavior.
- [ ] Run:

```powershell
npx vitest run src/server/video/segments.test.ts
```

Expected: all tests pass.

## Task 3: Delete `model_routes` Schema Runtime Surface And Migration

**Files:**
- Modify: `src/lib/db/schema/providers.ts`
- Modify: `src/lib/db/schema/index.test.ts`
- Delete or retire: `src/server/providers/model-route-resolver.ts`
- Delete or retire: `src/server/providers/model-route-resolver.test.ts`
- Modify: `src/server/admin/providers.ts`
- Modify: `src/server/admin/providers.test.ts`
- Modify or delete API route/tests under `src/app/api/admin/provider-keys/**` if they become unsupported
- Add: new Drizzle SQL migration under `drizzle/`

- [ ] Remove `modelRoutes` export from schema.
- [ ] Add a migration that drops `model_routes`.
- [ ] Remove runtime imports of `modelRoutes`.
- [ ] Remove model route admin operations or make them explicitly unavailable.
- [ ] Remove provider key create/rotate runtime path if it only exists for DB video provider keys; otherwise keep non-video provider tables but ensure video generation does not depend on them.
- [ ] Update schema index tests so `modelRoutes` is not expected.
- [ ] Run:

```powershell
npx vitest run src/lib/db/schema/index.test.ts src/server/admin/providers.test.ts src/app/api/admin/provider-keys/route.test.ts src/app/api/admin/provider-keys/[id]/rotate/route.test.ts
```

Expected: tests either pass with removed unsupported behavior or deleted tests are no longer referenced.

## Task 4: Update Health, Env Example, And Product Docs

**Files:**
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `.env.example`
- Modify: `docs/PRD.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/API_TEST_STATUS.md`
- Modify: `docs/verification/model-route-audit-2026-06-12.md`

- [ ] Health check must require `VIDEO_GENERATION_PROVIDER`, `VIDEO_GENERATION_MODEL`, and the selected provider API key.
- [ ] Health check must not require `PROVIDER_KEY_ENCRYPTION_SECRET` for video generation.
- [ ] `.env.example` must show env-only provider configuration.
- [ ] Product docs must state that MVP video generation key/model/provider are env-only.
- [ ] Remove or clearly obsolete previous DB route audit claims.
- [ ] Run:

```powershell
npx vitest run src/server/ops/health.test.ts src/app/api/health/route.test.ts
```

Expected: all tests pass.

## Task 5: Final Integration Verification

**Files:**
- No planned source ownership; this task verifies all previous tasks.

- [ ] Search for forbidden runtime usage:

```powershell
rg -n "resolveModelRoute|modelRoutes|model_routes|PROVIDER_KEY_ENCRYPTION_SECRET" src .env.example docs/PRD.md docs/TECHNICAL_ARCHITECTURE.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md
```

Expected: no runtime source references to `resolveModelRoute` or `modelRoutes`; `model_routes` only appears in migration history or docs explaining removal; `PROVIDER_KEY_ENCRYPTION_SECRET` is not required by video generation docs or health checks.

- [ ] Run targeted tests:

```powershell
npx vitest run src/lib/providers/apimart/video.test.ts src/lib/providers/evolink/video.test.ts src/lib/providers/video-generation/router.test.ts src/server/video/segments.test.ts src/server/ops/health.test.ts src/app/api/health/route.test.ts
```

Expected: all tests pass.

- [ ] Run typecheck:

```powershell
npm run typecheck
```

Expected: typecheck passes.

- [ ] Verify `.env.local` can be the single source of truth for video generation provider/model/key.

