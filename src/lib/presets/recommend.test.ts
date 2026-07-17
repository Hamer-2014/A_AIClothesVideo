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
  hasModelSide: false,
  hasModelBack: false,
  hasFlatLayOrWhiteBackground: true,
  hasProductFront: false,
  hasProductSide: false,
  hasProductBack: false,
  garmentConsistency: "unknown" as const,
  modelGarmentConsistency: "unknown" as const,
  modelConsistency: "unknown" as const,
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
    ).toEqual(["product_float", "front_pan"]);
  });

  it("builds five valid 40-second slots with controlled repeats", () => {
    const base = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...frontOnlyCompleteness,
        hasDetail: true,
        detailTypes: ["fabric", "neckline", "cuff", "print"],
      },
      isTrial: false,
    });
    const slots = selectTemplateIdsForPreset({
      recommendations: base,
      preset: getStylePreset("minimal_studio"),
      durationSeconds: 40,
    });

    expect(slots).toHaveLength(5);
    expect(new Set(slots).size).toBeGreaterThanOrEqual(3);
    expect(
      slots.some((templateId, index) =>
        index > 0 && templateId === slots[index - 1]
      ),
    ).toBe(false);
    expect(
      Math.max(
        ...[...new Set(slots)].map(
          (templateId) => slots.filter((id) => id === templateId).length,
        ),
      ),
    ).toBeLessThanOrEqual(2);
  });

  it("keeps advanced product rotations selectable but out of preset slots", () => {
    const base = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...frontOnlyCompleteness,
        hasProductFront: true,
        hasProductSide: true,
        garmentConsistency: "pass",
      },
      isTrial: false,
    });

    expect(base.availableTemplateIds).toContain("product_quarter_rotation");
    expect(
      selectTemplateIdsForPreset({
        recommendations: base,
        preset: getStylePreset("marketplace_clean"),
        durationSeconds: 24,
      }),
    ).not.toContain("product_quarter_rotation");
  });

  it("keeps verified model turns selectable but out of preset slots", () => {
    const base = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...frontOnlyCompleteness,
        hasSide: true,
        hasModelFront: true,
        hasModelSide: true,
        modelGarmentConsistency: "pass",
        modelConsistency: "pass",
      },
      isTrial: false,
    });

    expect(base.availableTemplateIds).toContain("model_quarter_turn");
    expect(
      selectTemplateIdsForPreset({
        recommendations: base,
        preset: getStylePreset("social_lifestyle"),
        durationSeconds: 24,
      }),
    ).not.toContain("model_quarter_turn");
  });
});
