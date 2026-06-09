import type { JsonValue } from "@/lib/db/schema/common";

export type VisionAnalysisMode = "lite" | "standard" | "strict";

export class VisionProviderUnavailableError extends Error {
  constructor(message = "Vision provider is not configured.") {
    super(message);
    this.name = "VisionProviderUnavailableError";
  }
}

export interface VisionConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface VisionAssetAnalysisInput {
  mode: VisionAnalysisMode;
  imageUrls: string[];
}

export interface VisionAssetAnalysisResult {
  provider: string;
  model: string;
  analysisJson: JsonValue;
  raw: JsonValue;
}

interface VisionClientDeps {
  fetch?: typeof fetch;
}

const supportedProviders = ["openai", "apimart", "evolink", "custom"] as const;
const systemInstruction =
  "Analyze clothing product images. Return only JSON with asset_role, garment_category, view_angle, human_present, visible_details, not_visible_details, quality, confidence, risk_flags.";

function modelEnvForMode(mode: VisionAnalysisMode) {
  switch (mode) {
    case "lite":
      return "VISION_MODEL_LITE";
    case "standard":
      return "VISION_MODEL_STANDARD";
    case "strict":
      return "VISION_MODEL_STRICT";
  }
}

export function getVisionConfig(mode: VisionAnalysisMode): VisionConfig {
  const provider = process.env.VISION_PROVIDER;
  const apiKey = process.env.VISION_API_KEY;
  const model = process.env[modelEnvForMode(mode)];
  const baseUrl = process.env.VISION_BASE_URL?.trim().replace(/\/+$/, "");

  if (
    !provider ||
    !supportedProviders.includes(provider as (typeof supportedProviders)[number]) ||
    !apiKey ||
    !model
  ) {
    throw new VisionProviderUnavailableError();
  }

  if (provider !== "openai" && !baseUrl) {
    throw new VisionProviderUnavailableError();
  }

  return {
    provider,
    apiKey,
    baseUrl: baseUrl || "https://api.openai.com/v1",
    model,
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
    throw new Error("Vision provider response is missing JSON content.");
  }

  return JSON.parse(content) as JsonValue;
}

function isResponsesApi(baseUrl: string) {
  return /\/responses$/i.test(baseUrl);
}

function responsesInput(imageUrls: string[]) {
  return [
    {
      role: "system",
      content: [{ type: "input_text", text: systemInstruction }],
    },
    {
      role: "user",
      content: imageUrls.map((url) => ({
        type: "input_image",
        image_url: url,
      })),
    },
  ];
}

function chatMessages(imageUrls: string[]) {
  return [
    {
      role: "system",
      content: systemInstruction,
    },
    {
      role: "user",
      content: imageUrls.map((url) => ({
        type: "image_url",
        image_url: { url },
      })),
    },
  ];
}

function parseResponsesOutput(raw: Record<string, unknown>) {
  const wrapped = asRecord(raw.data);
  const payload = Object.keys(wrapped).length > 0 ? wrapped : raw;
  const firstChoice = asRecord((payload.choices as unknown[])?.[0]);
  const message = asRecord(firstChoice.message);
  return parseJsonContent(message.content);
}

export async function createVisionAssetAnalysis(
  input: VisionAssetAnalysisInput,
  deps: VisionClientDeps = {},
): Promise<VisionAssetAnalysisResult> {
  const config = getVisionConfig(input.mode);
  const fetchImpl = deps.fetch ?? fetch;
  const responsesApi = isResponsesApi(config.baseUrl);
  const url = responsesApi
    ? config.baseUrl
    : `${config.baseUrl}/chat/completions`;
  const body = responsesApi
    ? {
        model: config.model,
        input: responsesInput(input.imageUrls),
      }
    : {
        model: config.model,
        stream: false,
        response_format: { type: "json_object" },
        messages: chatMessages(input.imageUrls),
      };

  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const raw = asRecord(await response.json());

  if (!response.ok) {
    throw new Error(`Vision provider failed with status ${response.status}.`);
  }

  const analysisJson = responsesApi
    ? parseResponsesOutput(raw)
    : parseJsonContent(asRecord(asRecord((raw.choices as unknown[])?.[0]).message).content);

  return {
    provider: config.provider,
    model: config.model,
    analysisJson,
    raw: raw as JsonValue,
  };
}
