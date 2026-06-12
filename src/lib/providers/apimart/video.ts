import type { JsonValue } from "@/lib/db/schema/common";

export class APIMartVideoProviderUnavailableError extends Error {
  constructor(message = "APIMart video provider is not configured.") {
    super(message);
    this.name = "APIMartVideoProviderUnavailableError";
  }
}

export interface APIMartVideoConfig {
  provider: "apimart";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface APIMartVideoGenerationInput {
  prompt: string;
  imageUrls: string[];
  aspectRatio: string;
}

export interface APIMartVideoGenerationResult {
  provider: "apimart";
  model: string;
  providerTaskId: string;
  raw: JsonValue;
}

export interface APIMartTaskResult {
  provider: "apimart";
  model: string;
  providerTaskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  errorMessage: string | null;
  raw: JsonValue;
}

interface APIMartClientDeps {
  fetch?: typeof fetch;
  env?: Record<string, string | undefined>;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeBaseUrl(value: string) {
  return value
    .replace(/\/+$/, "")
    .replace(/\/v1\/videos\/generations$/i, "")
    .replace(/\/v1\/tasks$/i, "");
}

export function getAPIMartVideoConfig(
  env: Record<string, string | undefined> = process.env,
): APIMartVideoConfig {
  const apiKey = env.APIMART_API_KEY;
  if (!apiKey) {
    throw new APIMartVideoProviderUnavailableError();
  }

  return {
    provider: "apimart",
    apiKey,
    baseUrl: normalizeBaseUrl(env.APIMART_BASE_URL?.trim() || "https://api.apimart.ai"),
    model:
      env.VIDEO_GENERATION_MODEL?.trim() ||
      env.APIMART_PIXVERSE_MODEL?.trim() ||
      "pixverse-v6",
  };
}

function taskIdFrom(raw: Record<string, unknown>) {
  const data = Array.isArray(raw.data) ? raw.data.map(asRecord) : [];
  const dataRecord = asRecord(raw.data);
  const candidates = [
    raw.task_id,
    raw.taskId,
    raw.id,
    dataRecord.task_id,
    dataRecord.taskId,
    dataRecord.id,
    ...data.flatMap((item) => [item.task_id, item.taskId, item.id]),
  ];
  const taskId = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (!taskId) {
    throw new Error("APIMart response is missing task id.");
  }

  return taskId;
}

function normalizeTaskStatus(status: unknown): APIMartTaskResult["status"] {
  if (status === "completed" || status === "succeeded" || status === "success") {
    return "succeeded";
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    return "failed";
  }

  if (status === "running" || status === "processing" || status === "generating") {
    return "running";
  }

  return "queued";
}

function flattenStringCandidates(value: unknown): string[] {
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(flattenStringCandidates);
  }

  return [];
}

function outputUrlFrom(raw: Record<string, unknown>) {
  const data = asRecord(raw.data);
  const result = asRecord(data.result);
  const output = asRecord(raw.output);
  const videos = [
    ...(Array.isArray(result.videos) ? result.videos.map(asRecord) : []),
    ...(Array.isArray(output.videos) ? output.videos.map(asRecord) : []),
  ];
  const candidates = [
    raw.video_url,
    raw.videoUrl,
    raw.url,
    data.video_url,
    data.videoUrl,
    data.url,
    result.url,
    output.url,
    ...videos.flatMap((video) => [
      video.url,
      video.video_url,
      video.videoUrl,
    ]),
  ].flatMap(flattenStringCandidates);

  return candidates[0] ?? null;
}

function errorMessageFrom(raw: Record<string, unknown>) {
  const error = asRecord(raw.error);
  const dataError = asRecord(asRecord(raw.data).error);
  const candidates = [
    error.message,
    dataError.message,
    raw.error_message,
    raw.errorMessage,
    asRecord(raw.data).error_message,
    asRecord(raw.data).errorMessage,
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? null
  );
}

async function readJson(response: Response) {
  return asRecord(await response.json().catch(() => ({})));
}

function buildGenerationBody(input: APIMartVideoGenerationInput, model: string) {
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    duration: 8,
    resolution: "540p",
    size: input.aspectRatio,
  };

  if (input.imageUrls.length > 1) {
    body.img_references = input.imageUrls;
  } else {
    body.image_urls = input.imageUrls;
  }

  return body;
}

export async function createAPIMartVideoGeneration(
  input: APIMartVideoGenerationInput,
  deps: APIMartClientDeps = {},
): Promise<APIMartVideoGenerationResult> {
  const config = getAPIMartVideoConfig(deps.env);
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/v1/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGenerationBody(input, config.model)),
  });
  const raw = await readJson(response);

  if (!response.ok) {
    throw new Error(`APIMart video generation failed with status ${response.status}.`);
  }

  return {
    provider: "apimart",
    model: config.model,
    providerTaskId: taskIdFrom(raw),
    raw: raw as JsonValue,
  };
}

export async function pollAPIMartTask(
  providerTaskId: string,
  deps: APIMartClientDeps = {},
): Promise<APIMartTaskResult> {
  const config = getAPIMartVideoConfig(deps.env);
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(
    `${config.baseUrl}/v1/tasks/${encodeURIComponent(providerTaskId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
    },
  );
  const raw = await readJson(response);
  const data = asRecord(raw.data);

  if (!response.ok) {
    throw new Error(`APIMart task polling failed with status ${response.status}.`);
  }

  return {
    provider: "apimart",
    model: config.model,
    providerTaskId,
    status: normalizeTaskStatus(raw.status ?? data.status),
    outputUrl: outputUrlFrom(raw),
    errorMessage: errorMessageFrom(raw),
    raw: raw as JsonValue,
  };
}
