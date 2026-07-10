# Human Model Turn Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users who upload real model-worn garment photos to generate natural 15-45 degree side turns and verified 180 degree turns without inventing unsupported garment views.

**Architecture:** Reuse the persisted multi-view consistency service from product rotation, but require both garment and task-local model consistency. Extend asset capabilities to distinguish model front/side/back views, then feed only verified model-worn references to two separate paid Beta, Advanced-only templates. Existing front-only model photos continue to use low-motion front-facing templates.

**Tech Stack:** TypeScript, Vitest, Drizzle/Neon, OpenAI-compatible vision APIs, DeepSeek, APIMart PixVerse V6, React 19.

---

## Execution Preconditions

- Complete `2026-07-10-product-rotation-templates.md` first.
- Do not add virtual try-on, generated model images, face embeddings, or cross-task biometric identity. This plan only compares images inside one video job.
- Preserve the current `model_front_pose` behavior for a single front-facing model photo.

## File Map

- Modify `src/lib/templates/types.ts`, `rules.ts`, `catalog.ts` and tests: model-side/back capabilities and two new templates.
- Modify `src/server/assets/classify-role.ts` and tests: model front/side/back completeness.
- Modify `src/server/assets/consistency.ts` and tests: require `model_match=pass` for human-model analysis.
- Modify `src/server/assets/job-analysis.ts` and tests: run model-view consistency.
- Modify `src/server/storyboard/confirm.ts` and tests: select only verified model-worn assets in front/side/back order.
- Modify `src/server/storyboard/global-constraints.ts`, `src/server/video/prompt-compiler.ts` and tests: preserve person, anatomy, garment, and bounded turn.
- Modify Post-QA instructions/tests: human anatomy and same-model continuity.
- Modify workspace/admin components and documentation.

### Task 1: Extend Model View Capabilities

**Files:**
- Modify: `src/lib/templates/rules.ts`
- Modify: `src/lib/templates/recommend.test.ts`
- Modify: `src/server/assets/classify-role.ts`
- Modify: `src/server/assets/classify-role.test.ts`

- [ ] **Step 1: Add failing completeness tests**

```ts
it("tracks model front, side, and back separately", () => {
  const modelConsistencyPass = {
    garmentMatch: "pass" as const,
    modelMatch: "pass" as const,
  };
  const completeness = buildAssetCompletenessFromAnalyses([
    analysis({ assetRole: "front", subjectKind: "human_model" }),
    analysis({ assetRole: "side", subjectKind: "human_model" }),
    analysis({ assetRole: "back", subjectKind: "human_model" }),
  ], [], modelConsistencyPass);

  expect(completeness).toMatchObject({
    hasModelFront: true,
    hasModelSide: true,
    hasModelBack: true,
    garmentConsistency: "pass",
    modelConsistency: "pass",
  });
});
```

Add recommendation tests proving `unknown` or `fail` model consistency disables every `same_model` template.

- [ ] **Step 2: Run and verify failures**

```powershell
pnpm exec vitest run src/server/assets/classify-role.test.ts src/lib/templates/recommend.test.ts
```

- [ ] **Step 3: Extend completeness and rule reasons**

Add:

```ts
hasModelSide: boolean;
hasModelBack: boolean;
modelConsistency: "pass" | "fail" | "unknown";
```

Derive model capabilities only when `subjectKind === "human_model"`. Add exact unavailable reasons:

```ts
"model_side_asset_required"
"model_back_asset_required"
"matching_model_views_required"
```

When `consistencyRequirements` contains `same_model`, require `modelConsistency === "pass"` in addition to garment consistency.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/server/assets/classify-role.test.ts src/lib/templates/recommend.test.ts
pnpm run typecheck
git add src/lib/templates/rules.ts src/lib/templates/recommend.test.ts src/server/assets/classify-role.ts src/server/assets/classify-role.test.ts
git commit -m "feat: track model-worn garment views"
```

### Task 2: Require Same-Garment and Same-Model Consistency

**Files:**
- Modify: `src/server/assets/consistency.ts`
- Modify: `src/server/assets/consistency.test.ts`
- Modify: `src/server/assets/job-analysis.ts`
- Modify: `src/server/assets/job-analysis.test.ts`

- [ ] **Step 1: Add failing model-consistency parser tests**

```ts
const validJson = {
  garment_match: "pass",
  model_match: "pass",
  color_match: true,
  pattern_match: true,
  view_coverage: ["front", "side", "back"],
  confidence: "0.93",
  risk_flags: [],
};

expect(
  parseConsistencyJson({
    ...validJson,
    garment_match: "pass",
    model_match: "pass",
  }, "human_model").status,
).toBe("passed");

expect(
  parseConsistencyJson({
    ...validJson,
    garment_match: "pass",
    model_match: "unknown",
  }, "human_model").status,
).toBe("unknown");
```

- [ ] **Step 2: Add a failing job-analysis integration test**

Provide human-model front/side/back analyses and assert:

```ts
expect(consistencyProviderInput).toMatchObject({
  expectedSubjectKind: "human_model",
  declaredRoles: ["front", "side", "back"],
});
expect(result.assetCompleteness.modelConsistency).toBe("pass");
expect(result.recommendations.availableTemplateIds).toContain("model_half_turn");
```

- [ ] **Step 3: Run and verify failures**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts src/server/assets/job-analysis.test.ts
```

- [ ] **Step 4: Implement model-view consistency**

For `expectedSubjectKind === "human_model"`, map status as follows:

```ts
const status =
  parsed.garmentMatch === "pass" && parsed.modelMatch === "pass"
    ? "passed"
    : parsed.garmentMatch === "fail" || parsed.modelMatch === "fail"
      ? "failed"
      : "unknown";
```

Run this analysis when at least two `human_model` front/side/back views exist. Use `analysisKind = "model_views"`; upsert separately from `product_views`.

- [ ] **Step 5: Run and commit**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts src/server/assets/job-analysis.test.ts src/server/assets/analyze.test.ts
pnpm run typecheck
git add src/server/assets/consistency.ts src/server/assets/consistency.test.ts src/server/assets/job-analysis.ts src/server/assets/job-analysis.test.ts
git commit -m "feat: verify model view consistency"
```

### Task 3: Add the Human Model Turn Templates

**Files:**
- Modify: `src/lib/templates/catalog.ts`
- Modify: `src/lib/templates/catalog.test.ts`
- Modify: `src/lib/templates/recommend.test.ts`
- Modify: `src/lib/presets/recommend.test.ts`
- Modify: `src/server/templates/seed.test.ts`

- [ ] **Step 1: Add failing catalog tests**

```ts
const templateById = (templateId: string) =>
  mvpShotTemplates.find((template) => template.templateId === templateId);

expect(templateById("model_quarter_turn")).toMatchObject({
  status: "beta",
  riskLevel: "medium_high",
  subjectKind: "human_model",
  requiredAssets: ["model_front", "model_side"],
  consistencyRequirements: ["same_garment", "same_model"],
  isTrialAllowed: false,
  requiresStrictReview: true,
  autoSelectAllowed: false,
});

expect(templateById("model_half_turn")).toMatchObject({
  status: "beta",
  riskLevel: "high",
  subjectKind: "human_model",
  requiredAssets: ["model_front", "model_side", "model_back"],
  consistencyRequirements: ["same_garment", "same_model"],
  isTrialAllowed: false,
  requiresStrictReview: true,
  autoSelectAllowed: false,
});
```

Add rule cases for front-only, front+side, full three-view, mismatched model, and trial mode. Add a Preset-selection assertion proving both templates remain in Advanced availability but never enter automatic slots while `autoSelectAllowed` is false.

- [ ] **Step 2: Run and verify failures**

```powershell
pnpm exec vitest run src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/lib/presets/recommend.test.ts src/server/templates/seed.test.ts
```

- [ ] **Step 3: Add `model_quarter_turn`**

Use these hard constraints and set `autoSelectAllowed: false`:

```ts
systemConstraints: [
  "Keep the same visible person throughout the shot.",
  "Keep human anatomy natural and preserve the original pose range.",
  "Keep garment color, silhouette, pattern, neckline, sleeves, and hem unchanged.",
  "Use only the uploaded model front and side views.",
  "Turn between 15 and 45 degrees and do not reveal an unsupported back view.",
]
```

- [ ] **Step 4: Add `model_half_turn`**

Use front/side/back references, set `autoSelectAllowed: false`, and add:

```ts
"End at the uploaded back view and do not continue into a 360-degree turn.",
"Do not swap the person's face, body shape, hair, or garment styling.",
"Avoid unnatural head, arm, hand, hip, or leg rotation.",
```

- [ ] **Step 5: Run and commit**

```powershell
pnpm exec vitest run src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/lib/presets/recommend.test.ts src/server/templates/seed.test.ts
pnpm run typecheck
git add src/lib/templates/catalog.ts src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/lib/presets/recommend.test.ts src/server/templates/seed.test.ts
git commit -m "feat: add human model turn templates"
```

### Task 4: Compile Ordered Human-Model References

**Files:**
- Modify: `src/server/storyboard/confirm.ts`
- Modify: `src/server/storyboard/confirm.test.ts`
- Modify: `src/server/video/prompt-compiler.ts`
- Modify: `src/server/video/prompt-compiler.test.ts`
- Modify: `src/server/storyboard/global-constraints.ts`
- Modify: `src/server/storyboard/global-constraints.test.ts`

- [ ] **Step 1: Add failing asset-order tests**

For `model_half_turn`, provide mixed product and model assets and assert only verified model assets are included:

```ts
expect(segment.inputAssetSnapshot.assets).toEqual([
  expect.objectContaining({ assetId: "model-front", role: "front", subjectKind: "human_model" }),
  expect.objectContaining({ assetId: "model-side", role: "side", subjectKind: "human_model" }),
  expect.objectContaining({ assetId: "model-back", role: "back", subjectKind: "human_model" }),
]);
expect(segment.inputAssetSnapshot.assets).not.toEqual(
  expect.arrayContaining([expect.objectContaining({ assetId: "flat-lay-front" })]),
);
expect(storyboardStore.listJobs()[0]).toMatchObject({
  postQaMode: "strict",
  postQaReason: "template_requires_strict_review",
});
```

- [ ] **Step 2: Add failing compiled-prompt tests**

Assert the prompt includes:

```text
Image 1 is a front human-model garment reference.
Image 2 is a side human-model garment reference.
Image 3 is a back human-model garment reference.
Keep the same visible person throughout the shot.
End at the uploaded back view and do not continue into a 360-degree turn.
```

- [ ] **Step 3: Run and verify failures**

```powershell
pnpm exec vitest run src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/server/storyboard/global-constraints.test.ts
```

- [ ] **Step 4: Filter and order human-model assets**

Map `model_front`, `model_side`, and `model_back` to matching view roles plus `subjectKind === "human_model"`. Preserve the consistency snapshot in `inputAssetSnapshot`. Reuse the generic confirmation rule from the product-rotation plan so either model-turn template upgrades the persisted job to Strict before stitching. Add task-global constraints based on available model views:

```ts
if (hasModelFront && !hasModelBack) {
  constraints.push("Do not show a model back view or complete a 180-degree turn.");
}
```

The existing `model_front_pose` remains available with one front model image and does not require cross-view consistency.

- [ ] **Step 5: Run and commit**

```powershell
pnpm exec vitest run src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/server/storyboard/global-constraints.test.ts src/server/video/segments.test.ts src/lib/providers/apimart/video.test.ts
pnpm run typecheck
git add src/server/storyboard src/server/video/prompt-compiler.ts src/server/video/prompt-compiler.test.ts
git commit -m "feat: compile verified model turn prompts"
```

### Task 5: Strengthen Post-QA for Human Turns

**Files:**
- Modify: `src/lib/providers/vision/client.ts`
- Modify: `src/lib/providers/vision/client.test.ts`
- Modify: `src/server/post-qa/check.ts`
- Modify: `src/server/post-qa/check.test.ts`

- [ ] **Step 1: Add failing QA instruction and result tests**

Assert the Strict QA request includes checks for:

```text
same visible person across relevant frames
natural head, arm, hand, hip, and leg anatomy
garment front/side/back consistency
turn stops at the supported angle and never completes 360 degrees
```

Add a failed result localized to a named segment frame and assert the stored failure snapshot includes that segment index.

- [ ] **Step 2: Run and verify failures**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts src/server/post-qa/check.test.ts
```

- [ ] **Step 3: Add model-turn QA requirements**

Append human-turn requirements only when the selected template snapshot contains `model_quarter_turn` or `model_half_turn`. Do not make ordinary front-facing model footage fail solely because a child model or person is present; preserve the existing content-safety nuance in the QA instruction.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/lib/providers/vision/client.test.ts src/server/post-qa/check.test.ts src/server/post-qa/resolve.test.ts
pnpm run typecheck
git add src/lib/providers/vision/client.ts src/lib/providers/vision/client.test.ts src/server/post-qa/check.ts src/server/post-qa/check.test.ts
git commit -m "feat: inspect human turn continuity"
```

### Task 6: Expose Natural Model Actions in Workspace and Admin

**Files:**
- Modify: `src/components/workspace/template-picker.tsx`
- Modify: `src/components/workspace/template-picker.test.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`
- Modify: `src/components/admin/job-detail-panel.tsx`
- Modify: `src/components/admin/job-detail-panel.test.tsx`

- [ ] **Step 1: Add failing UI tests**

For a front-only model asset, assert `model_front_pose` remains available and both turn templates explain missing views. For verified front/side/back model assets, assert:

```ts
expect(screen.getByText("模特轻侧身 15-45°")).toBeInTheDocument();
expect(screen.getByText("模特连续转身 180°")).toBeInTheDocument();
expect(screen.getAllByText("需要严格质检").length).toBeGreaterThan(0);
```

For `model_match=fail`, assert the user sees `多角度图片中的模特不一致` and cannot select the templates.

- [ ] **Step 2: Run and verify failures**

```powershell
pnpm exec vitest run src/components/workspace/template-picker.test.tsx src/components/workspace/workspace-app.test.tsx src/components/admin/job-detail-panel.test.tsx
```

- [ ] **Step 3: Add labels and preserve Advanced-only Beta placement**

Add Chinese reason labels for missing model side/back and model inconsistency. Keep both templates out of automatic Preset preferences until Beta metrics justify promotion. Admin detail must show task-local consistency results without biometric identifiers.

- [ ] **Step 4: Run and commit**

```powershell
pnpm exec vitest run src/components/workspace/template-picker.test.tsx src/components/workspace/workspace-app.test.tsx src/components/admin/job-detail-panel.test.tsx
pnpm run typecheck
git add src/components/workspace src/components/admin/job-detail-panel.tsx src/components/admin/job-detail-panel.test.tsx
git commit -m "feat: expose verified model turn actions"
```

### Task 7: Synchronize Documentation and Run End-to-End Verification

**Files:**
- Modify: `docs/PRD.md`
- Modify: `docs/TECHNICAL_ARCHITECTURE.md`
- Modify: `docs/IMPLEMENTATION_PLAN.md`
- Modify: `docs/DEVELOPMENT_SPEC.md`
- Modify: `docs/STYLE_PRESET_DESIGN.md`

- [ ] **Step 1: Update the template catalog and product boundary**

Document 17 current templates after adding four rotation/turn templates. State explicitly:

```text
Existing real model-worn images may use model motion templates.
Front-only model images may use front-facing natural pose templates but not unsupported turns.
Product-only images do not implicitly create a person.
Virtual try-on remains a future explicit upstream module whose outputs may reuse model templates after consistency checks.
```

- [ ] **Step 2: Run focused and full automated checks**

```powershell
pnpm exec vitest run src/server/assets/consistency.test.ts src/server/assets/job-analysis.test.ts src/lib/templates/catalog.test.ts src/lib/templates/recommend.test.ts src/server/storyboard/confirm.test.ts src/server/video/prompt-compiler.test.ts src/server/post-qa/check.test.ts src/components/workspace/template-picker.test.tsx
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

Expected: PASS.

- [ ] **Step 3: Run real Beta samples**

Run one same-model front/side sample for `model_quarter_turn` and one same-model front/side/back sample for `model_half_turn`. Confirm ordered references, Strict QA, no face/body swap, garment consistency, R2 delivery, and admin-visible consistency evidence.

- [ ] **Step 4: Verify negative samples**

Use different models, different garment colors, and missing back views. Confirm the turn templates are disabled before point reservation and show specific user-facing reasons.

- [ ] **Step 5: Commit documentation and inspect repository state**

```powershell
git add docs/PRD.md docs/TECHNICAL_ARCHITECTURE.md docs/IMPLEMENTATION_PLAN.md docs/DEVELOPMENT_SPEC.md docs/STYLE_PRESET_DESIGN.md
git commit -m "docs: define human model turn beta"
git diff --check
git status --short
```
