import type { JsonValue } from "@/lib/db/schema/common";

export type CreemModerationDecision = "allow" | "flag" | "deny";

export class CreemModerationUnavailableError extends Error {
  constructor(message = "Creem moderation API key is not configured.") {
    super(message);
    this.name = "CreemModerationUnavailableError";
  }
}

export interface CreemModerationConfig {
  apiKey: string;
  baseUrl: string;
}

export interface CreateCreemPromptModerationInput {
  prompt: string;
  externalId?: string;
}

export interface CreemPromptModerationResult {
  id: string | null;
  decision: CreemModerationDecision;
  raw: JsonValue;
}

interface CreemModerationDeps {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export const CREEM_MODERATION_TIMEOUT_MS = 8_000;

export function getCreemModerationConfig(): CreemModerationConfig {
  const apiKey = process.env.CREEM_MODERATION_API_KEY;

  if (!apiKey) {
    throw new CreemModerationUnavailableError();
  }

  return {
    apiKey,
    baseUrl: process.env.CREEM_BASE_URL ?? "https://api.creem.io",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseDecision(value: unknown): CreemModerationDecision | null {
  if (value === "allow" || value === "flag" || value === "deny") {
    return value;
  }

  return null;
}

export async function createCreemPromptModeration(
  input: CreateCreemPromptModerationInput,
  deps: CreemModerationDeps = {},
): Promise<CreemPromptModerationResult> {
  const config = getCreemModerationConfig();
  const fetchImpl = deps.fetch ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    deps.timeoutMs ?? CREEM_MODERATION_TIMEOUT_MS,
  );
  let response: Response;

  try {
    response = await fetchImpl(`${config.baseUrl}/v1/moderation/prompt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
      },
      body: JSON.stringify({
        prompt: input.prompt,
        ...(input.externalId ? { external_id: input.externalId } : {}),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new CreemModerationUnavailableError(
        "Creem moderation request timed out.",
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const raw = asRecord(await response.json());

  if (!response.ok) {
    throw new Error(`Creem moderation failed with status ${response.status}.`);
  }

  const decision = parseDecision(raw.decision);
  if (!decision) {
    throw new Error("Creem moderation response is missing a valid decision.");
  }

  return {
    id: typeof raw.id === "string" ? raw.id : null,
    decision,
    raw: raw as JsonValue,
  };
}
