import { describe, expect, it } from "vitest";

import { parseStoryboardJson } from "./schema";

describe("storyboard schema", () => {
  it("accepts an 8 second storyboard with one allowed template", () => {
    const result = parseStoryboardJson(
      {
        duration_seconds: 8,
        segments: [
          {
            index: 0,
            duration_seconds: 8,
            template_id: "front_push_in",
            prompt: "Slow front push-in.",
          },
        ],
      },
      {
        durationSeconds: 8,
        allowedTemplateIds: ["front_push_in"],
      },
    );

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]?.templateId).toBe("front_push_in");
  });

  it("rejects invented template ids", () => {
    expect(() =>
      parseStoryboardJson(
        {
          duration_seconds: 8,
          segments: [
            {
              index: 0,
              duration_seconds: 8,
              template_id: "imaginary_360_spin",
              prompt: "Spin around.",
            },
          ],
        },
        {
          durationSeconds: 8,
          allowedTemplateIds: ["front_push_in"],
        },
      ),
    ).toThrow("Storyboard contains unavailable template: imaginary_360_spin.");
  });

  it("rejects segment counts that do not match duration", () => {
    expect(() =>
      parseStoryboardJson(
        {
          duration_seconds: 16,
          segments: [
            {
              index: 0,
              duration_seconds: 8,
              template_id: "front_push_in",
              prompt: "Slow front push-in.",
            },
          ],
        },
        {
          durationSeconds: 16,
          allowedTemplateIds: ["front_push_in"],
        },
      ),
    ).toThrow("Storyboard segment count does not match duration.");
  });
});
