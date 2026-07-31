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

type Deps = { fetch?: typeof fetch; env?: Record<string, string | undefined>; apiKey?: string; timeoutMs?: number };
type RecordValue = Record<string, unknown>;
type ProviderStatus = "queued" | "running" | "succeeded" | "failed";

function record(value: unknown): RecordValue { return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {}; }
function config(deps: Deps) {
  const apiKey = deps.apiKey?.trim() || deps.env?.APIMART_API_KEY?.trim() || process.env.APIMART_API_KEY?.trim();
  if (!apiKey) throw new APIMartImageProviderUnavailableError();
  const rawUrl = deps.env?.APIMART_BASE_URL || process.env.APIMART_BASE_URL || "https://api.apimart.ai";
  return { apiKey, baseUrl: rawUrl.replace(/\/+$/, "").replace(/\/v1\/images\/generations$/i, ""), timeoutMs: deps.timeoutMs ?? 25_000 };
}

async function request(fetchImpl: typeof fetch, url: string, init: RequestInit, timeoutMs: number, operation: "generation" | "poll") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    throw new APIMartImageProviderError({ operation, code: controller.signal.aborted || (error instanceof Error && error.name === "AbortError") ? "timeout" : "network_error" });
  } finally { clearTimeout(timeout); }
}

function parseSubmit(raw: unknown) {
  const root = record(raw);
  if (!Array.isArray(root.data)) throw new APIMartImageProviderError({ operation: "generation", code: "response_schema_error" });
  const first = record(root.data[0]);
  if (first.status !== "submitted" || typeof first.task_id !== "string" || first.task_id.trim().length === 0) throw new APIMartImageProviderError({ operation: "generation", code: "response_schema_error" });
  return first.task_id;
}
function parseStatus(value: unknown): ProviderStatus {
  if (value === "submitted") return "queued";
  if (value === "processing") return "running";
  if (value === "completed") return "succeeded";
  if (value === "failed") return "failed";
  throw new APIMartImageProviderError({ operation: "poll", code: "response_schema_error" });
}
function parseCompletedOutput(raw: RecordValue) {
  const result = record(record(raw.data).result);
  if (!Array.isArray(result.images)) throw new APIMartImageProviderError({ operation: "poll", code: "response_schema_error" });
  const first = record(result.images[0]);
  if (!Array.isArray(first.url) || typeof first.url[0] !== "string") throw new APIMartImageProviderError({ operation: "poll", code: "response_schema_error" });
  try {
    const parsed = new URL(first.url[0]);
    if (parsed.protocol !== "https:") throw new Error("unsafe");
    return parsed.toString();
  } catch { throw new APIMartImageProviderError({ operation: "poll", code: "response_schema_error" }); }
}

export async function createAPIMartImageGeneration(input: { prompt: string; imageUrls: string[] }, deps: Deps = {}) {
  if (input.imageUrls.length < 1 || input.imageUrls.length > 16) throw new Error("APIMart image generation accepts 1 to 16 image URLs.");
  const current = config(deps);
  const response = await request(deps.fetch ?? fetch, current.baseUrl + "/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + current.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ model: "gpt-image-2", n: 1, size: "2:3", resolution: "2k", prompt: input.prompt, image_urls: input.imageUrls }) }, current.timeoutMs, "generation");
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new APIMartImageProviderError({ operation: "generation", status: response.status });
  return { provider: "apimart" as const, model: "gpt-image-2", providerTaskId: parseSubmit(body) };
}

export async function pollAPIMartImageTask(providerTaskId: string, deps: Deps = {}) {
  const current = config(deps);
  const response = await request(deps.fetch ?? fetch, current.baseUrl + "/v1/tasks/" + encodeURIComponent(providerTaskId), { headers: { Authorization: "Bearer " + current.apiKey } }, current.timeoutMs, "poll");
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new APIMartImageProviderError({ operation: "poll", status: response.status });
  const raw = record(body);
  const status = parseStatus(record(raw.data).status);
  return { provider: "apimart" as const, model: "gpt-image-2", providerTaskId, status, outputUrl: status === "succeeded" ? parseCompletedOutput(raw) : null };
}
