# Product Rotation Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Beta product-only 15-45 degree and 180 degree rotation templates that require matching multi-view garment photos and never create a person.

**Architecture:** Extend per-image analysis with an explicit, conservative subject kind, add a persisted job-level multi-image consistency analysis, and expose product-view capabilities to the template rule engine. Feed only verified product front/side/back assets to APIMart in deterministic order. Keep both templates paid-only, Advanced-only, and Strict-QA-only.

**Tech Stack:** TypeScript, Vitest, Drizzle/Neon, OpenAI-compatible vision APIs, APIMart PixVerse V6, Next.js.

---

## Execution Preconditions

- Complete `2026-07-10-readme-development-environment.md` and `2026-07-10-40s-paid-beta.md` first.
- The current working tree already contains an untracked `drizzle/0014_admin_audit_target_id_text.sql` and edits to `drizzle/meta/_journal.json`. Preserve them. Generate this plan's migration after every migration created by earlier plans; do not rewrite or renumber migration 0014.
- Preserve the user's declared-role normalization changes in `analysis-schema.ts`, `analyze.ts`, and `job-analysis.ts`.

## File Map

- Modify `src/lib/db/schema/assets.ts`: persist subject kind and job-level consistency results.
- Modify `src/lib/db/schema/templates.ts`: persist template subject, consistency requirements, and automatic-selection permission.
- Create the next Drizzle migration after 0014.
- Modify `src/lib/providers/vision/client.ts`, `src/server/assets/analysis-schema.ts` and tests: explicitly classify `product | human_model | unknown` without treating every visible person as a model-worn garment.
- Extend `src/lib/providers/vision/client.ts` and tests: structured multi-view consistency call.
- Create `src/server/assets/consistency.ts` and tests: parser, store, provider logging, fail-closed result.
- Modify `src/server/assets/job-analysis.ts` and tests: run consistency after per-image analysis.
- Modify `src/lib/templates/types.ts`, `rules.ts`, `catalog.ts` and tests: product capabilities and templates.
- Modify `src/server/assets/classify-role.ts` and tests: build product-view completeness.
- Modify `src/server/storyboard/confirm.ts` and tests: product-only asset filtering and front/side/back ordering.
- Modify `src/server/storyboard/global-constraints.ts`, `src/server/video/prompt-compiler.ts` and tests: no-person and bounded-rotation hard constraints.
- Modify workspace template labels/tests and documentation.

### Task 1: Persist Subject and Cross-View Consistency Data

**Files:**
- Modify: `src/lib/db/schema/assets.ts`
- Modify: `src/lib/db/schema/templates.ts`
- Modify: `src/lib/db/schema/index.test.ts`
- Create: next migration after the current `drizzle/meta/_journal.json` tail

- [ ] **Step 1: Add failing schema-export tests**

Add assertions that the schema index exports `assetConsistencyAnalyses` and that template records expose `subjectKind`, `consistencyRequirements`, and `autoSelectAllowed`.

```ts
expect(schema.assetConsistencyAnalyses).toBeDefined();
expect(schema.shotTemplates.subjectKind).toBeDefined();
expect(schema.shotTemplates.consistencyRequirements).toBeDefined();
expect(schema.shotTemplates.autoSelectAllowed).toBeDefined();
```

- [ ] **Step 2: Run the schema test and verify failure**

```powershell
pnpm exec vitest run src/lib/db/schema/index.test.ts
```

- [ ] **Step 3: Add subject kind and consistency tables**

In `assets.ts` define:

```ts
export const assetSubjectKindValues = [
  "product",
  "human_model",
  "unknown",
] as const;
export const assetSubjectKindEnum = pgEnum(
  "asset_subject_kind",
  assetSubjectKindValues,
);
```

Add to `assetAnalyses`:

```ts
subjectKind: assetSubjectKindEnum("subject_kind")
  .notNull()
  .default("unknown"),
```

Add a job-level table:

```ts
export const assetConsistencyAnalyses = pgTable(
  "asset_consistency_analyses",
  {
    ...id,
    videoJobId: uuid("video_job_id").notNull(),
    analysisKind: text("analysis_kind").notNull(),
    status: text("status").notNull(),
    garmentMatch: text("garment_match").notNull(),
    modelMatch: text("model_match").notNull(),
    colorMatch: boolean("color_match").notNull().default(false),
    patternMatch: boolean("pattern_match").notNull().default(false),
    viewCoverage: jsonSnapshot("view_coverage").notNull().default([]),
    confidence: text("confidence"),
    riskFlags: jsonSnapshot("risk_flags").notNull().default([]),
    resultJson: jsonSnapshot("result_json").notNull(),
    providerCallLogId: uuid("provider_call_log_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asset_consistency_job_kind_unique").on(
      table.videoJobId,
      table.analysisKind,
    ),
  ],
);
```

Import `boolean` and `uniqueIndex` where needed and ensure the table is exported from `schema/index.ts`.

In `templates.ts`, add:

```ts
subjectKind: text("subject_kind").notNull().default("any"),
consistencyRequirements: jsonSnapshot("consistency_requirements")
  .notNull()
  .default([]),
autoSelectAllowed: boolean("auto_select_allowed").notNull().default(true),
```

- [ ] **Step 4: Generate and inspect the migration**

```powershell
pnpm db:generate
```

Expected: one new migration after the current journal tail containing the enum, new columns, table, and unique index. Inspect it; do not accept destructive drops of unrelated columns.

- [ ] **Step 5: Run schema tests and commit**

```powershell
pnpm exec vitest run src/lib/db/schema/index.test.ts src/lib/db/migrations.test.ts
pnpm run typecheck
git add src/lib/db/schema/assets.ts src/lib/db/schema/templates.ts src/lib/db/schema/index.ts src/lib/db/schema/index.test.ts drizzle
git commit -m "feat: store asset consistency analyses"
```

### Task 2: Classify Product and Human-Model Subject Kinds Conservatively

**Files:**
- Modify: `src/lib/providers/vision/client.ts`
- Modify: `src/lib/providers/vision/client.test.ts`
- Modify: `src/server/assets/analysis-schema.ts`
- Modify: `src/server/assets/analysis-schema.test.ts`
- Modify: `src/server/assets/analyze.ts`
- Modify: `src/server/assets/analyze.test.ts`

- [ ] **Step 1: Add failing parser tests**

```ts
it("accepts an explicit product subject kind", () => {
  expect(parseAssetAnalysisJson(visionJson({ human_present: "no", subject_kind: "product" })).subjectKind)
    .toBe("product");
});

it("accepts human_model only when the target garment is worn by the person", () => {
  expect(parseAssetAnalysisJson(visionJson({ human_present: "yes", subject_kind: "human_model" })).subjectKind)
    .toBe("human_model");
});

it("does not infer a model-worn garment from human_present alone", () => {
  expect(parseAssetAnalysisJson(visionJson({ human_present: "yes" })).subjectKind)
    .toBe("unknown");
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts src/server/assets/analysis-schema.test.ts src/server/assets/analyze.test.ts
```

- [ ] **Step 3: Add the derived field**

```ts
export type AssetSubjectKind = "product" | "human_model" | "unknown";

function subjectKindFromAnalysis({
  explicitSubjectKind,
  humanPresent,
  isGarment,
}: {
  explicitSubjectKind: AssetSubjectKind | null;
  humanPresent: HumanPresent;
  isGarment: boolean;
}): AssetSubjectKind {
  if (explicitSubjectKind) return explicitSubjectKind;
  if (humanPresent === "no" && isGarment) return "product";
  return "unknown";
}
```

Add required `subject_kind` to the provider JSON schema and instruction. Define `human_model` as “the visible person is wearing the target garment”; a person merely present in a scene is not enough. The parser accepts a missing field only for compatibility and falls back conservatively as shown above. Return `subjectKind` from `parseAssetAnalysisJson`, store it in `toRecordInput`, and include it in the analysis summary. Keep all existing declared-role normalization behavior.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts src/server/assets/analysis-schema.test.ts src/server/assets/analyze.test.ts
pnpm run typecheck
git add src/lib/providers/vision/client.ts src/lib/providers/vision/client.test.ts src/server/assets/analysis-schema.ts src/server/assets/analysis-schema.test.ts src/server/assets/analyze.ts src/server/assets/analyze.test.ts
git commit -m "feat: classify product and model-worn assets"
```

### Task 3: Add the Multi-View Vision Provider Contract

**Files:**
- Modify: `src/lib/providers/vision/client.ts`
- Modify: `src/lib/providers/vision/client.test.ts`

- [ ] **Step 1: Write a failing structured-response test**

Mock an OpenAI-compatible response using the existing `calls` / `fetchMock` pattern, then invoke the new client and assert:

```ts
const result = await createVisionConsistencyAnalysis(
  {
    imageUrls: [
      "https://signed.example/front.jpg",
      "https://signed.example/side.jpg",
      "https://signed.example/back.jpg",
    ],
    declaredRoles: ["front", "side", "back"],
    expectedSubjectKind: "product",
  },
  { fetch: fetchMock },
);
const requestBody = JSON.parse(calls[0]?.[1]?.body as string);

expect(result.consistencyJson).toEqual({
  garment_match: "pass",
  model_match: "not_applicable",
  color_match: true,
  pattern_match: true,
  view_coverage: ["front", "side", "back"],
  confidence: "0.93",
  risk_flags: [],
});
expect(requestBody.messages[1].content).toHaveLength(3);
```

- [ ] **Step 2: Run and verify the missing API failure**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts
```

- [ ] **Step 3: Implement the consistency request**

Add:

```ts
export interface VisionConsistencyInput {
  imageUrls: string[];
  declaredRoles: string[];
  expectedSubjectKind: "product" | "human_model";
}

export interface VisionConsistencyResult {
  provider: string;
  model: string;
  consistencyJson: JsonValue;
  raw: JsonValue;
}
```

Export `createVisionConsistencyAnalysis(input, deps = {})` beside the existing asset/Post-QA clients. It always calls `getVisionConfig("strict")`, preserves declared role order when building image content, and returns `VisionConsistencyResult`.

Use the Strict vision model and a strict JSON schema requiring:

```ts
const consistencyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "garment_match",
    "model_match",
    "color_match",
    "pattern_match",
    "view_coverage",
    "confidence",
    "risk_flags",
  ],
  properties: {
    garment_match: { enum: ["pass", "fail", "unknown"] },
    model_match: { enum: ["pass", "fail", "unknown", "not_applicable"] },
    color_match: { type: "boolean" },
    pattern_match: { type: "boolean" },
    view_coverage: { type: "array", items: { type: "string" } },
    confidence: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
  },
} as const;
```

The system instruction must say this is task-local consistency analysis and must return `unknown` when evidence is insufficient.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts
pnpm run typecheck
git add src/lib/providers/vision/client.ts src/lib/providers/vision/client.test.ts
git commit -m "feat: analyze multi-view garment consistency"
```

### Task 4: Build the Consistency Service and Store

**Files:**
- Create: `src/server/assets/consistency.ts`
- Create: `src/server/assets/consistency.test.ts`

- [ ] **Step 1: Write failing parser and service tests**

Cover `pass`, malformed values, and provider failure with this local fixture:

```ts
const validJson = {
  garment_match: "pass",
  model_match: "not_applicable",
  color_match: true,
  pattern_match: true,
  view_coverage: ["front", "side", "back"],
  confidence: "0.93",
  risk_flags: [],
};

expect(parseConsistencyJson(validJson, "product")).toMatchObject({
  status: "passed",
  garmentMatch: "pass",
  modelMatch: "not_applicable",
});

expect(() =>
  parseConsistencyJson({ ...validJson, garment_match: "maybe" }, "product"),
).toThrow("Consistency JSON has invalid garment_match.");

const resultStore = createInMemoryAssetConsistencyStore();
const callLogStore = createInMemoryProviderCallLogStore();
const unavailable = await runAssetConsistencyAnalysis({
    store: resultStore,
    providerCallLogStore: callLogStore,
    videoJobId: "job-1",
    analysisKind: "product_views",
    expectedSubjectKind: "product",
    assets: [
      { assetId: "front-1", role: "front", imageUrl: "https://signed.example/front.jpg" },
      { assetId: "side-1", role: "side", imageUrl: "https://signed.example/side.jpg" },
    ],
    analyzeConsistency: async () => {
      throw new Error("vision unavailable");
    },
  });
expect(unavailable).toMatchObject({
  status: "unknown",
  garmentMatch: "unknown",
  modelMatch: "not_applicable",
});
expect(callLogStore.listCallLogs()[0]).toMatchObject({
  purpose: "strict_asset_review",
  status: "failed",
});
```

- [ ] **Step 2: Run and verify failure**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts
```

- [ ] **Step 3: Implement parser, in-memory store, Drizzle store, and provider logging**

Use these normalized types:

```ts
export type ConsistencyDecision = "pass" | "fail" | "unknown";
export type ModelConsistencyDecision =
  | ConsistencyDecision
  | "not_applicable";

export type ParsedConsistency = {
  status: "passed" | "failed" | "unknown";
  garmentMatch: ConsistencyDecision;
  modelMatch: ModelConsistencyDecision;
  colorMatch: boolean;
  patternMatch: boolean;
  viewCoverage: string[];
  confidence: string;
  riskFlags: string[];
  raw: JsonValue;
};
```

Define `runAssetConsistencyAnalysis` with the exact dependency-injected arguments used in Step 1: `store`, `providerCallLogStore`, `videoJobId`, `analysisKind`, `expectedSubjectKind`, ordered `assets`, and optional `analyzeConsistency`.

`status` is `passed` only when `garmentMatch === "pass"` and, for product analysis, `modelMatch === "not_applicable"`. On provider error or malformed output, log the failed call and upsert an `unknown` fail-closed record with `resultJson: { error: "provider_unavailable" | "invalid_provider_response" }`; do not throw the whole per-image analysis job. Upsert one record per `videoJobId + analysisKind` and store only asset ids/roles in provider request logs, never signed URLs.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts
pnpm run typecheck
git add src/server/assets/consistency.ts src/server/assets/consistency.test.ts
git commit -m "feat: persist product view consistency"
```

### Task 5: Extend Template Capabilities and Add Product Rotation Templates

**Files:**
- Modify: `src/lib/templates/types.ts`
- Modify: `src/lib/templates/rules.ts`
- Modify: `src/lib/templates/recommend.test.ts`
- Modify: `src/lib/templates/catalog.ts`
- Modify: `src/lib/templates/catalog.test.ts`
- Modify: `src/lib/presets/recommend.ts`
- Modify: `src/lib/presets/recommend.test.ts`
- Modify: `src/server/templates/seed.ts`
- Modify: `src/server/templates/seed.test.ts`

- [ ] **Step 1: Add failing catalog and rule tests**

```ts
const templateById = (templateId: string) =>
  mvpShotTemplates.find((template) => template.templateId === templateId);

expect(templateById("product_quarter_rotation")).toMatchObject({
  status: "beta",
  riskLevel: "medium_high",
  subjectKind: "product",
  requiredAssets: ["product_front", "product_side"],
  consistencyRequirements: ["same_garment"],
  isTrialAllowed: false,
  requiresStrictReview: true,
  autoSelectAllowed: false,
});

expect(templateById("product_half_rotation")).toMatchObject({
  status: "beta",
  riskLevel: "high",
  subjectKind: "product",
  requiredAssets: ["product_front", "product_side", "product_back"],
  consistencyRequirements: ["same_garment"],
  isTrialAllowed: false,
  requiresStrictReview: true,
  autoSelectAllowed: false,
});
```

Add these rule assertions with the existing completeness fixture:

```ts
const base = {
  ...frontOnlyCompleteness,
  hasProductFront: true,
  hasProductSide: false,
  hasProductBack: false,
  garmentConsistency: "unknown" as const,
};
const result = recommendShotTemplates({
  templates: mvpShotTemplates,
  assetCompleteness: base,
  isTrial: false,
});
expect(result.unavailable).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      templateId: "product_quarter_rotation",
      reasons: expect.arrayContaining([
        "product_side_asset_required",
        "matching_product_views_required",
      ]),
    }),
    expect.objectContaining({
      templateId: "product_half_rotation",
      reasons: expect.arrayContaining(["product_back_asset_required"]),
    }),
  ]),
);
```

- [ ] **Step 2: Run and verify failures**

```powershell
pnpm exec vitest run src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/lib/presets/recommend.test.ts src/server/templates/seed.test.ts
```

- [ ] **Step 3: Extend template types**

```ts
export type TemplateSubjectKind = "any" | "product" | "human_model";
export type ConsistencyRequirement = "same_garment" | "same_model";

export type RequiredAssetKind =
  | "front"
  | "back"
  | "side"
  | "detail"
  | "scene"
  | "model_front"
  | "flat_lay_or_white_background"
  | "product_front"
  | "product_side"
  | "product_back"
  | "model_side"
  | "model_back";
```

Add these fields to `ShotTemplateDefinition` and persist all three in `seed.ts`:

```ts
subjectKind: TemplateSubjectKind;
consistencyRequirements: ConsistencyRequirement[];
autoSelectAllowed: boolean;
```

Set `subjectKind: "any"`, `consistencyRequirements: []`, and `autoSelectAllowed: true` explicitly on the 13 existing templates so catalog snapshots remain deterministic.

- [ ] **Step 4: Add product completeness and unavailable reasons**

Extend `AssetCompleteness` with:

```ts
hasProductFront: boolean;
hasProductSide: boolean;
hasProductBack: boolean;
garmentConsistency: "pass" | "fail" | "unknown";
```

Add exact reasons:

```ts
"product_front_asset_required"
"product_side_asset_required"
"product_back_asset_required"
"matching_product_views_required"
"product_only_template"
```

Expose `autoSelectAllowed` on `AvailableTemplateRecommendation`. Keep templates with `autoSelectAllowed: false` in `availableTemplateIds` and the Advanced picker, but filter them out inside `rankTemplateIdsForPreset` / `selectTemplateIdsForPreset`. Add a test proving a selectable `product_quarter_rotation` is absent from automatic Preset slots while remaining in `recommendations.availableTemplateIds`.

- [ ] **Step 5: Add both catalog entries**

The quarter rotation constraints must include:

```ts
systemConstraints: [
  "Do not create a person, hand, body, or model.",
  "Use only the uploaded product front and side views.",
  "Rotate no farther than the supported side reference, between 15 and 45 degrees.",
  "Do not invent unseen garment construction.",
]
```

Set `autoSelectAllowed: false` on both new templates. The half rotation must additionally require the back reference and state `Do not continue into a 360-degree rotation.`

- [ ] **Step 6: Run and commit**

```powershell
pnpm exec vitest run src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/lib/presets/recommend.test.ts src/server/templates/seed.test.ts
pnpm run typecheck
git add src/lib/templates src/lib/presets/recommend.ts src/lib/presets/recommend.test.ts src/server/templates/seed.ts src/server/templates/seed.test.ts
git commit -m "feat: add product rotation templates"
```

### Task 6: Run Consistency During Job Analysis

**Files:**
- Modify: `src/server/assets/classify-role.ts`
- Modify: `src/server/assets/classify-role.test.ts`
- Modify: `src/server/assets/job-analysis.ts`
- Modify: `src/server/assets/job-analysis.test.ts`
- Modify: `src/server/assets/analyze.ts`
- Modify: `src/server/assets/analyze.test.ts`

- [ ] **Step 1: Add failing completeness tests**

```ts
const productConsistencyPass = {
  garmentMatch: "pass" as const,
  modelMatch: "not_applicable" as const,
};

expect(
  buildAssetCompletenessFromAnalyses([
    analysis({ assetRole: "front", subjectKind: "product" }),
    analysis({ assetRole: "side", subjectKind: "product" }),
    analysis({ assetRole: "back", subjectKind: "product" }),
  ], [], productConsistencyPass),
).toMatchObject({
  hasProductFront: true,
  hasProductSide: true,
  hasProductBack: true,
  garmentConsistency: "pass",
});
```

- [ ] **Step 2: Add a failing job-analysis integration test**

Use three product job assets, capture provider input in `seenConsistencyInputs`, and assert:

```ts
expect(seenConsistencyInputs[0]?.declaredRoles).toEqual([
  "front",
  "side",
  "back",
]);
expect(seenConsistencyInputs[0]?.imageUrls).toEqual([
  "https://signed.example/front.jpg",
  "https://signed.example/side.jpg",
  "https://signed.example/back.jpg",
]);
expect(result.recommendations.availableTemplateIds).toContain(
  "product_half_rotation",
);
```

- [ ] **Step 3: Run and verify failures**

```powershell
pnpm exec vitest run src/server/assets/classify-role.test.ts src/server/assets/job-analysis.test.ts src/server/assets/analyze.test.ts
```

- [ ] **Step 4: Integrate consistency analysis without persisting signed URLs**

Add `assetConsistencyStore = createDrizzleAssetConsistencyStore()` and optional `consistencyProvider?: VisionConsistencyProvider` to `analyzeVideoJobAssets`. While the existing per-image loop already has the signed URL, build an in-memory-only candidate array:

```ts
const consistencyCandidates: Array<{
  assetId: string;
  role: AssetRole;
  subjectKind: AssetSubjectKind;
  imageUrl: string;
}> = [];

// Inside the existing per-image loop, after analyzeAssetWithVisionProvider:
consistencyCandidates.push({
  assetId: asset.assetId,
  role: result.analysis.assetRole,
  subjectKind: result.analysis.subjectKind,
  imageUrl: signedUrl,
});

const productViews = consistencyCandidates
  .filter((record) => record.subjectKind === "product")
  .filter((record) => ["front", "side", "back"].includes(record.role));
const roleOrder = new Map([["front", 0], ["side", 1], ["back", 2]]);
const orderedProductViews = [...productViews].sort(
  (left, right) =>
    (roleOrder.get(left.role) ?? 99) -
    (roleOrder.get(right.role) ?? 99),
);

const productConsistency =
  productViews.length >= 2
    ? await runAssetConsistencyAnalysis({
        store: assetConsistencyStore,
        providerCallLogStore,
        videoJobId: jobId,
        analysisKind: "product_views",
        expectedSubjectKind: "product",
        assets: orderedProductViews,
        analyzeConsistency: consistencyProvider,
      })
    : null;
```

Extend `buildRecommendationsFromAnalyses` with `consistency?: ParsedConsistency | null`, pass `productConsistency`, and map `null` to `garmentConsistency: "unknown"`. Do not fail the whole asset-analysis job when consistency is unknown; instead keep rotation templates unavailable with a specific reason. Never put `imageUrl` into the returned result, database snapshot, provider request log, or event snapshot.

- [ ] **Step 5: Run and commit**

```powershell
pnpm exec vitest run src/server/assets/classify-role.test.ts src/server/assets/job-analysis.test.ts src/server/assets/analyze.test.ts src/server/jobs/get-job.test.ts
pnpm run typecheck
git add src/server/assets
git commit -m "feat: gate product rotation on matching views"
```

### Task 7: Select Verified Product Assets in Deterministic Order

**Files:**
- Modify: `src/server/storyboard/confirm.ts`
- Modify: `src/server/storyboard/confirm.test.ts`
- Modify: `src/server/video/prompt-compiler.ts`
- Modify: `src/server/video/prompt-compiler.test.ts`
- Modify: `src/server/storyboard/global-constraints.ts`
- Modify: `src/server/storyboard/global-constraints.test.ts`

- [ ] **Step 1: Add failing snapshot-order tests**

For `product_half_rotation`, provide assets in back/front/side upload order and assert the saved segment snapshot is:

```ts
expect(segment.inputAssetSnapshot.assets).toEqual([
  expect.objectContaining({ assetId: "front-product", role: "front", subjectKind: "product" }),
  expect.objectContaining({ assetId: "side-product", role: "side", subjectKind: "product" }),
  expect.objectContaining({ assetId: "back-product", role: "back", subjectKind: "product" }),
]);
expect(storyboardStore.listJobs()[0]).toMatchObject({
  postQaMode: "strict",
  postQaReason: "template_requires_strict_review",
});
```

- [ ] **Step 2: Add a failing prompt-compiler test**

Assert the compiled prompt includes:

```text
Image 1 is a front product-only garment reference.
Image 2 is a side product-only garment reference.
Image 3 is a back product-only garment reference.
Do not create a person, hand, body, or model.
Do not continue into a 360-degree rotation.
```

- [ ] **Step 3: Run and verify failures**

```powershell
pnpm exec vitest run src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/server/storyboard/global-constraints.test.ts
```

- [ ] **Step 4: Join subject kind, order references, and upgrade QA mode**

Extend the confirmation asset record with `subjectKind`. Filter `product_*` requirements to product analyses only, and map required assets in their declared order rather than filtering the upload array.

The snapshot must include `subjectKind` and the task-level consistency snapshot. The prompt compiler must derive product-only image labels and append the no-person constraint even for old storyboard rows missing the new final-prompt snapshot.

Add this method to `StoryboardConfirmationStore` and both implementations:

```ts
setPostQaMode(input: {
  jobId: string;
  mode: "strict";
  reason: "template_requires_strict_review";
}): Promise<void>;
```

Extend `StoryboardConfirmJobRecord` with:

```ts
postQaMode: "off" | "lite" | "standard" | "strict";
postQaReason: string | null;
```

Select both fields in the Drizzle `findJob` implementation and add them to confirmation-test job fixtures. After parsing the storyboard and before reserving credits or creating segments, resolve every selected template from `mvpShotTemplates` and fail if any snapshot is missing. If at least one has `requiresStrictReview === true` and the job is not already Strict, call `setPostQaMode`. The Drizzle update sets both `videoJobs.postQaMode = "strict"` and `videoJobs.postQaReason = "template_requires_strict_review"`; it must never downgrade an existing Strict job. This is a server-side confirmation rule, not a UI hint.

- [ ] **Step 5: Run and commit**

```powershell
pnpm exec vitest run src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/server/storyboard/global-constraints.test.ts src/server/video/segments.test.ts src/lib/providers/apimart/video.test.ts
pnpm run typecheck
git add src/server/storyboard src/server/video/prompt-compiler.ts src/server/video/prompt-compiler.test.ts
git commit -m "feat: compile verified product rotation prompts"
```

### Task 8: Expose Product Rotation Eligibility in the UI and Admin

**Files:**
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`
- Modify: `src/components/workspace/template-picker.tsx`
- Modify: `src/components/workspace/template-picker.test.tsx`
- Modify: `src/components/admin/job-detail-panel.tsx`
- Modify: `src/components/admin/job-detail-panel.test.tsx`

- [ ] **Step 1: Add failing UI tests**

Assert:

```ts
expect(screen.getByText("商品轻旋转 15-45°")).toBeInTheDocument();
expect(screen.getByText("缺少商品侧面图")).toBeInTheDocument();
expect(screen.getByText("多角度商品图不是同一件服装")).toBeInTheDocument();
expect(screen.getByText("需要严格质检")).toBeInTheDocument();
```

The admin detail test must display `garment_match`, confidence, and risk flags without exposing signed URLs.

- [ ] **Step 2: Run focused UI tests**

```powershell
pnpm exec vitest run src/components/workspace/template-picker.test.tsx src/components/workspace/workspace-app.test.tsx src/components/admin/job-detail-panel.test.tsx
```

- [ ] **Step 3: Add exact reason labels and consistency summary**

Map the new reason codes to the Chinese messages asserted above. Keep both templates in Advanced controls while their catalog status is Beta; do not place them in automatic Preset preferences.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/components/workspace/template-picker.test.tsx src/components/workspace/workspace-app.test.tsx src/components/admin/job-detail-panel.test.tsx
pnpm run typecheck
git add src/components/workspace src/components/admin/job-detail-panel.tsx src/components/admin/job-detail-panel.test.tsx
git commit -m "feat: explain product rotation eligibility"
```

### Task 9: Synchronize Template Documentation and Verify

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/STYLE_PRESET_DESIGN.md`

- [ ] **Step 1: Document the two product templates and explicit no-person boundary**

State that product-only rotation requires matching views, remains paid Beta, forces Strict QA, and does not perform virtual try-on. Update the current catalog count from 13 to 15 at this phase.

- [ ] **Step 2: Run focused and full verification**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts src/server/assets/job-analysis.test.ts src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/lib/providers/apimart/video.test.ts
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: PASS.

- [ ] **Step 3: Run one real product rotation Beta task**

Use a same-SKU front/side/back test set. Confirm Strict QA, ordered `img_references`, no generated person, final R2 delivery, and admin-visible consistency snapshot.

- [ ] **Step 4: Commit documentation and any isolated verification corrections**

```powershell
git add docs/PRD.md docs/TECHNICAL_ARCHITECTURE.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md docs/STYLE_PRESET_DESIGN.md
git commit -m "docs: define product rotation beta"
git diff --check
git status --short
```
