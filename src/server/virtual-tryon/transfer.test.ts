import { describe, expect, it, vi } from "vitest";

import { transferVirtualTryOnImageToR2 } from "./transfer";

describe("virtual try-on output transfer", () => {
  const base = { key: "virtual-try-on/job/packs/pack/front.png", bucket: "bucket", client: { send: vi.fn() } };
  it("accepts an image from the official APIMart upload host without redirects", async () => {
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/output.png", fetch: async () => new Response("png", { headers: { "content-type": "image/png", "content-length": "3" } }) })).resolves.toMatchObject({ key: base.key, contentType: "image/png" });
  });
  it.each(["http://upload.apimart.ai/output.png", "https://elsewhere.example/output.png", "https://127.0.0.1/output.png", "https://169.254.169.254/latest", "https://localhost/output.png"]) ("rejects an unsafe output URL", async (url) => {
    await expect(transferVirtualTryOnImageToR2({ ...base, url, fetch: vi.fn() })).rejects.toThrow("virtual_tryon_output_url_rejected");
  });
  it("rejects redirects, non-image MIME, declared oversize, and streamed oversize content", async () => {
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response(null, { status: 302, headers: { location: "https://evil.example/a" } }) })).rejects.toThrow("virtual_tryon_output_redirect_rejected");
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response("x", { headers: { "content-type": "text/html" } }) })).rejects.toThrow("virtual_tryon_output_content_type_rejected");
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response("x", { headers: { "content-type": "image/png", "content-length": String(26 * 1024 * 1024) } }) })).rejects.toThrow("virtual_tryon_output_too_large");
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(25 * 1024 * 1024 + 1)); controller.close(); } });
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response(body, { headers: { "content-type": "image/png" } }) })).rejects.toThrow("virtual_tryon_output_too_large");
  });
  it("returns stable retryable codes for network, timeout, and upstream failures", async () => {
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => { throw new TypeError("socket reset"); } })).rejects.toMatchObject({ code: "network_error" });
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response(null, { status: 500 }) })).rejects.toMatchObject({ code: "http_500", status: 500 });
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", timeoutMs: 1, fetch: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))) })).rejects.toMatchObject({ code: "timeout" });
  });

  it("classifies a response-stream network failure without exposing the transport message", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new TypeError("connection reset https://private.example")); } });
    await expect(transferVirtualTryOnImageToR2({ ...base, url: "https://upload.apimart.ai/a", fetch: async () => new Response(body, { headers: { "content-type": "image/png" } }) })).rejects.toMatchObject({ code: "network_error" });
  });
});
