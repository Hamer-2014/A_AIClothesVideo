import {
  createCreemPromptModeration,
  CreemModerationUnavailableError,
  type CreemPromptModerationResult,
} from "@/lib/providers/creem/moderation";

import {
  createPromptHash,
  createPromptSummary,
  type PromptModerationSource,
} from "./prompt-sources";
import {
  createDrizzleModerationResultStore,
  type ModerationResultStore,
} from "./results";

interface CheckPromptInput {
  userId: string;
  videoJobId?: string | null;
  segmentId?: string | null;
  source: PromptModerationSource;
  prompt: string;
  externalId?: string;
}

interface CheckPromptDeps {
  resultStore?: ModerationResultStore;
  moderatePrompt?: (input: {
    prompt: string;
    externalId?: string;
  }) => Promise<CreemPromptModerationResult>;
}

export interface CheckPromptResult {
  allowed: boolean;
  decision: "allow" | "flag" | "deny" | "error";
  moderationId: string | null;
  errorCode: string | null;
}

function errorCodeFor(error: unknown) {
  if (error instanceof CreemModerationUnavailableError) {
    return "creem_moderation_unavailable";
  }

  return "creem_moderation_error";
}

export async function checkPrompt(
  input: CheckPromptInput,
  deps: CheckPromptDeps = {},
): Promise<CheckPromptResult> {
  const startedAt = Date.now();
  const resultStore = deps.resultStore ?? createDrizzleModerationResultStore();
  const moderatePrompt = deps.moderatePrompt ?? createCreemPromptModeration;
  const promptHash = createPromptHash(input.prompt);
  const promptSummary = createPromptSummary(input.prompt, 80);

  try {
    const result = await moderatePrompt({
      prompt: input.prompt,
      externalId: input.externalId,
    });
    const allowed = result.decision === "allow";

    await resultStore.createResult({
      userId: input.userId,
      videoJobId: input.videoJobId ?? null,
      segmentId: input.segmentId ?? null,
      source: input.source,
      promptHash,
      promptSummary,
      externalId: input.externalId ?? null,
      moderationId: result.id,
      decision: result.decision,
      latencyMs: Date.now() - startedAt,
    });

    return {
      allowed,
      decision: result.decision,
      moderationId: result.id,
      errorCode: null,
    };
  } catch (error) {
    const code = errorCodeFor(error);

    await resultStore.createResult({
      userId: input.userId,
      videoJobId: input.videoJobId ?? null,
      segmentId: input.segmentId ?? null,
      source: input.source,
      promptHash,
      promptSummary,
      externalId: input.externalId ?? null,
      decision: "error",
      errorCode: code,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      latencyMs: Date.now() - startedAt,
    });

    return {
      allowed: false,
      decision: "error",
      moderationId: null,
      errorCode: code,
    };
  }
}
