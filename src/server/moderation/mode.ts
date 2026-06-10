export type PromptModerationMode = "creem" | "dev_bypass" | "off";

export function getPromptModerationMode(
  env: Record<string, string | undefined> = process.env,
): PromptModerationMode {
  const mode = env.PROMPT_MODERATION_MODE?.trim().toLowerCase();

  if (mode === "dev_bypass" || mode === "off") {
    return mode;
  }

  return "creem";
}

export function canUseDevBypass(
  env: Record<string, string | undefined> = process.env,
) {
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnv === "development" || nodeEnv === "test";
}
