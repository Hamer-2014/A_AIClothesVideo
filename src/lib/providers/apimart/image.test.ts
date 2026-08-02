import { describe, expect, it, vi } from "vitest";

import { APIMartImageProviderError, createAPIMartImageGeneration, pollAPIMartImageTask } from "./image";

describe("APIMart image provider", () => {
  it("parses the official submit envelope and sends the fixed 2k full-body protocol", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data: [{ status: "submitted", task_id: "task-1" }] }), { status: 200 }));
    const result = await createAPIMartImageGeneration({ prompt: "front", imageUrls: ["model", "front", "back", "detail"] }, { fetch: fetchSpy, apiKey: "key" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ model: "gpt-image-2", n: 1, size: "2:3", resolution: "2k", prompt: "front", image_urls: ["model", "front", "back", "detail"] });
    expect(result).toEqual({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1" });
  });

  it("uses the shared APIMart service root when the configured URL contains a video endpoint", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 200, data: [{ status: "submitted", task_id: "task-1" }] }), { status: 200 }));

    await createAPIMartImageGeneration(
      { prompt: "front", imageUrls: ["model"] },
      { fetch: fetchSpy, env: { APIMART_API_KEY: "key", APIMART_BASE_URL: "https://api.apimart.ai/v1/videos/generations/" } },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.apimart.ai/v1/images/generations",
      expect.any(Object),
    );
  });

  it.each([
    { code: 200, data: { task_id: "task-1" } },
    { code: 200, data: [{ status: "submitted" }] },
  ])("fails closed with a stable schema code when the official submit shape is malformed", async (body) => {
    await expect(createAPIMartImageGeneration({ prompt: "front", imageUrls: ["model"] }, { fetch: async () => new Response(JSON.stringify(body), { status: 200 }), apiKey: "key" })).rejects.toMatchObject({ name: "APIMartImageProviderError", code: "response_schema_error" });
  });

  it.each([
    { data: { status: "completed", result: { images: {} } } },
    { data: { status: "completed", result: { images: [{ url: "https://upload.apimart.ai/image.png" }] } } },
    { data: { status: "completed", result: { images: [{ url: ["http://upload.apimart.ai/image.png"] }] } } },
    { data: { status: "completed", result: { images: [] } } },
  ])("fails closed with a stable schema code for malformed or unsafe completed output", async (body) => {
    await expect(pollAPIMartImageTask("task-1", { fetch: async () => new Response(JSON.stringify(body), { status: 200 }), apiKey: "key" })).rejects.toMatchObject({ name: "APIMartImageProviderError", code: "response_schema_error" });
  });

  it("returns only a sanitized poll DTO for the official completed shape", async () => {
    await expect(pollAPIMartImageTask("task-1", { fetch: async () => new Response(JSON.stringify({ data: { status: "completed", result: { images: [{ url: ["https://upload.apimart.ai/generated.png"] }] } } }), { status: 200 }), apiKey: "key" })).resolves.toEqual({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1", status: "succeeded", outputUrl: "https://upload.apimart.ai/generated.png" });
  });

  it("exposes a sanitized HTTP status and code for runtime retry classification", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "https://raw.example/secret" } }), { status: 429 }));

    await expect(createAPIMartImageGeneration({ prompt: "front", imageUrls: ["https://signed.example/input"] }, { fetch: fetchSpy, apiKey: "key" })).rejects.toMatchObject({
      name: "APIMartImageProviderError",
      status: 429,
      code: "http_429",
    } satisfies Partial<APIMartImageProviderError>);
  });
});
