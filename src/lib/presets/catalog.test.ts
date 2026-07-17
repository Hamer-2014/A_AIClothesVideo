import { describe, expect, it } from "vitest";

import { defaultStylePresetId, stylePresets } from "./catalog";

describe("style preset catalog", () => {
  it("contains the three MVP presets and a valid default", () => {
    expect(stylePresets.map((preset) => preset.id)).toEqual([
      "minimal_studio",
      "marketplace_clean",
      "social_lifestyle",
    ]);
    expect(stylePresets.some((preset) => preset.id === defaultStylePresetId)).toBe(true);
  });

  it("keeps preset template preferences non-empty and trial-safe defaults explicit", () => {
    for (const preset of stylePresets) {
      expect(preset.label).toBeTruthy();
      expect(preset.defaultIntent).toBeTruthy();
      expect(preset.promptStyleHint).toBeTruthy();
      expect(preset.preferredTemplateIds.length).toBeGreaterThan(0);
      expect(preset.allowedDurationSeconds).toContain(preset.defaultDurationSeconds);
      expect(["9:16", "1:1", "16:9"]).toContain(preset.defaultAspectRatio);
    }

    expect(stylePresets.find((preset) => preset.id === "minimal_studio")).toMatchObject({
      trialAllowed: true,
      defaultDurationSeconds: 8,
      defaultAspectRatio: "9:16",
    });
  });

  it("allows paid 40-second use for every preset", () => {
    for (const preset of stylePresets) {
      expect(preset.allowedDurationSeconds).toContain(40);
    }
  });
});
