import type { JsonValue } from "@/lib/db/schema/common";

export class DeepSeekProviderUnavailableError extends Error {
  constructor(message = "DeepSeek provider is not configured.") {
    super(message);
    this.name = "DeepSeekProviderUnavailableError";
  }
}

export interface DeepSeekConfig {
  provider: "deepseek";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface DeepSeekStoryboardInput {
  systemPrompt: string;
  userPrompt: string;
}

export interface DeepSeekStoryboardResult {
  provider: "deepseek";
  model: string;
  storyboardJson: JsonValue;
  raw: JsonValue;
}

interface DeepSeekClientDeps {
  fetch?: typeof fetch;
}

export function getDeepSeekConfig(): DeepSeekConfig {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekProviderUnavailableError();
  }

  return {
    provider: "deepseek",
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL?.trim() || "https://api.deepseek.com",
    model: process.env.DEEPSEEK_STORYBOARD_MODEL?.trim() || "deepseek-v4-flash",
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function parseJsonContent(content: unknown): JsonValue {
  if (typeof content !== "string") {
    throw new Error("DeepSeek response is missing JSON content.");
  }

  return JSON.parse(content) as JsonValue;
}

export async function createDeepSeekStoryboard(
  input: DeepSeekStoryboardInput,
  deps: DeepSeekClientDeps = {},
): Promise<DeepSeekStoryboardResult> {
  const config = getDeepSeekConfig();
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
        },
      ],
    }),
  });
  const raw = asRecord(await response.json());

  if (!response.ok) {
    throw new Error(`DeepSeek storyboard failed with status ${response.status}.`);
  }

  const firstChoice = asRecord((raw.choices as unknown[])?.[0]);
  const message = asRecord(firstChoice.message);
  const storyboardJson = parseJsonContent(message.content);

  return {
    provider: "deepseek",
    model: config.model,
    storyboardJson,
    raw: raw as JsonValue,
  };
}
