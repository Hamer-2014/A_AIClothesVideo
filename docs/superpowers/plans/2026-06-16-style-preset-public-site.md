# Style Preset and Public Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Style Preset as the default user-facing generation entry, connect it to workspace defaults, template recommendation, storyboard generation, persistence, admin visibility, and public Landing/Pricing/Privacy/Terms pages.

**Architecture:** Add a code-configured `src/lib/presets` layer above the existing template engine. Preserve the current template permission rules as the hard gate, then use preset preferences only for ranking and defaults. Public pages send users into `/workspace?mode=trial&preset=minimal_studio`, while backend job/storyboard records persist preset id and snapshot for auditability.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, Drizzle, Vitest, Testing Library.

---

## Scope And Non-Negotiables

This plan implements the confirmed design in [docs/STYLE_PRESET_DESIGN.md](../../STYLE_PRESET_DESIGN.md).

Do not implement preset as a plain prompt string. Preset must remain a structured config with default intent, prompt style hint, template preferences, trial policy, and defaults.

Do not let preset decide template availability. Existing rules in `src/lib/templates/rules.ts` and `src/lib/templates/recommend.ts` remain the hard gate.

Do not build a preset admin editor in this iteration. Use code configuration first so historical behavior is stable and reviewable.

Do not run full smoke/blocker until new generation flow is implemented. During implementation, run targeted tests, `npm run typecheck`, and `npm run build`. Before real users test the new flow, create a real paid style-preset job, set `STYLE_PRESET_PAID_JOB_ID` to that job id in the shell, then run `npm run smoke:backend -- --job-id $env:STYLE_PRESET_PAID_JOB_ID` and `npm run verify:blockers -- --json`.

## File Map

Create:

- `src/lib/presets/types.ts`  
  Owns preset IDs, preset shape, default mode query parsing types, and snapshot shape.
- `src/lib/presets/catalog.ts`  
  Owns the MVP preset catalog: `minimal_studio`, `marketplace_clean`, `social_lifestyle`.
- `src/lib/presets/recommend.ts`  
  Owns preset lookup, preset snapshot creation, template ranking, and auto-selection helpers.
- `src/lib/presets/index.ts`  
  Barrel export for preset modules.
- `src/lib/presets/catalog.test.ts`  
  Tests catalog integrity.
- `src/lib/presets/recommend.test.ts`  
  Tests ranking, fallback, trial behavior, and non-override behavior.
- `src/components/workspace/style-preset-selector.tsx`  
  User-facing preset selector.
- `src/components/workspace/style-preset-selector.test.tsx`  
  Tests selector state and text.
- `src/components/public/public-header.tsx`  
  Shared public nav/header for Landing/Pricing/Privacy/Terms.
- `src/components/public/public-footer.tsx`  
  Shared public footer.
- `src/components/public/cta-link.tsx`  
  Builds login/workspace CTA hrefs consistently.
- `src/app/pricing/page.tsx`  
  Pricing page.
- `src/app/privacy/page.tsx`  
  Privacy page.
- `src/app/terms/page.tsx`  
  Terms page.
- `drizzle/0011_style_preset_snapshots.sql`  
  Adds `preset_id` and `preset_snapshot` columns.

Modify:

- `src/app/page.tsx`  
  Replace redirect-only homepage with real Landing page.
- `src/app/app-shell.ts`  
  Keep dashboard nav; update `pickWorkspaceRedirect` only if needed by login `next` handling.
- `src/app/(dashboard)/workspace/page.tsx`  
  Read `searchParams` and pass `initialMode` / `initialPresetId` into `WorkspaceApp`.
- `src/components/workspace/workspace-app.tsx`  
  Add preset state, default intent, preset selector, query defaults, preset-based template auto-selection, and request payloads.
- `src/components/workspace/workspace-app.test.tsx`  
  Add tests for trial query defaults, preset selector, request payloads, and template auto-selection.
- `src/server/assets/analyze.ts`  
  Allow `buildRecommendationsFromAnalyses` to accept optional `presetId` and return preset-ranked recommendations.
- `src/server/jobs/get-job.ts`  
  Include job preset fields and return preset-aware recommendations.
- `src/server/jobs/create-job.ts`  
  Accept and persist `presetId` plus initial preset snapshot.
- `src/app/api/jobs/route.ts` and `src/app/api/jobs/route.test.ts`  
  Parse and forward `presetId`.
- `src/server/storyboard/generate.ts`  
  Include preset snapshot/style hint in DeepSeek prompt and persisted storyboard.
- `src/app/api/jobs/[id]/storyboard/route.ts` and tests  
  Return preset-aware behavior and avoid trusting arbitrary client preset payloads.
- `src/lib/db/schema/jobs.ts`  
  Add Drizzle columns.
- `src/lib/db/migrations.test.ts` and `drizzle/meta/_journal.json`  
  Register migration.
- `src/server/admin/jobs.ts`, `src/components/admin/job-detail-panel.tsx`, and tests  
  Show preset id and snapshot in admin detail.

## Task 1: Add Preset Catalog And Recommendation Helpers

**Files:**

- Create: `src/lib/presets/types.ts`
- Create: `src/lib/presets/catalog.ts`
- Create: `src/lib/presets/recommend.ts`
- Create: `src/lib/presets/index.ts`
- Create: `src/lib/presets/catalog.test.ts`
- Create: `src/lib/presets/recommend.test.ts`

- [ ] **Step 1: Write catalog integrity tests**

Create `src/lib/presets/catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { defaultStylePresetId, stylePresets } from "./catalog";

describe("style preset catalog", () => {
  it("contains the three MVP presets and a valid default", () => {
    expect(stylePresets.map((preset) => preset.id)).toEqual([
      "minimal_studio",
      "marketplace_clean",
      "social_lifestyle",
    ]);
    expect(stylePresets.some((preset) => preset.id === defaultStylePresetId)).toBe(true);
  });

  it("keeps preset template preferences non-empty and trial-safe defaults explicit", () => {
    for (const preset of stylePresets) {
      expect(preset.label).toBeTruthy();
      expect(preset.defaultIntent).toBeTruthy();
      expect(preset.promptStyleHint).toBeTruthy();
      expect(preset.preferredTemplateIds.length).toBeGreaterThan(0);
      expect(preset.allowedDurationSeconds).toContain(preset.defaultDurationSeconds);
      expect(["9:16", "1:1", "16:9"]).toContain(preset.defaultAspectRatio);
    }

    expect(stylePresets.find((preset) => preset.id === "minimal_studio")).toMatchObject({
      trialAllowed: true,
      defaultDurationSeconds: 8,
      defaultAspectRatio: "9:16",
    });
  });
});
```

- [ ] **Step 2: Write recommendation tests**

Create `src/lib/presets/recommend.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "@/lib/templates/catalog";
import { recommendShotTemplates } from "@/lib/templates/recommend";

import {
  createPresetSnapshot,
  getStylePreset,
  rankTemplatesForPreset,
  selectTemplateIdsForPreset,
} from "./recommend";

const frontOnlyCompleteness = {
  hasFront: true,
  hasBack: false,
  hasSide: false,
  hasDetail: false,
  hasScene: false,
  hasModelFront: false,
  hasFlatLayOrWhiteBackground: true,
  detailTypes: [],
};

describe("style preset recommendation helpers", () => {
  it("falls back to the default preset for unknown ids", () => {
    expect(getStylePreset("not-real").id).toBe("minimal_studio");
    expect(getStylePreset(null).id).toBe("minimal_studio");
  });

  it("creates an audit-safe preset snapshot", () => {
    expect(createPresetSnapshot(getStylePreset("minimal_studio"))).toEqual({
      id: "minimal_studio",
      label: "极简棚拍",
      preferredTemplateIds: ["minimal_studio", "front_push_in", "front_pan", "front_crop_detail"],
      promptStyleHint: expect.stringContaining("clean studio"),
    });
  });

  it("ranks available templates by preset preference without enabling unavailable templates", () => {
    const base = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: frontOnlyCompleteness,
      isTrial: false,
    });
    const ranked = rankTemplatesForPreset({
      recommendations: base,
      preset: getStylePreset("marketplace_clean"),
    });

    expect(ranked.availableTemplateIds[0]).toBe("product_float");
    expect(ranked.availableTemplateIds).not.toContain("back_display");
    expect(ranked.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ templateId: "back_display" }),
      ]),
    );
  });

  it("selects the required number of templates after preset ranking", () => {
    const base = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...frontOnlyCompleteness,
        hasDetail: true,
        detailTypes: ["fabric"],
      },
      isTrial: false,
    });

    expect(
      selectTemplateIdsForPreset({
        recommendations: base,
        preset: getStylePreset("marketplace_clean"),
        durationSeconds: 16,
      }),
    ).toEqual(["product_float", "front_crop_detail"]);
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
npx vitest run src/lib/presets/catalog.test.ts src/lib/presets/recommend.test.ts
```

Expected: fail because `src/lib/presets/*` files do not exist.

- [ ] **Step 4: Implement preset types**

Create `src/lib/presets/types.ts`:

```ts
export type StylePresetId =
  | "minimal_studio"
  | "marketplace_clean"
  | "social_lifestyle";

export type WorkspaceEntryMode = "trial" | "paid";

export interface StylePreset {
  id: StylePresetId;
  label: string;
  shortDescription: string;
  defaultIntent: string;
  promptStyleHint: string;
  preferredTemplateIds: string[];
  discouragedTemplateIds?: string[];
  trialAllowed: boolean;
  allowedDurationSeconds: Array<8 | 16 | 24>;
  defaultDurationSeconds: 8 | 16 | 24;
  defaultAspectRatio: "9:16" | "1:1" | "16:9";
  riskLevel: "low" | "medium";
}

export interface StylePresetSnapshot {
  id: StylePresetId;
  label: string;
  preferredTemplateIds: string[];
  promptStyleHint: string;
}
```

- [ ] **Step 5: Implement catalog**

Create `src/lib/presets/catalog.ts`:

```ts
import type { StylePreset, StylePresetId } from "./types";

export const defaultStylePresetId: StylePresetId = "minimal_studio";

export const stylePresets: StylePreset[] = [
  {
    id: "minimal_studio",
    label: "极简棚拍",
    shortDescription: "干净背景，突出服装版型，适合商品页展示。",
    defaultIntent: "突出服装版型和整体轮廓，使用干净背景和稳定镜头，避免夸张动作。",
    promptStyleHint:
      "clean studio product video, neutral background, stable garment shape, restrained camera movement",
    preferredTemplateIds: [
      "minimal_studio",
      "front_push_in",
      "front_pan",
      "front_crop_detail",
    ],
    discouragedTemplateIds: ["front_to_back_cut", "model_front_pose"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16, 24],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "low",
  },
  {
    id: "marketplace_clean",
    label: "电商主图动效",
    shortDescription: "适合白底图和平铺图，把静态商品图做成干净动效。",
    defaultIntent: "突出商品主图可售卖感，保持背景干净，优先展示正面轮廓和可见细节。",
    promptStyleHint:
      "clean ecommerce product motion, marketplace-ready, stable garment shape, no invented details",
    preferredTemplateIds: [
      "product_float",
      "front_pan",
      "front_crop_detail",
      "front_push_in",
    ],
    discouragedTemplateIds: ["model_front_pose", "front_to_back_cut", "back_display"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16, 24],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "low",
  },
  {
    id: "social_lifestyle",
    label: "社媒氛围短片",
    shortDescription: "适合 TikTok/Reels 测款，偏轻氛围但不编造强场景。",
    defaultIntent: "做成适合社媒测款的轻氛围短片，保持服装真实，不生成素材中不存在的场景、背面或细节。",
    promptStyleHint:
      "social short-form product video, subtle lifestyle mood, no strong invented scene, preserve garment identity",
    preferredTemplateIds: [
      "minimal_studio",
      "front_push_in",
      "front_pan",
      "model_front_pose",
    ],
    discouragedTemplateIds: ["front_to_back_cut", "back_display"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "medium",
  },
];
```

- [ ] **Step 6: Implement recommendation helpers**

Create `src/lib/presets/recommend.ts`:

```ts
import type {
  AvailableTemplateRecommendation,
  ShotTemplateRecommendationResult,
} from "@/lib/templates/recommend";

import { defaultStylePresetId, stylePresets } from "./catalog";
import type { StylePreset, StylePresetId, StylePresetSnapshot } from "./types";

export function getStylePreset(value: string | null | undefined): StylePreset {
  return (
    stylePresets.find((preset) => preset.id === value) ??
    stylePresets.find((preset) => preset.id === defaultStylePresetId) ??
    stylePresets[0]
  );
}

export function createPresetSnapshot(preset: StylePreset): StylePresetSnapshot {
  return {
    id: preset.id as StylePresetId,
    label: preset.label,
    preferredTemplateIds: [...preset.preferredTemplateIds],
    promptStyleHint: preset.promptStyleHint,
  };
}

function rankTemplate(
  template: AvailableTemplateRecommendation,
  preset: StylePreset,
) {
  const preferredIndex = preset.preferredTemplateIds.indexOf(template.templateId);
  const discouragedIndex = preset.discouragedTemplateIds?.indexOf(template.templateId) ?? -1;
  const preferredScore =
    preferredIndex >= 0 ? 1000 - preferredIndex * 10 : 0;
  const discouragedScore =
    discouragedIndex >= 0 ? -500 - discouragedIndex * 10 : 0;
  const riskScore = template.riskLevel === "low" ? 50 : 0;
  const trialScore = template.trialAllowed ? 10 : 0;

  return preferredScore + discouragedScore + riskScore + trialScore;
}

function sortAvailable(
  templates: AvailableTemplateRecommendation[],
  preset: StylePreset,
) {
  return [...templates].sort((left, right) => {
    const scoreDiff = rankTemplate(right, preset) - rankTemplate(left, preset);
    return scoreDiff !== 0 ? scoreDiff : left.templateId.localeCompare(right.templateId);
  });
}

export function rankTemplatesForPreset({
  recommendations,
  preset,
}: {
  recommendations: ShotTemplateRecommendationResult;
  preset: StylePreset;
}): ShotTemplateRecommendationResult {
  const allAvailable = sortAvailable(
    [...recommendations.recommended, ...recommendations.optional],
    preset,
  );
  const recommended = allAvailable.filter(
    (template) => template.riskLevel === "low" && template.trialAllowed,
  );
  const optional = allAvailable.filter(
    (template) => !(template.riskLevel === "low" && template.trialAllowed),
  );

  return {
    recommended,
    optional,
    unavailable: recommendations.unavailable,
    availableTemplateIds: allAvailable.map((template) => template.templateId),
  };
}

export function requiredTemplateCount(durationSeconds: 8 | 16 | 24) {
  return durationSeconds === 8 ? 1 : durationSeconds === 16 ? 2 : 3;
}

export function selectTemplateIdsForPreset({
  recommendations,
  preset,
  durationSeconds,
}: {
  recommendations: ShotTemplateRecommendationResult;
  preset: StylePreset;
  durationSeconds: 8 | 16 | 24;
}) {
  const ranked = rankTemplatesForPreset({ recommendations, preset });
  return ranked.availableTemplateIds.slice(requiredTemplateCount(durationSeconds) * 0, requiredTemplateCount(durationSeconds));
}
```

- [ ] **Step 7: Add barrel export**

Create `src/lib/presets/index.ts`:

```ts
export * from "./catalog";
export * from "./recommend";
export * from "./types";
```

- [ ] **Step 8: Run preset tests**

Run:

```bash
npx vitest run src/lib/presets/catalog.test.ts src/lib/presets/recommend.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit Task 1**

```bash
git add src/lib/presets
git commit -m "feat: add style preset catalog"
```

## Task 2: Make Recommendations Preset-Aware Without Weakening Rules

**Files:**

- Modify: `src/server/assets/analyze.ts`
- Modify: `src/server/jobs/get-job.ts`
- Test: `src/server/assets/analyze.test.ts`
- Test: `src/server/jobs/get-job.test.ts`

- [ ] **Step 1: Add tests proving preset ranking does not override rule filtering**

In `src/server/assets/analyze.test.ts`, add:

```ts
it("ranks recommendations by preset without enabling unavailable templates", () => {
  const result = buildRecommendationsFromAnalyses({
    analyses: [
      {
        assetRole: "front",
        garmentCategory: "dress",
        viewAngle: "front",
        humanPresent: "no",
        visibleDetails: ["front_shape"],
        notVisibleDetails: [],
        quality: {
          isGarment: true,
          isClear: true,
          isSafe: true,
          hasFlatLayOrWhiteBackground: true,
        },
        confidence: "high",
        riskFlags: [],
        raw: {},
      },
    ],
    templates: mvpShotTemplates,
    isTrial: false,
    declaredRoles: ["front"],
    presetId: "marketplace_clean",
  });

  expect(result.recommendations.availableTemplateIds[0]).toBe("product_float");
  expect(result.recommendations.availableTemplateIds).not.toContain("back_display");
});
```

If `mvpShotTemplates` is not imported in the file, add:

```ts
import { mvpShotTemplates } from "@/lib/templates/catalog";
```

- [ ] **Step 2: Implement optional `presetId` in asset recommendations**

Modify `buildRecommendationsFromAnalyses` in `src/server/assets/analyze.ts`:

```ts
import { getStylePreset, rankTemplatesForPreset } from "@/lib/presets";
```

Extend input type:

```ts
  presetId?: string | null;
```

Replace:

```ts
  const recommendations = recommendShotTemplates({
    templates,
    assetCompleteness,
    isTrial,
  });
```

With:

```ts
  const baseRecommendations = recommendShotTemplates({
    templates,
    assetCompleteness,
    isTrial,
  });
  const recommendations = rankTemplatesForPreset({
    recommendations: baseRecommendations,
    preset: getStylePreset(presetId),
  });
```

- [ ] **Step 3: Add job detail test for persisted preset ranking**

In `src/server/jobs/get-job.test.ts`, add an in-memory job with `presetId: "marketplace_clean"` and assert `getVideoJobDetail(...).recommendations.availableTemplateIds[0]` is `"product_float"` for front/flat-lay assets.

Use this object shape in the job:

```ts
{
  id: "job-preset",
  userId: "user-1",
  status: "asset_analysis_passed",
  userVisibleStatus: "assets_ready",
  lastError: null,
  failureReason: null,
  durationSeconds: 8,
  aspectRatio: "9:16",
  creditCost: 70,
  billingMode: "paid",
  generationProfile: "paid_720p_audio",
  watermarkEnabled: false,
  presetId: "marketplace_clean",
  presetSnapshot: null,
}
```

- [ ] **Step 4: Extend job summary types and store reads**

Modify `VideoJobSummary` in `src/server/jobs/get-job.ts`:

```ts
  presetId: string | null;
  presetSnapshot: JsonValue | null;
```

Update `createDrizzleVideoJobReadStore().findJob` select:

```ts
presetId: videoJobs.presetId,
presetSnapshot: videoJobs.presetSnapshot,
```

Update `getVideoJobDetail` call to `buildRecommendationsFromAnalyses`:

```ts
presetId: job.presetId,
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npx vitest run src/server/assets/analyze.test.ts src/server/jobs/get-job.test.ts src/lib/presets/recommend.test.ts
```

Expected: pass after schema fields exist in TypeScript. If `videoJobs.presetId` does not exist yet, continue to Task 3 before expecting full pass.

- [ ] **Step 6: Commit Task 2 after Task 3 schema support is present**

```bash
git add src/server/assets/analyze.ts src/server/assets/analyze.test.ts src/server/jobs/get-job.ts src/server/jobs/get-job.test.ts
git commit -m "feat: rank templates by style preset"
```

## Task 3: Persist Preset Id And Snapshot

**Files:**

- Modify: `src/lib/db/schema/jobs.ts`
- Create: `drizzle/0011_style_preset_snapshots.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/lib/db/migrations.test.ts` only if needed by existing journal expectations
- Modify: `src/server/jobs/create-job.ts`
- Modify: `src/app/api/jobs/route.ts`
- Test: `src/server/jobs/create-job.test.ts`
- Test: `src/app/api/jobs/route.test.ts`

- [ ] **Step 1: Add migration file**

Create `drizzle/0011_style_preset_snapshots.sql`:

```sql
ALTER TABLE "video_jobs"
ADD COLUMN IF NOT EXISTS "preset_id" text,
ADD COLUMN IF NOT EXISTS "preset_snapshot" jsonb;

ALTER TABLE "storyboards"
ADD COLUMN IF NOT EXISTS "preset_id" text,
ADD COLUMN IF NOT EXISTS "preset_snapshot" jsonb;
```

- [ ] **Step 2: Register migration in journal**

Append this entry to `drizzle/meta/_journal.json`:

```json
{
  "idx": 11,
  "version": "7",
  "when": 1781620800000,
  "tag": "0011_style_preset_snapshots",
  "breakpoints": true
}
```

Keep valid JSON. Place the entry after `0010_video_segments_storyboard_segment_unique`.

- [ ] **Step 3: Add Drizzle columns**

In `src/lib/db/schema/jobs.ts`, add to `videoJobs` after `aspectRatio`:

```ts
  presetId: text("preset_id"),
  presetSnapshot: jsonSnapshot("preset_snapshot"),
```

Add to `storyboards` after `selectedTemplateIds`:

```ts
  presetId: text("preset_id"),
  presetSnapshot: jsonSnapshot("preset_snapshot"),
```

- [ ] **Step 4: Write create-job tests**

In `src/server/jobs/create-job.test.ts`, add:

```ts
it("stores preset id and snapshot when creating a job", async () => {
  const store = createInMemoryVideoJobCreationStore([
    {
      id: "asset-1",
      userId: "user-1",
      status: "uploaded",
      detectedRole: "front",
    },
  ]);

  const result = await createVideoJobWithAssets({
    store,
    userId: "user-1",
    assetIds: ["asset-1"],
    durationSeconds: 8,
    aspectRatio: "9:16",
    useFreeTrialIfAvailable: false,
    presetId: "marketplace_clean",
  });

  expect(result.job).toMatchObject({
    presetId: "marketplace_clean",
    presetSnapshot: expect.objectContaining({
      id: "marketplace_clean",
      label: "电商主图动效",
    }),
  });
});
```

- [ ] **Step 5: Update create-job types and implementation**

In `src/server/jobs/create-job.ts`:

Add imports:

```ts
import { createPresetSnapshot, getStylePreset } from "@/lib/presets";
```

Extend `CreatedVideoJob`:

```ts
  presetId: string | null;
  presetSnapshot: JsonValue | null;
```

Extend `createJob` returning fields in `createDrizzleVideoJobCreationStore`:

```ts
presetId: videoJobs.presetId,
presetSnapshot: videoJobs.presetSnapshot,
```

Extend `createVideoJobWithAssets` input:

```ts
  presetId?: string | null;
```

Before `store.createJob`, compute:

```ts
  const preset = getStylePreset(presetId);
  const presetSnapshot = createPresetSnapshot(preset) as unknown as JsonValue;
```

Add to `store.createJob` input:

```ts
    presetId: preset.id,
    presetSnapshot,
```

- [ ] **Step 6: Write route forwarding test**

In `src/app/api/jobs/route.test.ts`, add:

```ts
it("forwards preset id to job creation", async () => {
  const seenInputs: unknown[] = [];
  const response = await handleCreateJobRequest(
    new Request("http://localhost/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        assetIds: ["asset-1"],
        durationSeconds: 8,
        aspectRatio: "9:16",
        presetId: "marketplace_clean",
      }),
    }),
    {
      getSession: async () => ({ user: { id: "user-1" } }),
      createJob: async (input) => {
        seenInputs.push(input);
        return {
          job: {
            id: "job-1",
            userId: input.userId,
            status: "asset_analysis_queued",
            userVisibleStatus: "analyzing_assets",
            durationSeconds: input.durationSeconds,
            aspectRatio: "9:16",
            postQaMode: "standard",
            postQaRequired: "true",
            creditCost: 70,
            billingMode: "paid",
            generationProfile: "paid_720p_audio",
            watermarkEnabled: false,
            trialEligibilitySnapshot: null,
            presetId: "marketplace_clean",
            presetSnapshot: null,
            isTest: false,
          },
          jobAssets: [
            {
              id: "job-asset-1",
              videoJobId: "job-1",
              assetId: "asset-1",
              role: "front",
              sortOrder: 0,
            },
          ],
        };
      },
    },
  );

  expect(response.status).toBe(201);
  expect(seenInputs[0]).toMatchObject({ presetId: "marketplace_clean" });
});
```

- [ ] **Step 7: Update route parser**

In `src/app/api/jobs/route.ts`, extend `createJob` deps input:

```ts
    presetId?: string | null;
```

Parse body:

```ts
  const presetId =
    typeof input.presetId === "string" ? input.presetId.trim() : null;
```

Pass to `createJob`:

```ts
      presetId,
```

- [ ] **Step 8: Run migration and route tests**

Run:

```bash
npx vitest run src/lib/db/migrations.test.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.test.ts src/server/jobs/get-job.test.ts
```

Expected: pass.

- [ ] **Step 9: Commit Task 3**

```bash
git add drizzle/0011_style_preset_snapshots.sql drizzle/meta/_journal.json src/lib/db/schema/jobs.ts src/server/jobs/create-job.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.ts src/app/api/jobs/route.test.ts src/server/jobs/get-job.ts src/server/jobs/get-job.test.ts src/server/assets/analyze.ts src/server/assets/analyze.test.ts
git commit -m "feat: persist style preset on jobs"
```

## Task 4: Include Preset In Storyboard Generation

**Files:**

- Modify: `src/server/storyboard/generate.ts`
- Modify: `src/server/storyboard/generate.test.ts`
- Modify: `src/app/api/jobs/[id]/storyboard/route.ts`
- Modify: `src/app/api/jobs/[id]/storyboard/route.test.ts`

- [ ] **Step 1: Add storyboard test for preset style hint**

In `src/server/storyboard/generate.test.ts`, add:

```ts
it("sends persisted preset style hint and stores preset snapshot with storyboard", async () => {
  const capturedPrompts: string[] = [];
  const storyboardStore = createInMemoryStoryboardStore();

  await generateStoryboardDraft({
    jobReadStore: createInMemoryVideoJobReadStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "asset_analysis_passed",
          userVisibleStatus: "assets_ready",
          lastError: null,
          failureReason: null,
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
          presetId: "marketplace_clean",
          presetSnapshot: {
            id: "marketplace_clean",
            label: "电商主图动效",
            preferredTemplateIds: ["product_float"],
            promptStyleHint: "clean ecommerce product motion",
          },
        },
      ],
      assets: [{ assetId: "asset-front", role: "front", sortOrder: 0 }],
      analyses: [
        {
          assetId: "asset-front",
          analysisJson: {
            asset_role: "front",
            garment_category: "dress",
            view_angle: "front",
            human_present: "no",
            visible_details: ["front_shape"],
            not_visible_details: [],
            quality: {
              is_garment: true,
              is_clear: true,
              is_safe: true,
              has_flat_lay_or_white_background: true,
            },
            confidence: "high",
            risk_flags: [],
          },
        },
      ],
    }),
    jobStore: createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_passed",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]),
    storyboardStore,
    providerCallLogStore: createInMemoryProviderCallLogStore(),
    moderationResultStore: createInMemoryModerationResultStore(),
    jobId,
    userId,
    selectedTemplateIds: ["product_float"],
    userPrompt: "Make it marketplace-ready.",
    templates: mvpShotTemplates,
    moderatePrompt: async () => ({ id: "mod-preset", decision: "allow", raw: {} }),
    createStoryboard: async (input) => {
      capturedPrompts.push(input.userPrompt);
      return {
        provider: "deepseek",
        model: "deepseek-v4-flash",
        storyboardJson: {
          duration_seconds: 8,
          segments: [
            {
              index: 0,
              duration_seconds: 8,
              template_id: "product_float",
              prompt: "Clean product float.",
            },
          ],
        },
        raw: {},
      };
    },
  });

  const prompt = JSON.parse(capturedPrompts[0] ?? "{}");
  expect(prompt.style_preset).toMatchObject({
    id: "marketplace_clean",
    prompt_style_hint: "clean ecommerce product motion",
  });
  expect(storyboardStore.listStoryboards()[0]).toMatchObject({
    presetId: "marketplace_clean",
    presetSnapshot: expect.objectContaining({ id: "marketplace_clean" }),
  });
});
```

- [ ] **Step 2: Update storyboard store types**

In `src/server/storyboard/generate.ts`, extend `StoryboardRecord`:

```ts
  presetId: string | null;
  presetSnapshot: JsonValue | null;
```

Extend `NewStoryboardRecord`:

```ts
  presetId?: string | null;
  presetSnapshot?: JsonValue | null;
```

Update `toRecordInput`:

```ts
    presetId: input.presetId ?? null,
    presetSnapshot: input.presetSnapshot ?? null,
```

- [ ] **Step 3: Add preset to DeepSeek user prompt**

In `userPromptForStoryboard`, add parameters:

```ts
  presetSnapshot?: JsonValue | null;
```

Add to returned JSON:

```ts
    style_preset: presetSnapshot
      ? {
          id: asJsonRecord(presetSnapshot).id ?? null,
          label: asJsonRecord(presetSnapshot).label ?? null,
          prompt_style_hint: asJsonRecord(presetSnapshot).promptStyleHint ?? null,
        }
      : null,
```

When calling `userPromptForStoryboard`, pass:

```ts
    presetSnapshot: detail.job.presetSnapshot,
```

- [ ] **Step 4: Persist preset on storyboard**

When calling `storyboardStore.createStoryboard`, add:

```ts
    presetId: detail.job.presetId,
    presetSnapshot: detail.job.presetSnapshot,
```

- [ ] **Step 5: Update Drizzle insert returning if required**

`storyboards` schema now includes `presetId` and `presetSnapshot`; `.returning()` will include them automatically. If TypeScript complains, update casts in `StoryboardRecord`.

- [ ] **Step 6: Run storyboard tests**

Run:

```bash
npx vitest run src/server/storyboard/generate.test.ts src/app/api/jobs/[id]/storyboard/route.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/server/storyboard/generate.ts src/server/storyboard/generate.test.ts src/app/api/jobs/[id]/storyboard/route.ts src/app/api/jobs/[id]/storyboard/route.test.ts
git commit -m "feat: include style preset in storyboard generation"
```

## Task 5: Add Workspace Preset UI And Query Defaults

**Files:**

- Create: `src/components/workspace/style-preset-selector.tsx`
- Create: `src/components/workspace/style-preset-selector.test.tsx`
- Modify: `src/app/(dashboard)/workspace/page.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`

- [ ] **Step 1: Write selector tests**

Create `src/components/workspace/style-preset-selector.test.tsx`:

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StylePresetSelector } from "./style-preset-selector";

describe("StylePresetSelector", () => {
  it("renders presets and emits the selected preset id", () => {
    const onChange = vi.fn();
    render(
      <StylePresetSelector
        selectedPresetId="minimal_studio"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("极简棚拍")).toBeInTheDocument();
    expect(screen.getByText("电商主图动效")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /电商主图动效/ }));
    expect(onChange).toHaveBeenCalledWith("marketplace_clean");
  });
});
```

- [ ] **Step 2: Implement selector**

Create `src/components/workspace/style-preset-selector.tsx`:

```tsx
"use client";

import { stylePresets, type StylePresetId } from "@/lib/presets";

export function StylePresetSelector({
  selectedPresetId,
  onChange,
}: {
  selectedPresetId: StylePresetId;
  onChange: (presetId: StylePresetId) => void;
}) {
  return (
    <section>
      <p className="text-sm font-medium">风格</p>
      <div className="mt-3 grid gap-2">
        {stylePresets.map((preset) => {
          const active = preset.id === selectedPresetId;
          return (
            <button
              className={`rounded-md border px-3 py-3 text-left transition ${
                active
                  ? "border-[var(--accent-strong)] bg-cyan-50"
                  : "border-[var(--line)] bg-white"
              }`}
              key={preset.id}
              onClick={() => onChange(preset.id)}
              type="button"
            >
              <span className="block text-sm font-medium">{preset.label}</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
                {preset.shortDescription}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Update workspace page props**

Modify `src/app/(dashboard)/workspace/page.tsx` signature:

```ts
export default async function WorkspacePage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; preset?: string }>;
}) {
```

Resolve:

```ts
  const resolvedSearchParams = await searchParams;
```

Pass to `WorkspaceApp`:

```tsx
      <WorkspaceApp
        initialMode={resolvedSearchParams?.mode === "trial" ? "trial" : "paid"}
        initialPresetId={resolvedSearchParams?.preset}
        templateCatalog={mvpShotTemplates}
      />
```

- [ ] **Step 4: Add workspace tests for query defaults and payloads**

In `src/components/workspace/workspace-app.test.tsx`, add:

```tsx
it("applies trial mode and preset defaults from props", () => {
  render(
    <WorkspaceApp
      initialMode="trial"
      initialPresetId="marketplace_clean"
      templateCatalog={templateCatalog}
    />,
  );

  expect(screen.getByText("电商主图动效")).toBeInTheDocument();
  expect(screen.getByDisplayValue(/商品主图可售卖感/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "免费试用" })).toBeInTheDocument();
});
```

Update existing payload expectations to include:

```ts
presetId: "minimal_studio",
```

For `initialPresetId="marketplace_clean"` tests, expect:

```ts
presetId: "marketplace_clean",
```

- [ ] **Step 5: Modify WorkspaceApp props and state**

In `src/components/workspace/workspace-app.tsx`:

Add imports:

```ts
import {
  getStylePreset,
  selectTemplateIdsForPreset,
  type StylePresetId,
  type WorkspaceEntryMode,
} from "@/lib/presets";
import { StylePresetSelector } from "./style-preset-selector";
```

Update props:

```ts
interface WorkspaceAppProps {
  templateCatalog: TemplateCatalogItem[];
  initialMode?: WorkspaceEntryMode;
  initialPresetId?: string | null;
}
```

Initialize preset:

```ts
  const initialPreset = getStylePreset(initialPresetId);
  const [selectedPresetId, setSelectedPresetId] = useState<StylePresetId>(
    initialPreset.id,
  );
```

Use preset defaults:

```ts
  const [durationSeconds, setDurationSeconds] = useState<8 | 16 | 24>(
    initialMode === "trial" ? 8 : initialPreset.defaultDurationSeconds,
  );
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">(
    initialPreset.defaultAspectRatio,
  );
  const [userPrompt, setUserPrompt] = useState(initialPreset.defaultIntent);
```

Add handler:

```ts
  function changePreset(presetId: StylePresetId) {
    const nextPreset = getStylePreset(presetId);
    setSelectedPresetId(nextPreset.id);
    setUserPrompt(nextPreset.defaultIntent);
    if (!nextPreset.allowedDurationSeconds.includes(durationSeconds)) {
      setDurationSeconds(nextPreset.defaultDurationSeconds);
    }
  }
```

Render selector before `SpecSelector`:

```tsx
            <StylePresetSelector
              selectedPresetId={selectedPresetId}
              onChange={changePreset}
            />
```

- [ ] **Step 6: Use preset for auto-selected templates**

Replace the body of `defaultTemplateSelection` in `WorkspaceApp` with:

```ts
    return selectTemplateIdsForPreset({
      recommendations: detailBody.recommendations,
      preset: getStylePreset(selectedPresetId),
      durationSeconds: nextDurationSeconds,
    });
```

Remove the old special-case scene preference from this function. Scene preference should live in preset/template ranking, not hardcoded in the component.

- [ ] **Step 7: Send preset id to job and storyboard routes**

In `/api/jobs` body:

```ts
        presetId: selectedPresetId,
```

In `/api/jobs/${targetJobId}/storyboard` body:

```ts
        presetId: selectedPresetId,
```

The storyboard route may ignore `presetId` after Task 4, but including it keeps client/server payloads explicit. The server must use persisted job preset as authority.

- [ ] **Step 8: Run workspace tests**

Run:

```bash
npx vitest run src/components/workspace/style-preset-selector.test.tsx src/components/workspace/workspace-app.test.tsx src/app/(dashboard)/workspace/page.test.tsx
```

PowerShell note: if the route path causes shell parsing issues, run the page test separately with quoted literal path:

```bash
npx vitest run "src/app/(dashboard)/workspace/page.test.tsx"
```

- [ ] **Step 9: Commit Task 5**

```bash
git add src/components/workspace src/app/(dashboard)/workspace/page.tsx
git commit -m "feat: add workspace style preset selector"
```

## Task 6: Build Public Site Entry Pages

**Files:**

- Create: `src/components/public/public-header.tsx`
- Create: `src/components/public/public-footer.tsx`
- Create: `src/components/public/cta-link.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/pricing/page.tsx`
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Add or update tests near `src/app/app-shell.test.ts` or page-specific tests if existing patterns support server component rendering.

- [ ] **Step 1: Add CTA href helper**

Create `src/components/public/cta-link.tsx`:

```tsx
import Link from "next/link";

export function trialWorkspaceHref() {
  return "/workspace?mode=trial&preset=minimal_studio";
}

export function loginTrialHref() {
  return `/login?next=${encodeURIComponent(trialWorkspaceHref())}`;
}

export function TrialCtaLink({
  children = "免费生成 1 条试用视频",
}: {
  children?: React.ReactNode;
}) {
  return (
    <Link
      className="inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent)] px-5 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
      href={loginTrialHref()}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Add public header/footer**

Create `src/components/public/public-header.tsx`:

```tsx
import Link from "next/link";

import { LogoLockup } from "@/components/brand/logo";

import { TrialCtaLink } from "./cta-link";

export function PublicHeader() {
  return (
    <header className="border-b border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <LogoLockup />
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/pricing">价格</Link>
          <Link href="/login">登录</Link>
          <TrialCtaLink>免费试用</TrialCtaLink>
        </nav>
      </div>
    </header>
  );
}
```

Create `src/components/public/public-footer.tsx`:

```tsx
import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--line)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-sm text-[var(--muted)]">
        <p>RunwayTools · 服装商品图生成宣传短视频工具</p>
        <div className="flex gap-4">
          <Link href="/privacy">隐私</Link>
          <Link href="/terms">条款</Link>
          <Link href="/pricing">价格</Link>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Replace homepage redirect with Landing**

Modify `src/app/page.tsx`:

```tsx
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TrialCtaLink } from "@/components/public/cta-link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-14 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
            Clothing product video generator
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-normal md:text-5xl">
            把服装商品图变成可发布的短视频
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--muted)]">
            上传正面图，选择风格预设，系统自动推荐安全镜头，生成 8/16/24 秒商品宣传视频。
            免费试用默认 8 秒、低分辨率、无音频、带水印。
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <TrialCtaLink />
            <a
              className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--line)] bg-white px-5 text-sm font-medium"
              href="/pricing"
            >
              查看价格
            </a>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">试用流程</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted)]">
            <li>1. 登录后进入极简棚拍试用模式。</li>
            <li>2. 上传服装正面图，可补背面、细节或场景图。</li>
            <li>3. 系统分析素材并自动选择安全镜头。</li>
            <li>4. 生成完成后下载带水印试用视频。</li>
          </ol>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-14 md:grid-cols-3">
        {[
          ["不编造服装细节", "无背面图不生成背面，无细节图不生成细节特写。"],
          ["Preset 简化选择", "用户选风格，系统自动推荐镜头模板。"],
          ["点数清晰", "确认分镜后冻结点数，质检通过后正式扣除。"],
        ].map(([title, text]) => (
          <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={title}>
            <h3 className="text-sm font-medium">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text}</p>
          </div>
        ))}
      </section>
      <PublicFooter />
    </main>
  );
}
```

- [ ] **Step 4: Add pricing page**

Create `src/app/pricing/page.tsx` with trial limits, credit costs, and packages:

```tsx
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";
import { TrialCtaLink } from "@/components/public/cta-link";
import { creditPackages } from "@/lib/credits/packages";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">价格</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          MVP 使用免费试用 + 点数包。付费生成默认高清无水印并包含音频。
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {creditPackages.map((item) => (
            <div className="rounded-lg border border-[var(--line)] bg-white p-5" key={item.code}>
              <h2 className="text-base font-medium">{item.name}</h2>
              <p className="mt-3 text-3xl font-semibold">
                ${(item.amountCents / 100).toFixed(2)}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{item.credits} 点</p>
            </div>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-[var(--line)] bg-white p-5">
          <h2 className="text-base font-medium">生成消耗</h2>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
            <p>8 秒：70 点</p>
            <p>16 秒：130 点</p>
            <p>24 秒：190 点</p>
          </div>
        </div>
        <div className="mt-8">
          <TrialCtaLink />
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
```

The code above matches the current `src/lib/credits/packages.ts` fields: `code`, `amountCents`, and `credits`.

- [ ] **Step 5: Add privacy and terms pages**

Create `src/app/privacy/page.tsx`:

```tsx
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">隐私政策</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--muted)]">
          <p>我们会保存账号信息、上传素材、生成任务、点数流水和模型调用审计记录，用于提供生成、下载、排障和合规审核。</p>
          <p>用户上传图片和生成视频默认存储在私有对象存储中，访问使用短期 signed URL。</p>
          <p>用于生成链路的用户文本和最终 prompt 会经过 Creem Moderation。审核失败或服务不可用时，生成会被阻止。</p>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
```

Create `src/app/terms/page.tsx`:

```tsx
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--surface)] text-[var(--ink)]">
      <PublicHeader />
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-semibold tracking-normal">服务条款</h1>
        <div className="mt-6 space-y-5 text-sm leading-7 text-[var(--muted)]">
          <p>本服务用于服装商品图生成宣传短视频。用户应上传自己有权使用的素材。</p>
          <p>系统不会承诺生成结果 100% 无异常。任务通过质量检查后才开放下载并正式扣除点数。</p>
          <p>无背面图、无细节图或素材不完整时，相关镜头会被禁用。用户不得尝试通过 prompt 绕过素材和合规限制。</p>
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
```

- [ ] **Step 6: Run build/typecheck**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both pass.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/app/page.tsx src/app/pricing src/app/privacy src/app/terms src/components/public
git commit -m "feat: add public site trial entry"
```

## Task 7: Admin Visibility For Preset

**Files:**

- Modify: `src/server/admin/jobs.ts`
- Modify: `src/components/admin/job-detail-panel.tsx`
- Modify: `src/server/admin/jobs.test.ts`
- Modify: `src/components/admin/job-detail-panel.test.tsx`

- [ ] **Step 1: Add admin service fields**

Extend `AdminJobRecord` in `src/server/admin/jobs.ts`:

```ts
  presetId: string | null;
  presetSnapshot: unknown;
```

Add to Drizzle select:

```ts
presetId: videoJobs.presetId,
presetSnapshot: videoJobs.presetSnapshot,
```

Extend `AdminStoryboardRecord`:

```ts
  presetId?: string | null;
  presetSnapshot?: unknown;
```

Add to storyboard select:

```ts
presetId: storyboards.presetId,
presetSnapshot: storyboards.presetSnapshot,
```

- [ ] **Step 2: Add admin panel display**

In `src/components/admin/job-detail-panel.tsx`, add summary items:

```tsx
        <SummaryItem label="Preset" value={detail.job.presetId ?? "-"} />
```

Add JSON block after Trial Eligibility:

```tsx
      <JsonBlock
        title="Style Preset Snapshot"
        data={detail.job.presetSnapshot ?? detail.latestStoryboard?.presetSnapshot ?? null}
      />
```

In the storyboard summary grid add:

```tsx
              <SummaryItem
                label="Preset"
                value={detail.latestStoryboard.presetId ?? detail.job.presetId ?? "-"}
              />
```

- [ ] **Step 3: Update tests**

In `src/components/admin/job-detail-panel.test.tsx`, ensure the fixture has:

```ts
presetId: "minimal_studio",
presetSnapshot: {
  id: "minimal_studio",
  label: "极简棚拍",
},
```

Assert:

```ts
expect(screen.getByText("Style Preset Snapshot")).toBeInTheDocument();
expect(screen.getByText("minimal_studio")).toBeInTheDocument();
```

- [ ] **Step 4: Run admin tests**

Run:

```bash
npx vitest run src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit Task 7**

```bash
git add src/server/admin/jobs.ts src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.tsx src/components/admin/job-detail-panel.test.tsx
git commit -m "feat: show style preset in admin job detail"
```

## Task 8: Verification Pass

**Files:** no source files expected unless tests reveal a defect.

- [ ] **Step 1: Run preset and workspace test set**

```bash
npx vitest run src/lib/presets/catalog.test.ts src/lib/presets/recommend.test.ts src/server/assets/analyze.test.ts src/server/jobs/create-job.test.ts src/server/jobs/get-job.test.ts src/server/storyboard/generate.test.ts src/components/workspace/style-preset-selector.test.tsx src/components/workspace/workspace-app.test.tsx src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.test.tsx src/lib/db/migrations.test.ts
```

Expected: pass.

- [ ] **Step 2: Run global verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: pass.

- [ ] **Step 3: Manual browser sanity check**

Start dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/
http://localhost:3000/pricing
http://localhost:3000/privacy
http://localhost:3000/terms
http://localhost:3000/workspace?mode=trial&preset=minimal_studio
```

Check:

- Landing does not redirect to login immediately.
- Landing CTA points to `/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio`.
- Workspace shows `极简棚拍` selected and trial CTA visible.
- Changing preset updates the generation intent.
- Template advanced section remains available.

- [ ] **Step 4: Final commit if verification fixes were needed**

If Step 1-3 required fixes, replace `path/to/changed-file.ts` with the actual file paths reported by `git status --short`:

```bash
git add path/to/changed-file.ts
git commit -m "fix: complete style preset verification"
```

If no fixes were needed, do not create an empty commit.

## Task 9: Post-Implementation Smoke Gate Before Real Users

This task is not required for local-only UI review. It is required before sending the new flow to external users.

- [ ] **Step 1: Apply migration to the target database**

Run:

```bash
npm run db:migrate
```

Expected: migration succeeds and `video_jobs` / `storyboards` include preset columns.

- [ ] **Step 2: Create a new paid test job through the new workspace flow**

Use a test account with enough credits. Generate a paid 8-second task using `minimal_studio` or `marketplace_clean`.

Record the job id in the current PowerShell session. Replace the value below with the real UUID shown by the task page or database:

```powershell
$env:STYLE_PRESET_PAID_JOB_ID="00000000-0000-4000-8000-000000000000"
```

- [ ] **Step 3: Run backend smoke**

```bash
npm run smoke:backend -- --job-id $env:STYLE_PRESET_PAID_JOB_ID
```

Expected:

- `video_jobs.status = deliverable`
- `credit_cost > 0`
- `credit_ledger` contains `reserve` and `capture`
- final video exists in R2
- QA frames exist in R2

- [ ] **Step 4: Run blocker verifier**

```bash
npm run verify:blockers -- --json
```

Expected: `passed = true`.

- [ ] **Step 5: Update verification docs**

Append the new job id and result summary to `docs/API_TEST_STATUS.md` if this flow becomes the new public trial path.

Commit:

```bash
git add docs/API_TEST_STATUS.md
git commit -m "docs: record style preset smoke verification"
```

## Execution Notes

The safest implementation order is:

1. Task 1 preset catalog.
2. Task 3 schema persistence.
3. Task 2 recommendation integration.
4. Task 4 storyboard integration.
5. Task 5 workspace UI.
6. Task 6 public site.
7. Task 7 admin visibility.
8. Task 8 local verification.
9. Task 9 real smoke before external users.

Task 2 depends on Task 3 for TypeScript schema fields. Do not force Task 2 to pass before schema columns exist.

Keep each task in its own commit. If a task touches unrelated files, stop and re-scope before continuing.
