import type { JsonValue } from "@/lib/db/schema/common";

export class EvoLinkProviderUnavailableError extends Error {
  constructor(message = "EvoLink video provider is not configured.") {
    super(message);
    this.name = "EvoLinkProviderUnavailableError";
  }
}

export interface EvoLinkVideoConfig {
  provider: "evolink";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface EvoLinkVideoGenerationInput {
  prompt: string;
  imageUrls: string[];
  aspectRatio: string;
}

export interface EvoLinkVideoGenerationResult {
  provider: "evolink";
  model: string;
  providerTaskId: string;
  raw: JsonValue;
}

export interface EvoLinkTaskResult {
  provider: "evolink";
  model: string;
  providerTaskId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  outputUrl: string | null;
  raw: JsonValue;
}

interface EvoLinkClientDeps {
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

function taskIdFrom(raw: Record<string, unknown>) {
  const candidates = [
    raw.task_id,
    raw.taskId,
    raw.id,
    asRecord(raw.data).task_id,
    asRecord(raw.data).taskId,
    asRecord(raw.data).id,
  ];
  const taskId = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  );

  if (!taskId) {
    throw new Error("EvoLink response is missing task id.");
  }

  return taskId;
}

function normalizeTaskStatus(status: unknown): EvoLinkTaskResult["status"] {
  if (status === "succeeded" || status === "completed" || status === "success") {
    return "succeeded";
  }

  if (status === "failed" || status === "error" || status === "cancelled") {
    return "failed";
  }

  if (status === "running" || status === "processing") {
    return "running";
  }

  return "queued";
}

function outputUrlFrom(raw: Record<string, unknown>) {
  const output = asRecord(raw.output);
  const dataOutput = asRecord(asRecord(raw.data).output);
  const results = Array.isArray(raw.results) ? raw.results : [];
  const dataResults = Array.isArray(asRecord(raw.data).results)
    ? (asRecord(raw.data).results as unknown[])
    : [];
  const videos = [
    ...(Array.isArray(output.videos) ? output.videos : []),
    ...(Array.isArray(dataOutput.videos) ? dataOutput.videos : []),
  ];
  const candidates = [
    raw.video_url,
    raw.videoUrl,
    raw.url,
    output.url,
    output.video_url,
    dataOutput.url,
    dataOutput.video_url,
    ...results,
    ...dataResults,
    ...videos.map((video) => asRecord(video).url),
  ];

  return (
    candidates.find(
      (candidate): candidate is string =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? null
  );
}

export function getEvoLinkVideoConfig(
  env: Record<string, string | undefined> = process.env,
): EvoLinkVideoConfig {
  const apiKey = env.EVOLINK_API_KEY;
  if (!apiKey) {
    throw new EvoLinkProviderUnavailableError();
  }

  return {
    provider: "evolink",
    apiKey,
    baseUrl: normalizeBaseUrl(
      env.EVOLINK_BASE_URL?.trim() || "https://api.evolink.ai",
    ),
    model: env.EVOLINK_VIDEO_MODEL?.trim() || "veo3.1-fast-beta",
  };
}

async function readJson(response: Response) {
  return asRecord(await response.json().catch(() => ({})));
}

export async function createEvoLinkVideoGeneration(
  input: EvoLinkVideoGenerationInput,
  deps: EvoLinkClientDeps = {},
): Promise<EvoLinkVideoGenerationResult> {
  const config = getEvoLinkVideoConfig(deps.env);
  const fetchImpl = deps.fetch ?? fetch;
  const response = await fetchImpl(`${config.baseUrl}/v1/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      duration_seconds: 8,
      image_urls: input.imageUrls,
    }),
  });
  const raw = await readJson(response);

  if (!response.ok) {
    throw new Error(`EvoLink video generation failed with status ${response.status}.`);
  }

  return {
    provider: "evolink",
    model: config.model,
    providerTaskId: taskIdFrom(raw),
    raw: raw as JsonValue,
  };
}

export async function pollEvoLinkTask(
  providerTaskId: string,
  deps: EvoLinkClientDeps = {},
): Promise<EvoLinkTaskResult> {
  const config = getEvoLinkVideoConfig(deps.env);
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

  if (!response.ok) {
    throw new Error(`EvoLink task polling failed with status ${response.status}.`);
  }

  return {
    provider: "evolink",
    model: config.model,
    providerTaskId,
    status: normalizeTaskStatus(raw.status ?? asRecord(raw.data).status),
    outputUrl: outputUrlFrom(raw),
    raw: raw as JsonValue,
  };
}
