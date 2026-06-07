import { createHash } from "node:crypto";

export const promptModerationSources = [
  "user_input",
  "storyboard_prompt",
  "final_video_prompt",
] as const;

export type PromptModerationSource = (typeof promptModerationSources)[number];

export function createPromptHash(prompt: string) {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export function createPromptSummary(prompt: string, maxLength = 160) {
  const normalized = prompt.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
}
