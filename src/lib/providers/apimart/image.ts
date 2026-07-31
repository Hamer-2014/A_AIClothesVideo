import type { JsonValue } from "@/lib/db/schema/common";

export class APIMartImageProviderUnavailableError extends Error {
  constructor() { super("APIMart image provider is not configured."); this.name = "APIMartImageProviderUnavailableError"; }
}

export class APIMartImageProviderError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(input: { operation: "generation" | "poll"; status?: number; code?: string }) {
    const status = input.status;
    super("APIMart image " + input.operation + " failed" + (status === undefined ? "." : " with status " + status + "."));
    this.name = "APIMartImageProviderError";
    this.status = status;
    this.code = input.code ?? (status === undefined ? "network_error" : "http_" + status);
  }
}

type Deps = { fetch?: typeof fetch; env?: Record<string, string | undefined>; apiKey?: string };
type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function config(deps: Deps) {
  const apiKey = deps.apiKey?.trim() || deps.env?.APIMART_API_KEY?.trim() || process.env.APIMART_API_KEY?.trim();
  if (!apiKey) throw new APIMartImageProviderUnavailableError();
  const rawUrl = deps.env?.APIMART_BASE_URL || process.env.APIMART_BASE_URL || "https://api.apimart.ai";
  return { apiKey, baseUrl: rawUrl.replace(/\/+$/, "").replace(/\/v1\/images\/generations$/i, "") };
}
function taskId(raw: RecordValue) {
  const data = record(raw.data);
  const value = [raw.task_id, raw.taskId, raw.id, data.task_id, data.taskId, data.id].find((item): item is string => typeof item === "string" && item.length > 0);
  if (!value) throw new Error("APIMart response is missing task id.");
  return value;
}
function status(value: unknown): "queued" | "running" | "succeeded" | "failed" {
  if (["succeeded", "success", "completed"].includes(String(value))) return "succeeded";
  if (["failed", "error", "cancelled"].includes(String(value))) return "failed";
  if (["running", "processing", "generating"].includes(String(value))) return "running";
  return "queued";
}
function outputUrl(raw: RecordValue) {
  const data = record(raw.data); const output = record(raw.output); const result = record(data.result);
  return [raw.url, raw.image_url, data.url, data.image_url, output.url, result.url].find((item): item is string => typeof item === "string" && item.length > 0) ?? null;
}

export async function createAPIMartImageGeneration(input: { prompt: string; imageUrls: string[] }, deps: Deps = {}) {
  if (input.imageUrls.length < 1 || input.imageUrls.length > 16) throw new Error("APIMart image generation accepts 1 to 16 image URLs.");
  const current = config(deps);
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(current.baseUrl + "/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + current.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-image-2", n: 1, prompt: input.prompt, image_urls: input.imageUrls }) });
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    throw new APIMartImageProviderError({ operation: "generation", code });
  }
  const raw = record(await response.json().catch(() => ({})));
  if (!response.ok) throw new APIMartImageProviderError({ operation: "generation", status: response.status });
  return { provider: "apimart" as const, model: "gpt-image-2", providerTaskId: taskId(raw), raw: raw as JsonValue };
}

export async function pollAPIMartImageTask(providerTaskId: string, deps: Deps = {}) {
  const current = config(deps);
  let response: Response;
  try {
    response = await (deps.fetch ?? fetch)(current.baseUrl + "/v1/tasks/" + encodeURIComponent(providerTaskId), { headers: { Authorization: "Bearer " + current.apiKey } });
  } catch (error) {
    const code = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    throw new APIMartImageProviderError({ operation: "poll", code });
  }
  const raw = record(await response.json().catch(() => ({}))); const data = record(raw.data);
  if (!response.ok) throw new APIMartImageProviderError({ operation: "poll", status: response.status });
  return { provider: "apimart" as const, model: "gpt-image-2", providerTaskId, status: status(raw.status ?? data.status), outputUrl: outputUrl(raw), raw: raw as JsonValue };
}
