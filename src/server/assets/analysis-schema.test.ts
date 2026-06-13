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

  it("normalizes common provider asset_role aliases into supported internal roles", () => {
    const result = parseAssetAnalysisJson({
      asset_role: "product_clothing_item",
      garment_category: "dress",
      view_angle: "front",
      human_present: "no (dress on a mannequin)",
      visible_details: ["front_shape"],
      not_visible_details: ["back"],
      quality: {
        is_garment: true,
        is_clear: true,
        is_safe: true,
        has_flat_lay_or_white_background: true,
      },
      confidence: "high",
      risk_flags: [],
    });

    expect(result.assetRole).toBe("front");
    expect(result.humanPresent).toBe("no");
  });

  it("normalizes provider asset_role prefixes instead of only exact alias strings", () => {
    const result = parseAssetAnalysisJson({
      asset_role: "product_clothing_item_on_model_torso",
      garment_category: "dress",
      view_angle: "front",
      human_present: "unknown",
      visible_details: ["front_shape"],
      not_visible_details: ["back"],
      quality: {
        is_garment: true,
        is_clear: true,
        is_safe: true,
        has_flat_lay_or_white_background: true,
      },
      confidence: "high",
      risk_flags: [],
    });

    expect(result.assetRole).toBe("front");
  });

  it("normalizes newly observed APIMart asset_role variants into front", () => {
    const variants = [
      "primary",
      "primary garment",
      "primary_product",
      "primary_clothing_item",
      "main_product",
      "clothing_product_photo",
      "clothing_item",
      "garment_on_mannequin",
      "product_photo",
      "front-facing product shot on mannequin",
    ];

    for (const assetRole of variants) {
      const result = parseAssetAnalysisJson({
        asset_role: assetRole,
        garment_category: "dress",
        view_angle: "front",
        human_present: "no (shown on a mannequin form)",
        visible_details: ["front_shape"],
        not_visible_details: ["back"],
        quality: {
          is_garment: true,
          is_clear: true,
          is_safe: true,
          has_flat_lay_or_white_background: true,
        },
        confidence: "high",
        risk_flags: [],
      });

      expect(result.assetRole).toBe("front");
      expect(result.humanPresent).toBe("no");
    }
  });

  it("normalizes no-garment provider asset_role variants into unknown instead of throwing", () => {
    const variants = [
      "none",
      "background/scene image (no clothing item visible)",
    ];

    for (const assetRole of variants) {
      const result = parseAssetAnalysisJson({
        asset_role: assetRole,
        garment_category: "unknown",
        view_angle: "N/A",
        human_present: "no",
        visible_details: ["No clothing item is visible in the image."],
        not_visible_details: ["garment material"],
        quality: {
          is_garment: false,
          is_clear: false,
          is_safe: true,
          has_flat_lay_or_white_background: false,
        },
        confidence: "low",
        risk_flags: ["No garment visible"],
      });

      expect(result.assetRole).toBe("unknown");
      expect(result.quality.isGarment).toBe(false);
    }
  });
});
