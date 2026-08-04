import { describe, expect, it, vi } from "vitest";

import {
  createDrizzleVirtualTryOnVideoBridgeStore,
  createInMemoryVirtualTryOnVideoBridgeStore,
  createVirtualTryOnVideo,
  type VirtualTryOnVideoBridgeCandidate,
} from "./video-bridge";

const userId = "22222222-2222-4222-8222-222222222222";

function candidate(overrides: Partial<VirtualTryOnVideoBridgeCandidate> = {}): VirtualTryOnVideoBridgeCandidate {
  return {
    jobId: "tryon-job-1",
    userId,
    jobStatus: "locked",
    mode: "three_view",
    skuName: "Burgundy dress",
    isTest: false,
    packId: "pack-2",
    version: 2,
    packStatus: "locked",
    lockedAt: new Date("2026-08-04T00:00:00.000Z"),
    requiredViews: ["front", "side", "back"],
    qaResults: [
      { scope: "view", view: "front", verdict: "pass" },
      { scope: "view", view: "side", verdict: "pass" },
      { scope: "view", view: "back", verdict: "pass" },
      { scope: "cross_view", view: null, verdict: "pass" },
    ],
    sourceRights: [
      { assetId: "source-front", attestationId: "attestation-1" },
      { assetId: "source-back", attestationId: "attestation-1" },
      { assetId: "source-detail", attestationId: "attestation-1" },
    ],
    views: ["front", "side", "back"].map((view) => ({
      id: `pack-asset-${view}`,
      view: view as "front" | "side" | "back",
      providerStatus: "succeeded",
      r2Key: `virtual-try-on/tryon-job-1/packs/pack-2/${view}.png`,
      mimeType: "image/png",
      fileSize: 1024,
      origin: "generated_apimart_gpt_image_2",
      provenance: { provider: "apimart", model: "gpt-image-2" },
      materializedAssetId: null,
    })),
    ...overrides,
  };
}

const request = {
  userId,
  jobId: "tryon-job-1",
  packId: "pack-2",
  idempotencyKey: "bridge-request-1",
  durationSeconds: 24,
  aspectRatio: "9:16" as const,
  presetId: "minimal_studio",
};

describe("virtual try-on video bridge", () => {
  it("materializes a locked three-view pack into one paid Strict-QA standard video job", async () => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [candidate()] });

    const result = await createVirtualTryOnVideo(request, { store, now: new Date("2026-08-04T01:00:00.000Z") });

    expect(result).toMatchObject({ replayed: false, status: "asset_analysis_queued" });
    expect(store.listMaterializedAssets()).toHaveLength(3);
    expect(store.listMaterializedAssets()).toEqual(expect.arrayContaining([
      expect.objectContaining({ detectedRole: "front", originalKey: expect.stringContaining("front.png"), rightsAttestationIds: ["attestation-1"] }),
      expect.objectContaining({ detectedRole: "side", originalKey: expect.stringContaining("side.png"), rightsAttestationIds: ["attestation-1"] }),
      expect.objectContaining({ detectedRole: "back", originalKey: expect.stringContaining("back.png"), rightsAttestationIds: ["attestation-1"] }),
    ]));
    expect(store.listVideoJobs()).toEqual([
      expect.objectContaining({
        id: result.videoJobId,
        billingMode: "paid",
        captureProtocol: "model_turn",
        postQaMode: "strict",
        status: "asset_analysis_queued",
        generationSourceSnapshot: expect.objectContaining({
          kind: "virtual_tryon_appearance_pack",
          appearancePackId: "pack-2",
          version: 2,
        }),
      }),
    ]);
  });

  it("materializes only the front view for a front-only pack", async () => {
    const front = candidate({
      mode: "front_only",
      requiredViews: ["front"],
      qaResults: [{ scope: "view", view: "front", verdict: "pass" }],
    });
    front.views = front.views.filter((view) => view.view === "front");
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [front] });

    await createVirtualTryOnVideo({ ...request, durationSeconds: 8 }, { store });

    expect(store.listMaterializedAssets().map((asset) => asset.detectedRole)).toEqual(["front"]);
    expect(store.listVideoJobs()[0]).toMatchObject({ billingMode: "paid", captureProtocol: "model_turn", postQaMode: "strict" });
  });

  it("replays the same idempotency request without duplicating assets or jobs", async () => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [candidate()] });

    const first = await createVirtualTryOnVideo(request, { store });
    const second = await createVirtualTryOnVideo(request, { store });

    expect(second).toEqual({ ...first, replayed: true });
    expect(store.listMaterializedAssets()).toHaveLength(3);
    expect(store.listVideoJobs()).toHaveLength(1);
  });

  it("locks the active source assets and attestations while revalidating rights", async () => {
    const expectedRights = candidate().sourceRights!;
    const forLock = vi.fn(async () => expectedRights);
    const query = {
      from: vi.fn(() => query),
      innerJoin: vi.fn(() => query),
      where: vi.fn(() => query),
      for: forLock,
    };
    const db = {
      transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        select: vi.fn(() => query),
      })),
    };
    const store = createDrizzleVirtualTryOnVideoBridgeStore(db as never);

    const valid = await store.transaction((tx) => (
      tx as unknown as {
        lockSourceRights(input: { userId: string; sourceRights: typeof expectedRights }): Promise<boolean>;
      }
    ).lockSourceRights({ userId, sourceRights: expectedRights }));

    expect(valid).toBe(true);
    expect(forLock).toHaveBeenCalledWith("update");
  });

  it("aborts before materialization when source rights are revoked while acquiring the lock", async () => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({
      candidates: [candidate()],
      sourceRightsLockValid: false,
    });

    await expect(createVirtualTryOnVideo(request, { store })).rejects.toThrow("appearance_pack_source_rights_revoked");
    expect(store.listMaterializedAssets()).toHaveLength(0);
    expect(store.listVideoJobs()).toHaveLength(0);
  });

  it("rejects reuse of an idempotency key with different video specs", async () => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [candidate()] });
    await createVirtualTryOnVideo(request, { store });

    await expect(createVirtualTryOnVideo({ ...request, durationSeconds: 32 }, { store })).rejects.toThrow("video_bridge_idempotency_mismatch");
    expect(store.listVideoJobs()).toHaveLength(1);
  });

  it.each([
    ["unlocked pack", { packStatus: "ready", lockedAt: null }, "appearance_pack_not_locked"],
    ["old pack", { packId: "pack-3" }, "appearance_pack_not_latest"],
    ["failed view QA", { qaResults: [{ scope: "view", view: "front", verdict: "fail" }] }, "appearance_pack_strict_qa_required"],
    ["revoked source rights", { sourceRights: null }, "appearance_pack_source_rights_revoked"],
    ["missing transfer metadata", { views: [{ ...candidate().views[0]!, fileSize: null }] }, "appearance_pack_asset_incomplete"],
  ])("fails closed for %s", async (_label, overrides, errorCode) => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [candidate(overrides as Partial<VirtualTryOnVideoBridgeCandidate>)] });
    await expect(createVirtualTryOnVideo(request, { store })).rejects.toThrow(errorCode as string);
    expect(store.listVideoJobs()).toHaveLength(0);
  });

  it.each([12, 40])("rejects unsupported bridge duration %s", async (durationSeconds) => {
    const store = createInMemoryVirtualTryOnVideoBridgeStore({ candidates: [candidate()] });
    await expect(createVirtualTryOnVideo({ ...request, durationSeconds }, { store })).rejects.toThrow("invalid_video_bridge_input");
  });
});
