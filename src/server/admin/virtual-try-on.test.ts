import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminVirtualTryOnStore,
  getAdminVirtualTryOnDetail,
  listAdminVirtualTryOns,
} from "./virtual-try-on";

const now = new Date("2026-08-01T12:00:00.000Z");

function makeJob(id: string, createdAt = now) {
  return {
    id,
    userId: "owner-1",
    mode: "three_view" as const,
    status: "ready",
    skuName: "Dress 100",
    creditCost: 8,
    reservedLedgerId: "reserve-ledger",
    capturedLedgerId: "capture-ledger",
    releasedLedgerId: null,
    refundedLedgerId: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("admin virtual try-on observability", () => {
  it("returns a bounded, stable list page with the current pack summary", async () => {
    const store = createInMemoryAdminVirtualTryOnStore({
      jobs: [
        makeJob("job-new", new Date("2026-08-01T12:00:02.000Z")),
        makeJob("job-middle", new Date("2026-08-01T12:00:01.000Z")),
        makeJob("job-old", new Date("2026-08-01T12:00:00.000Z")),
      ],
      packs: [
        { id: "pack-new", jobId: "job-new", version: 2, status: "ready", requiredViews: ["front", "side", "back"] },
        { id: "pack-middle", jobId: "job-middle", version: 1, status: "ready", requiredViews: ["front"] },
        { id: "pack-old", jobId: "job-old", version: 1, status: "ready", requiredViews: ["front"] },
      ],
    });

    const first = await listAdminVirtualTryOns({ store, limit: 2 });
    const second = await listAdminVirtualTryOns({ store, limit: 2, cursor: first.nextCursor ?? undefined });

    expect(first.items.map((item) => item.id)).toEqual(["job-new", "job-middle"]);
    expect(first.items[0]?.pack).toEqual({ version: 2, requiredViews: ["front", "side", "back"] });
    expect(first.nextCursor).toBeTruthy();
    expect(second.items.map((item) => item.id)).toEqual(["job-old"]);
  });

  it("returns a recursively redacted detail with an R2 suffix and stable error codes only", async () => {
    const job = makeJob("job-1");
    job.skuName = "https://private.example/?api_key=secret";
    const store = createInMemoryAdminVirtualTryOnStore({
      jobs: [job],
      packs: [{ id: "pack-1", jobId: "job-1", version: 1, status: "ready", requiredViews: ["front", "side", "back"], qaSummary: { evidence: "https://signed.example/a?X-Amz-Signature=secret" } }],
      assets: [{ id: "asset-front", packId: "pack-1", view: "front", providerStatus: "completed", attemptCount: 2, lastErrorCode: "http_429", r2Key: "virtual-try-on/job-1/packs/pack-1/front.png", origin: "generated_apimart_gpt_image_2", provenance: { input: "https://r2.example/private", apiKey: "secret" } }],
      fidelity: [{ id: "qa-1", packId: "pack-1", scope: "view", view: "front", verdict: "pass", resultJson: { verdict: "pass", evidence: { sourceUrl: "https://private.example/signed" } } }],
      providerLogs: [{ id: "log-1", jobId: "job-1", provider: "apimart", model: "gpt-image-2", purpose: "virtual_tryon_image", status: "succeeded", costEstimate: "0.02", providerTaskId: "task-1", errorCode: "timeout", errorMessage: "raw https://provider.example/?api_key=secret", requestSnapshot: { url: "https://r2.example/private" }, responseSummary: { outputUrl: "https://provider.example/output" } }],
      stateEvents: [{ id: "event-1", jobId: "job-1", fromStatus: "generating", toStatus: "ready", reason: "completed", actorType: "system", eventSnapshot: { r2Key: "virtual-try-on/job-1/packs/pack-1/front.png", nested: ["https://example.com"] }, createdAt: now }],
    });

    const detail = await getAdminVirtualTryOnDetail({ store, jobId: "job-1" });

    expect(detail?.views[0]).toMatchObject({ r2KeySuffix: "pack-1/front.png", lastErrorCode: "http_429" });
    expect(detail?.providerLogs[0]).toEqual({ id: "log-1", provider: "apimart", model: "gpt-image-2", purpose: "virtual_tryon_image", status: "succeeded", costEstimate: "0.02", providerTaskId: "task-1", errorCode: "timeout" });
    expect(detail?.ledger).toEqual({ reservedLedgerId: "reserve-ledger", capturedLedgerId: "capture-ledger", releasedLedgerId: null, refundedLedgerId: null });
    expect(detail?.job.skuName).toBeNull();
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toMatch(/https?:\/\/|api[_-]?key|virtual-try-on\/job-1|raw/iu);
    expect(serialized).toContain("pack-1/front.png");
  });
});
