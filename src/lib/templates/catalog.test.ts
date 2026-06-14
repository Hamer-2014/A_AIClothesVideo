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
];

describe("MVP shot template catalog", () => {
  it("defines the 13 MVP templates exactly once", () => {
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
});
