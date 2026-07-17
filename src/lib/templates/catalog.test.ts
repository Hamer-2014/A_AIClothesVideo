import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "./catalog";

const expectedIds = [
  "front_push_in",
  "front_pan",
  "product_float",
  "model_front_pose",
  "front_crop_detail",
  "fabric_macro",
  "neckline_closeup",
  "cuff_closeup",
  "print_closeup",
  "back_display",
  "front_to_back_cut",
  "scene_lifestyle_showcase",
  "minimal_studio",
  "product_quarter_rotation",
  "product_half_rotation",
  "model_quarter_turn",
  "model_half_turn",
];

describe("MVP shot template catalog", () => {
  it("defines the 17 MVP and paid Beta templates exactly once", () => {
    const ids = mvpShotTemplates.map((template) => template.templateId);

    expect(ids).toEqual(expectedIds);
    expect(new Set(ids).size).toBe(expectedIds.length);
  });

  it("defines all database-backed fields for every template", () => {
    for (const template of mvpShotTemplates) {
      expect(template.version).toBe(1);
      expect(["active", "beta"]).toContain(template.status);
      expect(template.displayName).not.toHaveLength(0);
      expect(template.requiredAssets.length).toBeGreaterThan(0);
      expect(template.allowedMotion.length).toBeGreaterThan(0);
      expect(template.basePromptIntent).not.toHaveLength(0);
      expect(template.systemConstraints.length).toBeGreaterThan(0);
      expect(template.postQaChecks.length).toBeGreaterThan(0);
    }
  });

  it("allows trials only for low-risk templates", () => {
    for (const template of mvpShotTemplates) {
      if (template.isTrialAllowed) {
        expect(template.riskLevel).toBe("low");
      }
    }

    expect(
      mvpShotTemplates.find((template) => template.templateId === "minimal_studio"),
    ).toMatchObject({
      riskLevel: "medium",
      isTrialAllowed: false,
    });
  });

  it("marks front_to_back_cut as medium high and strict review", () => {
    expect(
      mvpShotTemplates.find(
        (template) => template.templateId === "front_to_back_cut",
      ),
    ).toMatchObject({
      riskLevel: "medium_high",
      requiresStrictReview: true,
    });
  });

  it("defines a scene template that requires front and scene assets", () => {
    expect(
      mvpShotTemplates.find(
        (template) => template.templateId === "scene_lifestyle_showcase",
      ),
    ).toMatchObject({
      status: "active",
      riskLevel: "medium",
      requiredAssets: ["front", "scene"],
      isTrialAllowed: false,
      requiresStrictReview: false,
    });
  });

  it("defines paid-only product rotation templates with strict review", () => {
    const templateById = (templateId: string) =>
      mvpShotTemplates.find((template) => template.templateId === templateId);

    expect(templateById("product_quarter_rotation")).toMatchObject({
      status: "beta",
      riskLevel: "medium_high",
      subjectKind: "product",
      requiredAssets: ["product_front", "product_side"],
      consistencyRequirements: ["same_garment"],
      isTrialAllowed: false,
      requiresStrictReview: true,
      autoSelectAllowed: false,
    });
    expect(templateById("product_half_rotation")).toMatchObject({
      status: "beta",
      riskLevel: "high",
      subjectKind: "product",
      requiredAssets: ["product_front", "product_side", "product_back"],
      consistencyRequirements: ["same_garment"],
      isTrialAllowed: false,
      requiresStrictReview: true,
      autoSelectAllowed: false,
    });
  });

  it("defines paid-only human-model turn templates with strict review", () => {
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
  });
});
