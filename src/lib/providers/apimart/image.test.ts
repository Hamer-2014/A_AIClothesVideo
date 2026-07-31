import { describe, expect, it, vi } from "vitest";

import { APIMartImageProviderError, createAPIMartImageGeneration } from "./image";

describe("APIMart image provider", () => {
  it("sends GPT Image 2 with n=1 and ordered image URLs", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { task_id: "task-1" } }), { status: 200 }));
    await createAPIMartImageGeneration({ prompt: "front", imageUrls: ["model", "front", "back", "detail"] }, { fetch: fetchSpy, apiKey: "key" });
    expect(JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))).toEqual({ model: "gpt-image-2", n: 1, prompt: "front", image_urls: ["model", "front", "back", "detail"] });
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
