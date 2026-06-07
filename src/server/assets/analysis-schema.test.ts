import { describe, expect, it } from "vitest";

import { parseAssetAnalysisJson } from "./analysis-schema";

describe("asset analysis schema", () => {
  it("parses the required vision output JSON fields", () => {
    const result = parseAssetAnalysisJson({
      asset_role: "front",
      garment_category: "dress",
      view_angle: "front",
      human_present: "no",
      visible_details: ["front_shape", "print"],
      not_visible_details: ["back", "cuff"],
      quality: {
        is_garment: true,
        is_clear: true,
        is_safe: true,
        has_flat_lay_or_white_background: true,
      },
      confidence: "high",
      risk_flags: [],
    });

    expect(result).toEqual({
      assetRole: "front",
      garmentCategory: "dress",
      viewAngle: "front",
      humanPresent: "no",
      visibleDetails: ["front_shape", "print"],
      notVisibleDetails: ["back", "cuff"],
      quality: {
        isGarment: true,
        isClear: true,
        isSafe: true,
        hasFlatLayOrWhiteBackground: true,
      },
      confidence: "high",
      riskFlags: [],
      raw: expect.any(Object),
    });
  });

  it("rejects missing or invalid required fields", () => {
    expect(() => parseAssetAnalysisJson({ asset_role: "front" })).toThrow(
      "Asset analysis JSON is missing required field: human_present.",
    );
    expect(() =>
      parseAssetAnalysisJson({
        asset_role: "not-a-role",
        garment_category: "dress",
        view_angle: "front",
        human_present: "no",
        visible_details: [],
        not_visible_details: [],
        quality: {},
        confidence: "high",
        risk_flags: [],
      }),
    ).toThrow("Asset analysis JSON has invalid asset_role.");
  });
});
