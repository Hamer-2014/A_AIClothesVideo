import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "./catalog";
import { recommendShotTemplates } from "./recommend";
import type { ShotTemplateDefinition } from "./types";

const noProductCompleteness = {
  hasProductFront: false,
  hasProductSide: false,
  hasProductBack: false,
  garmentConsistency: "unknown" as const,
  hasModelSide: false,
  hasModelBack: false,
  modelGarmentConsistency: "unknown" as const,
  modelConsistency: "unknown" as const,
};

describe("shot template recommendation rules", () => {
  it("blocks product rotations until all required matching views exist", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: false,
        hasDetail: false,
        hasScene: false,
        hasModelFront: false,
        hasModelSide: false,
        hasModelBack: false,
        hasFlatLayOrWhiteBackground: true,
        hasProductFront: true,
        hasProductSide: false,
        hasProductBack: false,
        garmentConsistency: "unknown",
        modelGarmentConsistency: "unknown",
        modelConsistency: "unknown",
        detailTypes: [],
      },
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
          reasons: expect.arrayContaining([
            "product_back_asset_required",
            "matching_product_views_required",
          ]),
        }),
      ]),
    );
  });

  it("distinguishes a failed product match from an unavailable check", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        hasFront: true,
        hasBack: false,
        hasSide: true,
        hasDetail: false,
        hasScene: false,
        hasModelFront: false,
        hasModelSide: false,
        hasModelBack: false,
        hasFlatLayOrWhiteBackground: true,
        hasProductFront: true,
        hasProductSide: true,
        hasProductBack: false,
        garmentConsistency: "fail",
        modelGarmentConsistency: "unknown",
        modelConsistency: "unknown",
        detailTypes: [],
      },
      isTrial: false,
    });

    expect(result.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "product_quarter_rotation",
          reasons: expect.arrayContaining([
            "product_view_consistency_failed",
          ]),
        }),
      ]),
    );
  });

  it.each(["unknown", "fail"] as const)(
    "blocks same-model templates when model consistency is %s",
    (modelConsistency) => {
      const modelTemplate: ShotTemplateDefinition = {
        ...mvpShotTemplates[0],
        templateId: "test_model_turn",
        subjectKind: "human_model" as const,
        requiredAssets: ["model_front", "model_side"],
        consistencyRequirements: ["same_garment", "same_model"],
        isTrialAllowed: false,
      };
      const result = recommendShotTemplates({
        templates: [modelTemplate],
        assetCompleteness: {
          hasFront: true,
          hasBack: false,
          hasSide: true,
          hasDetail: false,
          hasScene: false,
          hasModelFront: true,
          hasModelSide: true,
          hasModelBack: false,
          hasFlatLayOrWhiteBackground: false,
          hasProductFront: false,
          hasProductSide: false,
          hasProductBack: false,
          garmentConsistency: "pass",
          modelGarmentConsistency: "pass",
          modelConsistency,
          detailTypes: [],
        },
        isTrial: false,
      });

      expect(result.unavailable[0]).toMatchObject({
        templateId: "test_model_turn",
        reasons: expect.arrayContaining(["matching_model_views_required"]),
      });
    },
  );

  it("gates human turns by model views, both consistencies, and billing mode", () => {
    const base = {
      hasFront: true,
      hasBack: false,
      hasSide: false,
      hasDetail: false,
      hasScene: false,
      hasModelFront: true,
      hasModelSide: false,
      hasModelBack: false,
      hasFlatLayOrWhiteBackground: false,
      hasProductFront: false,
      hasProductSide: false,
      hasProductBack: false,
      garmentConsistency: "unknown" as const,
      modelGarmentConsistency: "unknown" as const,
      modelConsistency: "unknown" as const,
      detailTypes: [],
    };
    const frontOnly = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: base,
      isTrial: false,
    });
    expect(frontOnly.availableTemplateIds).toContain("model_front_pose");
    expect(frontOnly.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "model_quarter_turn",
          reasons: expect.arrayContaining([
            "model_side_asset_required",
            "matching_model_views_required",
          ]),
        }),
      ]),
    );

    const sidePass = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...base,
        hasSide: true,
        hasModelSide: true,
        modelGarmentConsistency: "pass",
        modelConsistency: "pass",
      },
      isTrial: false,
    });
    expect(sidePass.availableTemplateIds).toContain("model_quarter_turn");
    expect(sidePass.availableTemplateIds).not.toContain("model_half_turn");

    const fullPass = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...base,
        hasBack: true,
        hasSide: true,
        hasModelSide: true,
        hasModelBack: true,
        modelGarmentConsistency: "pass",
        modelConsistency: "pass",
      },
      isTrial: false,
    });
    expect(fullPass.availableTemplateIds).toContain("model_half_turn");

    const mismatch = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...base,
        hasSide: true,
        hasModelSide: true,
        modelGarmentConsistency: "pass",
        modelConsistency: "fail",
      },
      isTrial: false,
    });
    expect(mismatch.availableTemplateIds).not.toContain("model_quarter_turn");
    expect(mismatch.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "model_quarter_turn",
          reasons: expect.arrayContaining(["model_view_consistency_failed"]),
        }),
      ]),
    );

    const garmentMismatch = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...base,
        hasSide: true,
        hasModelSide: true,
        modelGarmentConsistency: "fail",
        modelConsistency: "pass",
      },
      isTrial: false,
    });
    expect(garmentMismatch.unavailable).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          templateId: "model_quarter_turn",
          reasons: expect.arrayContaining([
            "matching_model_garment_views_required",
            "model_garment_consistency_failed",
          ]),
        }),
      ]),
    );

    const trial = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...base,
        hasSide: true,
        hasModelSide: true,
        modelGarmentConsistency: "pass",
        modelConsistency: "pass",
      },
      isTrial: true,
    });
    expect(trial.availableTemplateIds).not.toContain("model_quarter_turn");
  });


  it("does not recommend back view templates when only front assets exist", () => {
    const result = recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: {
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
        ...noProductCompleteness,
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
