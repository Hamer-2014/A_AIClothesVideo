import { describe, expect, it } from "vitest";

import {
  createPromptHash,
  createPromptSummary,
  promptModerationSources,
} from "./prompt-sources";

describe("prompt moderation sources", () => {
  it("defines the sources required by the MVP flow", () => {
    expect(promptModerationSources).toEqual([
      "user_input",
      "storyboard_prompt",
      "final_video_prompt",
    ]);
  });

  it("creates a stable SHA-256 prompt hash", () => {
    expect(createPromptHash("same prompt")).toBe(createPromptHash("same prompt"));
    expect(createPromptHash("same prompt")).not.toBe(
      createPromptHash("different prompt"),
    );
    expect(createPromptHash("same prompt")).toHaveLength(64);
  });

  it("creates a compact summary without storing the full prompt", () => {
    const longPrompt = `${"red dress ".repeat(40)}with studio lighting`;
    const summary = createPromptSummary(longPrompt, 80);

    expect(summary.length).toBeLessThanOrEqual(80);
    expect(summary).not.toBe(longPrompt);
    expect(summary).toContain("red dress");
  });
});
