import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { appearancePackAssets, appearancePacks, virtualTryonJobs, virtualTryonStateEvents } from "@/lib/db/schema";
import { createDownloadSignedUrl } from "@/lib/storage/presign";

import type { AppearanceView, VirtualTryOnMode } from "./config";

type DeliverableStatus = "ready" | "locked";
type OwnedView = { id: string; view: AppearanceView; status: string };
type OwnedJob = { id: string; mode: VirtualTryOnMode; status: string };
type OwnedPack = { id: string; version: number; status: string; lockedAt: Date | null };

export type VirtualTryOnBridge = {
  kind: "virtual_tryon_appearance_pack";
  appearancePackId: string;
  version: number;
  mode: VirtualTryOnMode;
  assetIds: string[];
  provenance: string;
  videoGeneration: "not_enabled";
};

export type OwnedVirtualTryOnDetail = {
  job: OwnedJob;
  pack: OwnedPack;
  views: OwnedView[];
  bridge: VirtualTryOnBridge | null;
};

export type DownloadableVirtualTryOnAsset = { id: string; view: AppearanceView; r2Key: string };

export interface VirtualTryOnOwnerStore {
  findOwnedDetail(userId: string, jobId: string): Promise<OwnedVirtualTryOnDetail | null>;
  lockReadyPack(userId: string, jobId: string, packId: string): Promise<OwnedVirtualTryOnDetail | null>;
  findDownloadableAsset(userId: string, jobId: string, assetId: string): Promise<DownloadableVirtualTryOnAsset | null>;
}

function isDeliverable(status: string): status is DeliverableStatus {
  return status === "ready" || status === "locked";
}

function detailFrom(input: {
  job: OwnedJob;
  pack: OwnedPack;
  views: OwnedView[];
  provenance: string;
}): OwnedVirtualTryOnDetail {
  const bridge = isDeliverable(input.job.status) && isDeliverable(input.pack.status)
    ? {
      kind: "virtual_tryon_appearance_pack" as const,
      appearancePackId: input.pack.id,
      version: input.pack.version,
      mode: input.job.mode,
      assetIds: input.views.map((view) => view.id),
      provenance: input.provenance,
      videoGeneration: "not_enabled" as const,
    }
    : null;
  return { job: input.job, pack: input.pack, views: input.views, bridge };
}

type InMemoryJob = OwnedJob & { userId: string; deletedAt?: Date | null };
type InMemoryPack = OwnedPack & { jobId: string };
type InMemoryAsset = OwnedView & { packId: string; r2Key: string | null; origin: string; providerTaskId?: string | null };

export function createInMemoryVirtualTryOnOwnerStore(initial: {
  jobs?: InMemoryJob[];
  packs?: InMemoryPack[];
  assets?: InMemoryAsset[];
} = {}): VirtualTryOnOwnerStore & { listStateEvents(): Array<{ virtualTryonJobId: string; fromStatus: string; toStatus: string; reason: string }> } {
  const jobs = initial.jobs ?? [];
  const packs = initial.packs ?? [];
  const assets = initial.assets ?? [];
  const events: Array<{ virtualTryonJobId: string; fromStatus: string; toStatus: string; reason: string }> = [];

  const ownedJob = (userId: string, jobId: string) => jobs.find((job) => job.id === jobId && job.userId === userId && job.deletedAt == null) ?? null;
  const currentPack = (jobId: string) => packs.filter((pack) => pack.jobId === jobId).sort((left, right) => right.version - left.version)[0] ?? null;
  const viewsFor = (packId: string) => assets.filter((asset) => asset.packId === packId).map(({ id, view, status }) => ({ id, view, status }));
  const detail = (job: InMemoryJob, pack: InMemoryPack) => detailFrom({ job: { id: job.id, mode: job.mode, status: job.status }, pack: { id: pack.id, version: pack.version, status: pack.status, lockedAt: pack.lockedAt }, views: viewsFor(pack.id), provenance: assets.find((asset) => asset.packId === pack.id)?.origin ?? "generated_apimart_gpt_image_2" });

  return {
    async findOwnedDetail(userId, jobId) {
      const job = ownedJob(userId, jobId);
      const pack = job ? currentPack(job.id) : null;
      return job && pack ? detail(job, pack) : null;
    },
    async lockReadyPack(userId, jobId, packId) {
      const job = ownedJob(userId, jobId);
      const pack = job ? packs.find((item) => item.id === packId && item.jobId === job.id) ?? null : null;
      if (!job || !pack) return null;
      if (job.status === "locked" && pack.status === "locked") return detail(job, pack);
      if (job.status !== "ready" || pack.status !== "ready") return null;
      job.status = "locked";
      pack.status = "locked";
      pack.lockedAt = new Date();
      events.push({ virtualTryonJobId: job.id, fromStatus: "ready", toStatus: "locked", reason: "appearance_pack_locked" });
      return detail(job, pack);
    },
    async findDownloadableAsset(userId, jobId, assetId) {
      const job = ownedJob(userId, jobId);
      const pack = job ? currentPack(job.id) : null;
      if (!job || !pack || !isDeliverable(job.status) || !isDeliverable(pack.status)) return null;
      const asset = assets.find((item) => item.id === assetId && item.packId === pack.id && item.r2Key);
      return asset?.r2Key ? { id: asset.id, view: asset.view, r2Key: asset.r2Key } : null;
    },
    listStateEvents: () => events,
  };
}

class LockCasLostError extends Error {}

export function createDrizzleVirtualTryOnOwnerStore(db = getDb()): VirtualTryOnOwnerStore {
  const ownedJobWhere = (userId: string, jobId: string) => and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.userId, userId), isNull(virtualTryonJobs.deletedAt));
  const readDetail = async (client: typeof db, userId: string, jobId: string) => {
    const [job] = await client.select({ id: virtualTryonJobs.id, mode: virtualTryonJobs.mode, status: virtualTryonJobs.status }).from(virtualTryonJobs).where(ownedJobWhere(userId, jobId)).limit(1);
    if (!job) return null;
    const [pack] = await client.select({ id: appearancePacks.id, version: appearancePacks.version, status: appearancePacks.status, lockedAt: appearancePacks.lockedAt }).from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, job.id)).orderBy(desc(appearancePacks.version)).limit(1);
    if (!pack) return null;
    const assets = await client.select({ id: appearancePackAssets.id, view: appearancePackAssets.view, status: appearancePackAssets.providerStatus, origin: appearancePackAssets.origin }).from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id));
    return detailFrom({ job: { id: job.id, mode: job.mode, status: job.status }, pack: { id: pack.id, version: pack.version, status: pack.status, lockedAt: pack.lockedAt }, views: assets.map(({ id, view, status }) => ({ id, view, status })), provenance: assets[0]?.origin ?? "generated_apimart_gpt_image_2" });
  };

  return {
    async findOwnedDetail(userId, jobId) {
      return readDetail(db, userId, jobId);
    },
    async lockReadyPack(userId, jobId, packId) {
      try {
        return await db.transaction(async (tx) => {
          const [job] = await tx.select({ id: virtualTryonJobs.id, mode: virtualTryonJobs.mode, status: virtualTryonJobs.status }).from(virtualTryonJobs).where(ownedJobWhere(userId, jobId)).limit(1);
          if (!job) return null;
          const [pack] = await tx.select({ id: appearancePacks.id, version: appearancePacks.version, status: appearancePacks.status, lockedAt: appearancePacks.lockedAt }).from(appearancePacks).where(and(eq(appearancePacks.id, packId), eq(appearancePacks.virtualTryonJobId, job.id))).limit(1);
          if (!pack) return null;
          const assets = await tx.select({ id: appearancePackAssets.id, view: appearancePackAssets.view, status: appearancePackAssets.providerStatus, origin: appearancePackAssets.origin }).from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id));
          if (job.status === "locked" && pack.status === "locked") return detailFrom({ job, pack, views: assets.map(({ id, view, status }) => ({ id, view, status })), provenance: assets[0]?.origin ?? "generated_apimart_gpt_image_2" });
          if (job.status !== "ready" || pack.status !== "ready") return null;
          const lockedAt = new Date();
          const [lockedPack] = await tx.update(appearancePacks).set({ status: "locked", lockedAt, updatedAt: lockedAt }).where(and(eq(appearancePacks.id, pack.id), eq(appearancePacks.virtualTryonJobId, job.id), eq(appearancePacks.status, "ready"))).returning({ id: appearancePacks.id });
          if (!lockedPack) throw new LockCasLostError();
          const [lockedJob] = await tx.update(virtualTryonJobs).set({ status: "locked", lockedBy: null, lockedUntil: null, updatedAt: lockedAt }).where(and(ownedJobWhere(userId, job.id), eq(virtualTryonJobs.status, "ready"))).returning({ id: virtualTryonJobs.id });
          if (!lockedJob) throw new LockCasLostError();
          await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: job.id, fromStatus: "ready", toStatus: "locked", reason: "appearance_pack_locked", actorType: "user", eventSnapshot: { appearancePackId: pack.id } });
          return detailFrom({ job: { ...job, status: "locked" }, pack: { ...pack, status: "locked", lockedAt }, views: assets.map(({ id, view, status }) => ({ id, view, status })), provenance: assets[0]?.origin ?? "generated_apimart_gpt_image_2" });
        });
      } catch (error) {
        if (error instanceof LockCasLostError) return null;
        throw error;
      }
    },
    async findDownloadableAsset(userId, jobId, assetId) {
      const [job] = await db.select({ id: virtualTryonJobs.id, status: virtualTryonJobs.status }).from(virtualTryonJobs).where(and(ownedJobWhere(userId, jobId), inArray(virtualTryonJobs.status, ["ready", "locked"]))).limit(1);
      if (!job) return null;
      const [pack] = await db.select({ id: appearancePacks.id }).from(appearancePacks).where(and(eq(appearancePacks.virtualTryonJobId, job.id), inArray(appearancePacks.status, ["ready", "locked"]))).orderBy(desc(appearancePacks.version)).limit(1);
      if (!pack) return null;
      const [asset] = await db.select({ id: appearancePackAssets.id, view: appearancePackAssets.view, r2Key: appearancePackAssets.r2Key }).from(appearancePackAssets).where(and(eq(appearancePackAssets.id, assetId), eq(appearancePackAssets.appearancePackId, pack.id), isNotNull(appearancePackAssets.r2Key))).limit(1);
      return asset?.r2Key ? { id: asset.id, view: asset.view, r2Key: asset.r2Key } : null;
    },
  };
}

export async function getVirtualTryOnDetail(input: { userId: string; jobId: string }, store: VirtualTryOnOwnerStore) {
  return store.findOwnedDetail(input.userId, input.jobId);
}

export async function lockVirtualTryOnPack(input: { userId: string; jobId: string; packId: string }, store: VirtualTryOnOwnerStore) {
  const pack = await store.lockReadyPack(input.userId, input.jobId, input.packId);
  if (!pack) throw new Error("appearance_pack_not_lockable");
  return pack;
}

export async function createVirtualTryOnDownload(input: { userId: string; jobId: string; assetId: string }, store: VirtualTryOnOwnerStore, signer = createDownloadSignedUrl) {
  const asset = await store.findDownloadableAsset(input.userId, input.jobId, input.assetId);
  if (!asset) throw new Error("appearance_pack_asset_not_found");
  return signer({ key: asset.r2Key, filename: "appearance-pack-" + asset.view + ".png", expiresIn: 300 });
}

export async function createVirtualTryOnPreview(input: { userId: string; jobId: string; assetId: string }, store: VirtualTryOnOwnerStore, signer = createDownloadSignedUrl) {
  const asset = await store.findDownloadableAsset(input.userId, input.jobId, input.assetId);
  if (!asset) throw new Error("appearance_pack_asset_not_found");
  return signer({ key: asset.r2Key, expiresIn: 300 });
}
