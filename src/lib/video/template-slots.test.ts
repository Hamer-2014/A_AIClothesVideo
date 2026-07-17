import { describe, expect, it } from "vitest";

import { validateTemplateSlots } from "./template-slots";

describe("validateTemplateSlots", () => {
  it("accepts five slots with at least three templates and no adjacent duplicate", () => {
    expect(
      validateTemplateSlots({
        durationSeconds: 40,
        templateIds: [
          "front_push_in",
          "front_pan",
          "front_crop_detail",
          "front_push_in",
          "front_pan",
        ],
        highRiskTemplateIds: [],
      }),
    ).toEqual([]);
  });

  it("rejects invalid repeat and high-risk composition", () => {
    const reasons = validateTemplateSlots({
      durationSeconds: 40,
      templateIds: [
        "front_push_in",
        "front_push_in",
        "front_pan",
        "front_to_back_cut",
        "front_to_back_cut",
      ],
      highRiskTemplateIds: ["front_to_back_cut"],
    });

    expect(reasons).toEqual(
      expect.arrayContaining([
        "adjacent_duplicate_template",
        "too_many_high_risk_templates",
      ]),
    );
  });

  it("rejects too few distinct templates and a template repeated over twice", () => {
    expect(
      validateTemplateSlots({
        durationSeconds: 40,
        templateIds: ["front_pan", "front_push_in", "front_pan", "front_push_in", "front_pan"],
        highRiskTemplateIds: [],
      }),
    ).toEqual(
      expect.arrayContaining([
        "too_few_distinct_templates",
        "template_repeated_too_often",
      ]),
    );
  });

  it("does not apply 40-second composition rules to existing durations", () => {
    expect(
      validateTemplateSlots({
        durationSeconds: 24,
        templateIds: [
          "front_to_back_cut",
          "product_float",
          "front_to_back_cut",
        ],
        highRiskTemplateIds: ["front_to_back_cut"],
      }),
    ).toEqual([]);
  });
});
