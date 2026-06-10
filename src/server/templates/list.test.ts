import { describe, expect, it } from "vitest";

import {
  createInMemoryTemplateListStore,
  listStoredTemplates,
} from "./list";

describe("template list", () => {
  it("returns persisted templates for admin pages", async () => {
    const templates = await listStoredTemplates({
      store: createInMemoryTemplateListStore([
        {
          templateId: "front_pan",
          version: 1,
          status: "paused",
          riskLevel: "low",
          displayName: "正面轻微平移",
          description: "desc",
          requiredAssets: ["front"],
          blockedConditions: [],
          allowedMotion: [],
          basePromptIntent: "intent",
          systemConstraints: [],
          postQaChecks: [],
          isTrialAllowed: true,
          requiresStrictReview: false,
        },
      ]),
    });

    expect(templates).toEqual([
      expect.objectContaining({
        templateId: "front_pan",
        status: "paused",
      }),
    ]);
  });
});
