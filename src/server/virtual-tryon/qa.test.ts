import { describe, expect, it, vi } from "vitest";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryVirtualTryOnQaStore } from "./qa-store";
import { runVirtualTryOnQa } from "./qa";

const view = { verdict: "pass", targetView: "front", observedView: "front", garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" }, person: { anatomy: "natural", identityConsistency: "match" }, inventedDetails: false, evidence: [] };
const cross = { verdict: "pass", requiredViews: ["front", "side", "back"], coverage: "complete", garmentConsistency: "match", personConsistency: "match", evidence: [] };

describe("virtual try-on QA", () => {
  it("runs front-only once and never runs cross", async () => {
    const provider = vi.fn().mockResolvedValue({ provider: "vision", model: "strict", qaJson: view, raw: { secret: "raw" } }); const logs = createInMemoryProviderCallLogStore();
    const result = await runVirtualTryOnQa({ jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "r2/source.png" }, modelKeys: { front: "r2/model-front.png", side: "r2/model-side.png", back: "r2/model-back.png" }, generatedKeys: { front: "r2/generated.png" } }, { signer: async (key) => "https://signed.example/" + key, visionProvider: provider, qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: logs });
    expect(provider).toHaveBeenCalledTimes(1); expect(result.allPassed).toBe(true); expect(JSON.stringify(logs.listCallLogs())).not.toMatch(/https:|signed|r2\/|raw|secret/);
    expect(provider.mock.calls[0]?.[0].imageUrls).toEqual(["https://signed.example/r2/model-front.png", "https://signed.example/r2/source.png", "https://signed.example/r2/generated.png"]);
  });
  it("runs three views then cross and fails closed for unknown", async () => {
    const provider = vi.fn().mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: view, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: { ...view, targetView: "side", verdict: "unknown" }, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: { ...view, targetView: "back" }, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: cross, raw: {} }); const store = createInMemoryVirtualTryOnQaStore(); const logs = createInMemoryProviderCallLogStore();
    const result = await runVirtualTryOnQa({ jobId: "job", userId: "user", packId: "pack", mode: "three_view", sourceKeys: { front: "f", back: "b", detail: "d" }, modelKeys: { front: "mf", side: "ms", back: "mb" }, generatedKeys: { front: "gf", side: "gs", back: "gb" } }, { signer: async (key) => "https://signed/" + key, visionProvider: provider, qaStore: store, providerLogStore: logs });
    expect(provider.mock.calls.map((call) => call[0].kind)).toEqual(["view", "view", "view", "cross"]); expect(result.allPassed).toBe(false); expect(await store.findResults("pack")).toHaveLength(4);
    expect(provider.mock.calls.slice(0, 3).map((call) => call[0].imageUrls)).toEqual([
      ["https://signed/mf", "https://signed/f", "https://signed/b", "https://signed/d", "https://signed/gf"],
      ["https://signed/ms", "https://signed/f", "https://signed/b", "https://signed/d", "https://signed/gs"],
      ["https://signed/mb", "https://signed/f", "https://signed/b", "https://signed/d", "https://signed/gb"],
    ]);
  });

  it("renews the worker lease around each paid QA call and stops after lease loss", async () => {
    const provider = vi.fn().mockResolvedValue({ provider: "vision", model: "strict", qaJson: view, raw: {} });
    const renewLease = vi.fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = runVirtualTryOnQa(
      { jobId: "job", userId: "user", packId: "pack", mode: "three_view", sourceKeys: { front: "f", back: "b", detail: "d" }, modelKeys: { front: "mf", side: "ms", back: "mb" }, generatedKeys: { front: "gf", side: "gs", back: "gb" } },
      { signer: async (key) => "https://signed/" + key, visionProvider: provider, renewLease, qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: createInMemoryProviderCallLogStore() },
    );

    await expect(result).rejects.toThrow("virtual_tryon_qa_lease_lost");
    expect(renewLease).toHaveBeenCalledTimes(3);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the model reference is missing or identity does not match", async () => {
    const logs = createInMemoryProviderCallLogStore();
    const missing = await runVirtualTryOnQa({ jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "f" }, modelKeys: { front: "", side: "ms", back: "mb" }, generatedKeys: { front: "gf" } }, { signer: async (key) => "https://signed/" + key, qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: logs });
    const mismatch = await runVirtualTryOnQa({ jobId: "job2", userId: "user", packId: "pack2", mode: "front_only", sourceKeys: { front: "f" }, modelKeys: { front: "mf", side: "ms", back: "mb" }, generatedKeys: { front: "gf" } }, { signer: async (key) => "https://signed/" + key, visionProvider: async () => ({ provider: "vision", model: "strict", qaJson: { ...view, person: { anatomy: "natural", identityConsistency: "mismatch" } }, raw: {} }), qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: createInMemoryProviderCallLogStore() });
    expect(missing.allPassed).toBe(false);
    expect(mismatch.allPassed).toBe(false);
  });

  it("fails closed when the generated image orientation does not match its assigned view", async () => {
    const result = await runVirtualTryOnQa(
      { jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "f" }, modelKeys: { front: "mf", side: "ms", back: "mb" }, generatedKeys: { front: "gf" } },
      { signer: async (key) => "https://signed/" + key, visionProvider: async () => ({ provider: "vision", model: "strict", qaJson: { ...view, observedView: "back" }, raw: {} }), qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: createInMemoryProviderCallLogStore() },
    );

    expect(result.allPassed).toBe(false);
  });

  it("logs the actual model and provider failure stage without signed URLs", async () => {
    const logs = createInMemoryProviderCallLogStore();
    const providerError = Object.assign(new Error("sensitive provider response"), {
      provider: "apimart",
      model: "gpt-5.4",
      status: 500,
      code: "http_500",
    });

    const result = await runVirtualTryOnQa(
      { jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "source" }, modelKeys: { front: "model", side: "side", back: "back" }, generatedKeys: { front: "generated" } },
      { signer: async (key) => "https://signed/" + key, visionProvider: async () => { throw providerError; }, qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: logs },
    );

    expect(result.allPassed).toBe(false);
    expect(logs.listCallLogs()[0]).toMatchObject({
      provider: "apimart",
      model: "gpt-5.4",
      errorCode: "virtual_tryon_qa_provider_failed",
      requestSnapshot: { scope: "view", view: "front", imageCount: 3, failurePhase: "provider" },
      responseSummary: { status: "failed", verdict: "unknown", providerErrorCode: "http_500", httpStatus: 500 },
    });
    expect(JSON.stringify(logs.listCallLogs())).not.toContain("sensitive provider response");
    expect(JSON.stringify(logs.listCallLogs())).not.toContain("https://signed/");
  });

  it("distinguishes strict schema failures from provider failures", async () => {
    const logs = createInMemoryProviderCallLogStore();

    await runVirtualTryOnQa(
      { jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "source" }, modelKeys: { front: "model", side: "side", back: "back" }, generatedKeys: { front: "generated" } },
      { signer: async (key) => "https://signed/" + key, visionProvider: async () => ({ provider: "apimart", model: "gpt-5.4", qaJson: { verdict: "pass" }, raw: {} }), qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: logs },
    );

    expect(logs.listCallLogs()[0]).toMatchObject({
      provider: "apimart",
      model: "gpt-5.4",
      errorCode: "virtual_tryon_qa_schema_failed",
      requestSnapshot: { imageCount: 3, failurePhase: "schema" },
      responseSummary: { providerErrorCode: "qa_schema_error" },
    });
  });
});
