import { describe, expect, it, vi } from "vitest";

import {
  createInMemoryVirtualTryOnOwnerStore,
  createDrizzleVirtualTryOnOwnerStore,
  createVirtualTryOnDownload,
  createVirtualTryOnPreview,
  getVirtualTryOnDetail,
  lockVirtualTryOnPack,
} from "./owner";

function store() {
  return createInMemoryVirtualTryOnOwnerStore({
    jobs: [
      { id: "job", userId: "owner", mode: "front_only", status: "ready" },
      { id: "other-job", userId: "owner", mode: "front_only", status: "ready" },
      { id: "other-owner-job", userId: "other", mode: "front_only", status: "ready" },
    ],
    packs: [
      { id: "pack", jobId: "job", version: 1, status: "ready", lockedAt: null },
      { id: "other-pack", jobId: "other-job", version: 1, status: "ready", lockedAt: null },
      { id: "other-owner-pack", jobId: "other-owner-job", version: 1, status: "ready", lockedAt: null },
    ],
    assets: [
      { id: "asset", packId: "pack", view: "front", status: "succeeded", r2Key: "virtual-try-on/job/packs/pack/front.png", origin: "generated_apimart_gpt_image_2", providerTaskId: "private-task" },
      { id: "other-job-asset", packId: "other-pack", view: "front", status: "succeeded", r2Key: "virtual-try-on/other/packs/other-pack/front.png", origin: "generated_apimart_gpt_image_2" },
    ],
  });
}

describe("virtual try-on owner delivery", () => {
  it("returns a redacted owner detail and ready bridge without R2 or provider data", async () => {
    const result = await getVirtualTryOnDetail({ userId: "owner", jobId: "job" }, store());

    expect(result).toEqual({
      job: { id: "job", mode: "front_only", status: "ready", queueHealth: "normal" },
      pack: { id: "pack", version: 1, status: "ready", lockedAt: null },
      views: [{ id: "asset", view: "front", status: "succeeded" }],
      bridge: { kind: "virtual_tryon_appearance_pack", appearancePackId: "pack", version: 1, mode: "front_only", provenance: "generated_apimart_gpt_image_2", videoGeneration: "requires_lock" },
    });
    expect(JSON.stringify(result)).not.toMatch(/r2Key|providerTaskId|virtual-try-on\//);
  });

  it("reports an old queued job that no worker has claimed as delayed", async () => {
    const ownerStore = createInMemoryVirtualTryOnOwnerStore({
      jobs: [{
        id: "job",
        userId: "owner",
        mode: "front_only",
        status: "queued",
        attemptCount: 0,
        updatedAt: new Date("2020-01-01T00:00:00.000Z"),
      }],
      packs: [{ id: "pack", jobId: "job", version: 1, status: "draft", lockedAt: null }],
      assets: [{ id: "asset", packId: "pack", view: "front", status: "pending", r2Key: null, origin: "generated_apimart_gpt_image_2" }],
    });

    const result = await getVirtualTryOnDetail({ userId: "owner", jobId: "job" }, ownerStore);

    expect(result?.job.queueHealth).toBe("delayed");
    expect(JSON.stringify(result)).not.toMatch(/attemptCount|updatedAt|lockedBy|cron/i);
  });

  it("returns null for a missing or other owner job", async () => {
    const ownerStore = store();
    await expect(getVirtualTryOnDetail({ userId: "other", jobId: "job" }, ownerStore)).resolves.toBeNull();
    await expect(getVirtualTryOnDetail({ userId: "owner", jobId: "missing" }, ownerStore)).resolves.toBeNull();
  });

  it("immediately blocks detail, lock and download when source delivery authorization is revoked", async () => {
    const ownerStore = createInMemoryVirtualTryOnOwnerStore({
      jobs: [{ id: "job", userId: "owner", mode: "front_only", status: "ready", sourceAuthorized: false }],
      packs: [{ id: "pack", jobId: "job", version: 1, status: "ready", lockedAt: null }],
      assets: [{ id: "asset", packId: "pack", view: "front", status: "succeeded", r2Key: "key", origin: "generated_apimart_gpt_image_2" }],
    });
    await expect(getVirtualTryOnDetail({ userId: "owner", jobId: "job" }, ownerStore)).resolves.toBeNull();
    await expect(lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "pack" }, ownerStore)).rejects.toThrow("appearance_pack_not_lockable");
    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "asset" }, ownerStore)).rejects.toThrow("appearance_pack_asset_not_found");
  });

  it("uses only the latest pack version for lock and download", async () => {
    const ownerStore = createInMemoryVirtualTryOnOwnerStore({
      jobs: [{ id: "job", userId: "owner", mode: "front_only", status: "ready" }],
      packs: [{ id: "v1", jobId: "job", version: 1, status: "ready", lockedAt: null }, { id: "v2", jobId: "job", version: 2, status: "ready", lockedAt: null }],
      assets: [{ id: "v1-asset", packId: "v1", view: "front", status: "succeeded", r2Key: "v1-key", origin: "generated" }, { id: "v2-asset", packId: "v2", view: "front", status: "succeeded", r2Key: "v2-key", origin: "generated" }],
    });
    await expect(lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "v1" }, ownerStore)).rejects.toThrow("appearance_pack_not_lockable");
    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "v1-asset" }, ownerStore)).rejects.toThrow("appearance_pack_asset_not_found");
    await expect(lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "v2" }, ownerStore)).resolves.toMatchObject({ pack: { id: "v2", status: "locked" } });
  });

  it("gates the video bridge until both job and pack are deliverable", async () => {
    const ownerStore = createInMemoryVirtualTryOnOwnerStore({
      jobs: [{ id: "job", userId: "owner", mode: "front_only", status: "generating" }],
      packs: [{ id: "pack", jobId: "job", version: 1, status: "ready", lockedAt: null }],
      assets: [{ id: "asset", packId: "pack", view: "front", status: "succeeded", r2Key: "key", origin: "generated_apimart_gpt_image_2" }],
    });

    expect((await getVirtualTryOnDetail({ userId: "owner", jobId: "job" }, ownerStore))?.bridge).toBeNull();
  });

  it("rejects an asset from another job and any non-ready asset", async () => {
    const ownerStore = store();
    const signer = vi.fn();
    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "other-job-asset" }, ownerStore, signer)).rejects.toThrow("appearance_pack_asset_not_found");
    expect(signer).not.toHaveBeenCalled();

    const pendingStore = createInMemoryVirtualTryOnOwnerStore({
      jobs: [{ id: "job", userId: "owner", mode: "front_only", status: "queued" }],
      packs: [{ id: "pack", jobId: "job", version: 1, status: "generating", lockedAt: null }],
      assets: [{ id: "asset", packId: "pack", view: "front", status: "pending", r2Key: "key", origin: "generated_apimart_gpt_image_2" }],
    });
    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "asset" }, pendingStore, signer)).rejects.toThrow("appearance_pack_asset_not_found");
  });

  it("signs a ready or locked owned asset for no more than five minutes", async () => {
    const ownerStore = store();
    const signer = vi.fn(async () => "https://download.example/signed");

    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "asset" }, ownerStore, signer)).resolves.toBe("https://download.example/signed");
    expect(signer).toHaveBeenCalledWith({ key: "virtual-try-on/job/packs/pack/front.png", filename: "appearance-pack-front.png", expiresIn: 300 });
    await lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "pack" }, ownerStore);
    await expect(createVirtualTryOnDownload({ userId: "owner", jobId: "job", assetId: "asset" }, ownerStore, signer)).resolves.toBe("https://download.example/signed");
  });

  it("signs a preview only after the same owner delivery check without attachment naming", async () => {
    const signer = vi.fn(async () => "https://preview.example/signed");
    await expect(createVirtualTryOnPreview({ userId: "owner", jobId: "job", assetId: "asset" }, store(), signer)).resolves.toBe("https://preview.example/signed");
    expect(signer).toHaveBeenCalledWith({ key: "virtual-try-on/job/packs/pack/front.png", expiresIn: 300 });
  });

  it("locks only the matching ready pack and makes repeated locks idempotent", async () => {
    const ownerStore = store();
    await expect(lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "other-pack" }, ownerStore)).rejects.toThrow("appearance_pack_not_lockable");

    const first = await lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "pack" }, ownerStore);
    const duplicate = await lockVirtualTryOnPack({ userId: "owner", jobId: "job", packId: "pack" }, ownerStore);
    expect(first.pack.status).toBe("locked");
    expect(first.bridge?.videoGeneration).toBe("enabled");
    expect(duplicate.pack.status).toBe("locked");
    expect(first.views).toEqual([{ id: "asset", view: "front", status: "succeeded" }]);
    expect(ownerStore.listStateEvents()).toHaveLength(1);
    expect(ownerStore.listStateEvents()[0]).toMatchObject({ fromStatus: "ready", toStatus: "locked", reason: "appearance_pack_locked" });
  });

  it("writes both locked states and the state event only after both Drizzle CAS updates succeed", async () => {
    const updates: Array<Record<string, unknown>> = [];
    const events: unknown[] = [];
    const rows = [
      [{ id: "job", mode: "front_only", status: "ready", sourceSnapshot: { sources: { front: { assetId: "source-asset" } } }, rightsSnapshot: { sources: { front: { attestationId: "attestation" } } } }],
      [{ assetId: "source-asset", attestationId: "attestation" }],
      [{ id: "pack" }],
      [{ id: "pack", version: 1, status: "ready", lockedAt: null }],
      [{ id: "asset", view: "front", status: "succeeded", origin: "generated_apimart_gpt_image_2" }],
    ];
    const result = (value: unknown[]) => {
      const promise = Promise.resolve(value) as Promise<unknown[]> & { limit: () => Promise<unknown[]>; orderBy: () => Promise<unknown[]> };
      promise.limit = async () => value;
      promise.orderBy = () => promise;
      return promise;
    };
    const tx = {
      select: () => ({ from: () => ({ innerJoin: () => ({ innerJoin: () => ({ where: () => result(rows.shift() ?? []) }) }), where: () => result(rows.shift() ?? []) }) }),
      update: () => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => ({ returning: async () => [{ id: "locked" }] }) }; } }),
      insert: () => ({ values: async (value: unknown) => { events.push(value); } }),
    };
    const db = { transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const ownerStore = createDrizzleVirtualTryOnOwnerStore(db as unknown as Parameters<typeof createDrizzleVirtualTryOnOwnerStore>[0]);

    await expect(ownerStore.lockReadyPack("owner", "job", "pack")).resolves.toMatchObject({ pack: { status: "locked" } });
    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "locked", lockedAt: expect.any(Date) }),
      expect.objectContaining({ status: "locked", lockedBy: null, lockedUntil: null }),
    ]));
    expect(events).toHaveLength(1);
  });

  it("returns null without an event when a Drizzle lock CAS loses the race", async () => {
    const events: unknown[] = [];
    const rows = [
      [{ id: "job", mode: "front_only", status: "ready" }],
      [{ id: "pack", version: 1, status: "ready", lockedAt: null }],
      [],
    ];
    const result = (value: unknown[]) => {
      const promise = Promise.resolve(value) as Promise<unknown[]> & { limit: () => Promise<unknown[]> };
      promise.limit = async () => value;
      return promise;
    };
    const tx = {
      select: () => ({ from: () => ({ where: () => result(rows.shift() ?? []) }) }),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [] }) }) }),
      insert: () => ({ values: async (value: unknown) => { events.push(value); } }),
    };
    const db = { transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const ownerStore = createDrizzleVirtualTryOnOwnerStore(db as unknown as Parameters<typeof createDrizzleVirtualTryOnOwnerStore>[0]);

    await expect(ownerStore.lockReadyPack("owner", "job", "pack")).resolves.toBeNull();
    expect(events).toEqual([]);
  });
});
