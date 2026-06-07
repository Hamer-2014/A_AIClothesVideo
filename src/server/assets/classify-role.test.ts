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
      hasFlatLayOrWhiteBackground: true,
      detailTypes: ["fabric", "neckline"],
    });
  });

  it("detects model front assets from human presence and front role", () => {
    const completeness = buildAssetCompletenessFromAnalyses([
      analysis({ assetRole: "front", humanPresent: "yes" }),
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
