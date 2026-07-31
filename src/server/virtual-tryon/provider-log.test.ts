import { describe, expect, it } from "vitest";
import { sanitizeVirtualTryOnProviderLog } from "./provider-log";

describe("virtual try-on provider logging", () => {
  it("does not retain URLs, API keys or raw payloads", () => {
    const value = sanitizeVirtualTryOnProviderLog({ view: "front", imageCount: 3, promptHash: "hash", taskId: "task", status: "succeeded", outputUrl: "https://secret.example/x?X-Amz-Signature=token", apiKey: "sk-secret" });
    expect(JSON.stringify(value)).not.toMatch(/https:|Signature|secret/);
    expect(value.requestSnapshot).toEqual({ view: "front", imageCount: 3, promptHash: "hash" });
  });
});
