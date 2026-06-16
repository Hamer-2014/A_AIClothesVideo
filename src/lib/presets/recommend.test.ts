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
    ).toEqual(["product_float", "front_pan"]);
  });
});
