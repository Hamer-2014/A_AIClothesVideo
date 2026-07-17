import { describe, expect, it } from "vitest";

import {
  buildAssetCompletenessFromAnalyses,
  isAssetAnalysisAcceptable,
} from "./classify-role";
import type { ParsedAssetAnalysis } from "./analysis-schema";

function analysis(
  overrides: Partial<ParsedAssetAnalysis>,
): ParsedAssetAnalysis {
  return {
    assetRole: "front",
    garmentCategory: "dress",
    viewAngle: "front",
    humanPresent: "no",
    subjectKind: "product",
    visibleDetails: ["front_shape"],
    notVisibleDetails: [],
    quality: {
      isGarment: true,
      isClear: true,
      isSafe: true,
      hasFlatLayOrWhiteBackground: false,
    },
    confidence: "high",
    riskFlags: [],
    raw: {},
    ...overrides,
  };
}

describe("asset role classification", () => {
  it("converts parsed analyses into template asset completeness", () => {
    const completeness = buildAssetCompletenessFromAnalyses([
      analysis({
        assetRole: "front",
        quality: {
          isGarment: true,
          isClear: true,
          isSafe: true,
          hasFlatLayOrWhiteBackground: true,
        },
      }),
      analysis({ assetRole: "back", viewAngle: "back" }),
      analysis({ assetRole: "detail", visibleDetails: ["fabric", "neckline"] }),
      analysis({ assetRole: "scene" }),
    ]);

    expect(completeness).toEqual({
      hasFront: true,
      hasBack: true,
      hasSide: false,
      hasDetail: true,
      hasScene: true,
      hasModelFront: false,
      hasModelSide: false,
      hasModelBack: false,
      hasFlatLayOrWhiteBackground: true,
      hasProductFront: true,
      hasProductSide: false,
      hasProductBack: true,
      garmentConsistency: "unknown",
      modelGarmentConsistency: "unknown",
      modelConsistency: "unknown",
      detailTypes: ["fabric", "neckline"],
    });
  });

  it("exposes verified product views only when task consistency passes", () => {
    const completeness = buildAssetCompletenessFromAnalyses(
      [
        analysis({ assetRole: "front", subjectKind: "product" }),
        analysis({ assetRole: "side", subjectKind: "product" }),
        analysis({ assetRole: "back", subjectKind: "product" }),
      ],
      [],
      {
        garmentMatch: "pass",
        modelMatch: "not_applicable",
      },
    );

    expect(completeness).toMatchObject({
      hasProductFront: true,
      hasProductSide: true,
      hasProductBack: true,
      garmentConsistency: "pass",
    });
  });

  it("tracks model front, side, and back separately", () => {
    const completeness = buildAssetCompletenessFromAnalyses(
      [
        analysis({
          assetRole: "front",
          humanPresent: "yes",
          subjectKind: "human_model",
        }),
        analysis({
          assetRole: "side",
          humanPresent: "yes",
          subjectKind: "human_model",
        }),
        analysis({
          assetRole: "back",
          humanPresent: "yes",
          subjectKind: "human_model",
        }),
      ],
      [],
      { garmentMatch: "pass", modelMatch: "pass" },
    );

    expect(completeness).toMatchObject({
      hasModelFront: true,
      hasModelSide: true,
      hasModelBack: true,
      garmentConsistency: "pass",
      modelConsistency: "pass",
    });
  });

  it("does not treat a merely present person as a model-worn garment", () => {
    const completeness = buildAssetCompletenessFromAnalyses([
      analysis({
        assetRole: "front",
        humanPresent: "yes",
        subjectKind: "unknown",
      }),
    ]);

    expect(completeness.hasModelFront).toBe(false);
  });

  it("detects model front assets from explicit human-model subject kind", () => {
    const completeness = buildAssetCompletenessFromAnalyses([
      analysis({
        assetRole: "front",
        humanPresent: "yes",
        subjectKind: "human_model",
      }),
    ]);

    expect(completeness.hasModelFront).toBe(true);
  });

  it("rejects unsafe, non-garment, or unclear analyses", () => {
    expect(
      isAssetAnalysisAcceptable(
        analysis({ quality: { isGarment: false, isClear: true, isSafe: true } }),
      ),
    ).toBe(false);
    expect(
      isAssetAnalysisAcceptable(
        analysis({ quality: { isGarment: true, isClear: false, isSafe: true } }),
      ),
    ).toBe(false);
    expect(
      isAssetAnalysisAcceptable(
        analysis({ quality: { isGarment: true, isClear: true, isSafe: false } }),
      ),
    ).toBe(false);
  });
});
