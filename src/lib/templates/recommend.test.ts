import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "./catalog";
import { recommendShotTemplates } from "./recommend";

describe("shot template recommendation rules", () => {
  it("does not recommend back view templates when only front assets exist", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: false,
        hasDetail: false,
        hasScene: false,
        hasModelFront: false,
        hasFlatLayOrWhiteBackground: true,
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(result.availableTemplateIds).not.toContain("back_display");
    expect(result.availableTemplateIds).not.toContain("front_to_back_cut");
    expect(result.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "back_display",
          reasons: expect.arrayContaining(["back_asset_required"]),
        }),
        expect.objectContaining({
          templateId: "front_to_back_cut",
          reasons: expect.arrayContaining(["back_asset_required"]),
        }),
      ]),
    );
  });

  it("disables detail closeups when no detail assets exist", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: true,
        hasSide: false,
        hasDetail: false,
        hasScene: false,
        hasModelFront: true,
        hasFlatLayOrWhiteBackground: true,
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(result.unavailable.map((item) => item.templateId)).toEqual(
      expect.arrayContaining([
        "fabric_macro",
        "neckline_closeup",
        "cuff_closeup",
        "print_closeup",
      ]),
    );
  });

  it("only allows low-risk templates for trials", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: true,
        hasSide: true,
        hasDetail: true,
        hasScene: true,
        hasModelFront: true,
        hasFlatLayOrWhiteBackground: true,
        detailTypes: ["fabric", "neckline", "cuff", "print"],
      },
      isTrial: true,
    });

    expect(result.recommended.every((item) => item.riskLevel === "low")).toBe(true);
    expect(result.optional.every((item) => item.riskLevel === "low")).toBe(true);
    expect(result.availableTemplateIds).not.toContain("minimal_studio");
    expect(result.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "minimal_studio",
          reasons: expect.arrayContaining(["trial_requires_low_risk_template"]),
        }),
      ]),
    );
  });

  it("marks paused and draft templates unavailable", () => {
    const result = recommendShotTemplates({
      templates: [
        { ...mvpShotTemplates[0], status: "paused" },
        { ...mvpShotTemplates[1], status: "draft" },
      ],
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: false,
        hasDetail: false,
        hasScene: false,
        hasModelFront: false,
        hasFlatLayOrWhiteBackground: true,
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(result.availableTemplateIds).toEqual([]);
    expect(result.unavailable).toEqual([
      expect.objectContaining({
        templateId: "front_push_in",
        reasons: ["template_paused"],
      }),
      expect.objectContaining({
        templateId: "front_pan",
        reasons: ["template_draft"],
      }),
    ]);
  });

  it("emits risk warnings for medium high templates", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: true,
        hasSide: true,
        hasDetail: true,
        hasScene: true,
        hasModelFront: true,
        hasFlatLayOrWhiteBackground: true,
        detailTypes: ["fabric", "neckline", "cuff", "print"],
      },
      isTrial: false,
    });

    expect(
      [...result.recommended, ...result.optional].find(
        (item) => item.templateId === "front_to_back_cut",
      ),
    ).toMatchObject({
      riskLevel: "medium_high",
      riskWarnings: expect.arrayContaining(["strict_review_required"]),
    });
  });

  it("only makes the scene lifestyle template available when a scene asset exists", () => {
    const withoutScene = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: false,
        hasDetail: false,
        hasScene: false,
        hasModelFront: false,
        hasFlatLayOrWhiteBackground: false,
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(withoutScene.availableTemplateIds).not.toContain(
      "scene_lifestyle_showcase",
    );
    expect(withoutScene.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "scene_lifestyle_showcase",
          reasons: expect.arrayContaining(["scene_asset_required"]),
        }),
      ]),
    );

    const withScene = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: false,
        hasDetail: false,
        hasScene: true,
        hasModelFront: false,
        hasFlatLayOrWhiteBackground: false,
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(withScene.availableTemplateIds).toContain("scene_lifestyle_showcase");
    expect(withScene.optional).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "scene_lifestyle_showcase",
          riskLevel: "medium",
        }),
      ]),
    );
  });
});
