import { describe, expect, it } from "vitest";

import {
  assetFactsSnapshotFromAssets,
  buildGlobalHardConstraints,
  formatGlobalHardConstraintsForPrompt,
} from "./global-constraints";

describe("global hard constraints", () => {
  it("forbids back, turn-around, 360, and front-to-back when no back asset exists", () => {
    const constraints = buildGlobalHardConstraints({
      hasBackAsset: false,
      hasDetailAsset: true,
      hasSceneAsset: false,
    });

    expect(constraints).toContain(
      "Do not invent garment details not visible in the uploaded assets.",
    );
    expect(constraints).toContain(
      "Keep garment color, silhouette, visible pattern, and construction consistent with the garment reference images.",
    );
    expect(constraints.join(" ")).toMatch(/back/i);
    expect(constraints.join(" ")).toMatch(/turn-around/i);
    expect(constraints.join(" ")).toMatch(/360/i);
    expect(constraints.join(" ")).toMatch(/front-to-back/i);
  });

  it("forbids macro and detail close-up when no detail asset exists", () => {
    const constraints = buildGlobalHardConstraints({
      hasBackAsset: true,
      hasDetailAsset: false,
      hasSceneAsset: false,
    });

    expect(constraints.join(" ")).toMatch(/macro/i);
    expect(constraints.join(" ")).toMatch(/detail close-up/i);
  });

  it("limits scene images to background, lighting, and mood reference", () => {
    const constraints = buildGlobalHardConstraints({
      hasBackAsset: true,
      hasDetailAsset: true,
      hasSceneAsset: true,
    });

    expect(constraints).toContain(
      "Use scene images only as background, lighting, and mood reference.",
    );
    expect(constraints).toContain(
      "Do not copy people, faces, logos, storefront names, or readable text from scene images.",
    );
  });

  it("derives asset fact snapshot from asset roles", () => {
    expect(
      assetFactsSnapshotFromAssets([
        { role: "front" },
        { role: "BACK" },
        { role: "detail" },
        { role: "scene" },
      ]),
    ).toEqual({
      hasBack: true,
      hasDetail: true,
      hasScene: true,
      hasModelFront: false,
      hasModelBack: false,
    });
  });

  it("forbids unsupported model back views for a front-only model", () => {
    const facts = assetFactsSnapshotFromAssets([
      { role: "front", subjectKind: "human_model" },
    ]);
    const constraints = buildGlobalHardConstraints({
      hasBackAsset: facts.hasBack,
      hasDetailAsset: facts.hasDetail,
      hasSceneAsset: facts.hasScene,
      hasModelFront: facts.hasModelFront,
      hasModelBack: facts.hasModelBack,
    });

    expect(constraints).toContain(
      "Do not show a model back view or complete a 180-degree turn.",
    );
  });

  it("formats constraints as prompt bullet lines without empty items", () => {
    expect(formatGlobalHardConstraintsForPrompt(["Keep shape.", "", "  No macro.  "])).toEqual([
      "Keep shape.",
      "No macro.",
    ]);
  });
});
