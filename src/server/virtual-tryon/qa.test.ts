import { describe, expect, it, vi } from "vitest";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryVirtualTryOnQaStore } from "./qa-store";
import { runVirtualTryOnQa } from "./qa";

const view = { verdict: "pass", targetView: "front", garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" }, person: { anatomy: "natural", identityConsistency: "match" }, inventedDetails: false, evidence: [] };
const cross = { verdict: "pass", requiredViews: ["front", "side", "back"], coverage: "complete", garmentConsistency: "match", personConsistency: "match", evidence: [] };

describe("virtual try-on QA", () => {
  it("runs front-only once and never runs cross", async () => {
    const provider = vi.fn().mockResolvedValue({ provider: "vision", model: "strict", qaJson: view, raw: { secret: "raw" } }); const logs = createInMemoryProviderCallLogStore();
    const result = await runVirtualTryOnQa({ jobId: "job", userId: "user", packId: "pack", mode: "front_only", sourceKeys: { front: "r2/source.png" }, generatedKeys: { front: "r2/generated.png" } }, { signer: async (key) => "https://signed.example/" + key, visionProvider: provider, qaStore: createInMemoryVirtualTryOnQaStore(), providerLogStore: logs });
    expect(provider).toHaveBeenCalledTimes(1); expect(result.allPassed).toBe(true); expect(JSON.stringify(logs.listCallLogs())).not.toMatch(/https:|signed|r2\/|raw|secret/);
  });
  it("runs three views then cross and fails closed for unknown", async () => {
    const provider = vi.fn().mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: view, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: { ...view, targetView: "side", verdict: "unknown" }, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: { ...view, targetView: "back" }, raw: {} }).mockResolvedValueOnce({ provider: "vision", model: "strict", qaJson: cross, raw: {} }); const store = createInMemoryVirtualTryOnQaStore(); const logs = createInMemoryProviderCallLogStore();
    const result = await runVirtualTryOnQa({ jobId: "job", userId: "user", packId: "pack", mode: "three_view", sourceKeys: { front: "f", back: "b", detail: "d" }, generatedKeys: { front: "gf", side: "gs", back: "gb" } }, { signer: async (key) => "https://signed/" + key, visionProvider: provider, qaStore: store, providerLogStore: logs });
    expect(provider.mock.calls.map((call) => call[0].kind)).toEqual(["view", "view", "view", "cross"]); expect(result.allPassed).toBe(false); expect(await store.findResults("pack")).toHaveLength(4);
  });
});
