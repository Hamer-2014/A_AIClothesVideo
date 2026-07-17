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

export interface VisionPostQaInput {
  mode: VisionAnalysisMode;
  frameUrls: string[];
  qaRequirements?: string[];
}

export interface VisionConsistencyInput {
  imageUrls: string[];
  declaredRoles: string[];
  expectedSubjectKind: "product" | "human_model";
}

export interface VisionAssetAnalysisResult {
  provider: string;
  model: string;
  analysisJson: JsonValue;
  raw: JsonValue;
}

export interface VisionPostQaResult {
  provider: string;
  model: string;
  qaJson: JsonValue;
  raw: JsonValue;
}

export interface VisionConsistencyResult {
  provider: string;
  model: string;
  consistencyJson: JsonValue;
  raw: JsonValue;
}

interface VisionClientDeps {
  fetch?: typeof fetch;
}

const supportedProviders = ["openai", "apimart", "evolink", "custom"] as const;
const systemInstruction =
  "Analyze clothing product images. Return only JSON with asset_role, garment_category, view_angle, human_present, subject_kind, visible_details, not_visible_details, quality, confidence, risk_flags. Set subject_kind to human_model only when the visible person is wearing the target garment; a person merely present in the scene is not enough. Use product for a garment shown without a real person wearing it, otherwise use unknown.";
const postQaSystemInstruction =
  "Review stitched clothing product video frames for delivery quality and safety. Return only JSON with passed, failure_category, checks, risk_flags, summary. Fail only for blocking delivery problems: garment mismatch or invented details, product cannot be recognized, severe blur/distortion/artifacts, black/bad frames, unsafe content, sexualized child imagery, exploitation, privacy-sensitive content, or adultized child presentation. Do not fail for subjective brand preference or broad ad-policy uncertainty. For childrenswear/kids apparel, ordinary child models, child context, lifestyle scenes, outdoor/street scenes, and minor_present/child_model risk flags are not a failure reason by itself when the presentation is safe and the garment remains recognizable. Slight motion blur is acceptable when the garment can still be assessed. If only soft suitability concerns exist, set passed true and include them as risk_flags/summary warnings instead of failure_category.";

function postQaInstruction(requirements: string[] = []) {
  return requirements.length === 0
    ? postQaSystemInstruction
    : `${postQaSystemInstruction} Additional required checks: ${requirements.join("; ")}.`;
}
const assetAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "asset_role",
    "garment_category",
    "view_angle",
    "human_present",
    "subject_kind",
    "visible_details",
    "not_visible_details",
    "quality",
    "confidence",
    "risk_flags",
  ],
  properties: {
    asset_role: { type: "string" },
    garment_category: { type: "string" },
    view_angle: { type: "string" },
    human_present: { type: "string" },
    subject_kind: { enum: ["product", "human_model", "unknown"] },
    visible_details: {
      type: "array",
      items: { type: "string" },
    },
    not_visible_details: {
      type: "array",
      items: { type: "string" },
    },
    quality: {
      type: "object",
      additionalProperties: false,
      required: [
        "is_garment",
        "is_clear",
        "is_safe",
        "has_flat_lay_or_white_background",
      ],
      properties: {
        is_garment: { type: "boolean" },
        is_clear: { type: "boolean" },
        is_safe: { type: "boolean" },
        has_flat_lay_or_white_background: { type: "boolean" },
      },
    },
    confidence: { type: "string" },
    risk_flags: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;
const postQaJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "passed",
    "failure_category",
    "checks",
    "risk_flags",
    "summary",
  ],
  properties: {
    passed: { type: "boolean" },
    failure_category: {
      anyOf: [
        { type: "string" },
        { type: "null" },
      ],
    },
    checks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "passed", "notes"],
        properties: {
          name: { type: "string" },
          passed: { type: "boolean" },
          notes: { type: "string" },
        },
      },
    },
    risk_flags: {
      type: "array",
      items: { type: "string" },
    },
    summary: { type: "string" },
  },
} as const;
const consistencyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "garment_match",
    "model_match",
    "color_match",
    "pattern_match",
    "view_coverage",
    "confidence",
    "risk_flags",
  ],
  properties: {
    garment_match: { enum: ["pass", "fail", "unknown"] },
    model_match: {
      enum: ["pass", "fail", "unknown", "not_applicable"],
    },
    color_match: { type: "boolean" },
    pattern_match: { type: "boolean" },
    view_coverage: { type: "array", items: { type: "string" } },
    confidence: { type: "string" },
    risk_flags: { type: "array", items: { type: "string" } },
  },
} as const;

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

function responsesInput(imageUrls: string[], instruction = systemInstruction) {
  return [
    {
      role: "system",
      content: [{ type: "input_text", text: instruction }],
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

function chatMessages(imageUrls: string[], instruction = systemInstruction) {
  return [
    {
      role: "system",
      content: instruction,
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
  const output = Array.isArray(raw.output) ? raw.output : [];

  for (const item of output) {
    const message = asRecord(item);
    const contentItems = Array.isArray(message.content) ? message.content : [];

    for (const content of contentItems) {
      const contentRecord = asRecord(content);
      if (contentRecord.type === "output_text") {
        return parseJsonContent(contentRecord.text);
      }
    }
  }

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
        text: {
          format: {
            type: "json_schema",
            name: "asset_analysis",
            strict: true,
            schema: assetAnalysisJsonSchema,
          },
        },
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

export async function createVisionConsistencyAnalysis(
  input: VisionConsistencyInput,
  deps: VisionClientDeps = {},
): Promise<VisionConsistencyResult> {
  const config = getVisionConfig("strict");
  const fetchImpl = deps.fetch ?? fetch;
  const responsesApi = isResponsesApi(config.baseUrl);
  const url = responsesApi
    ? config.baseUrl
    : `${config.baseUrl}/chat/completions`;
  const instruction =
    `Perform a task-local consistency analysis of the ordered clothing images. ` +
    `Expected subject kind: ${input.expectedSubjectKind}. ` +
    `Declared role order: ${input.declaredRoles.join(", ")}. ` +
    "Compare only evidence in this request; do not perform identity matching across tasks or build a face database. " +
    "Return unknown when evidence is insufficient. Return only JSON with garment_match, model_match, color_match, pattern_match, view_coverage, confidence, risk_flags.";
  const body = responsesApi
    ? {
        model: config.model,
        input: responsesInput(input.imageUrls, instruction),
        text: {
          format: {
            type: "json_schema",
            name: "asset_consistency",
            strict: true,
            schema: consistencyJsonSchema,
          },
        },
      }
    : {
        model: config.model,
        stream: false,
        response_format: { type: "json_object" },
        messages: chatMessages(input.imageUrls, instruction),
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

  const consistencyJson = responsesApi
    ? parseResponsesOutput(raw)
    : parseJsonContent(
        asRecord(asRecord((raw.choices as unknown[])?.[0]).message).content,
      );

  return {
    provider: config.provider,
    model: config.model,
    consistencyJson,
    raw: raw as JsonValue,
  };
}

export async function createVisionPostQaCheck(
  input: VisionPostQaInput,
  deps: VisionClientDeps = {},
): Promise<VisionPostQaResult> {
  const config = getVisionConfig(input.mode);
  const fetchImpl = deps.fetch ?? fetch;
  const responsesApi = isResponsesApi(config.baseUrl);
  const url = responsesApi
    ? config.baseUrl
    : `${config.baseUrl}/chat/completions`;
  const instruction = postQaInstruction(input.qaRequirements);
  const body = responsesApi
    ? {
        model: config.model,
        input: responsesInput(input.frameUrls, instruction),
        text: {
          format: {
            type: "json_schema",
            name: "post_qa",
            strict: true,
            schema: postQaJsonSchema,
          },
        },
      }
    : {
        model: config.model,
        stream: false,
        response_format: { type: "json_object" },
        messages: chatMessages(input.frameUrls, instruction),
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

  const qaJson = responsesApi
    ? parseResponsesOutput(raw)
    : parseJsonContent(asRecord(asRecord((raw.choices as unknown[])?.[0]).message).content);

  return {
    provider: config.provider,
    model: config.model,
    qaJson,
    raw: raw as JsonValue,
  };
}
