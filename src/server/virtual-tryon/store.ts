import { and, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { appearancePackAssets, appearancePacks, assetRightsAttestations, assets, rightsAttestations, virtualTryonJobs, virtualTryonStateEvents } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";

import type { AppearanceView, VirtualTryOnMode } from "./config";

export type SourceAsset = { id: string; originalKey: string; detectedRole: "front" | "back" | "detail" | "side" | "scene" | "logo" | "unknown" | null; rightsAttestationId: string; rightsAttestationVersion: string; rightsAttestationAcceptedAt: Date };
export type TryOnJob = { id: string; userId: string; mode: VirtualTryOnMode; status: string; isTest: boolean; creditCost: number; createIdempotencyKey: string; sourceSnapshot: JsonValue; rightsSnapshot: JsonValue; reservedLedgerId?: string | null; lastError?: string | null; nextRetryAt?: Date | null };
export type TryOnPack = { id: string; virtualTryonJobId: string; status: string; requiredViews: AppearanceView[] };
export type VirtualTryOnStateEvent = { virtualTryonJobId: string; fromStatus: string | null; toStatus: string; reason: string; eventSnapshot: JsonValue | null };

export interface VirtualTryOnStore {
  findOwnedSources(input: { userId: string; assetIds: string[] }): Promise<SourceAsset[]>;
  findByIdempotency(input: { userId: string; key: string }): Promise<{ job: TryOnJob; pack: TryOnPack } | null>;
  createJobAndPack(input: { userId: string; mode: VirtualTryOnMode; skuName?: string; isTest?: boolean; key: string; creditCost: number; requiredViews: AppearanceView[]; sourceSnapshot: JsonValue; modelSnapshot: JsonValue; rightsSnapshot: JsonValue }): Promise<{ job: TryOnJob; pack: TryOnPack }>;
  queueDraft(input: { jobId: string; reservedLedgerId: string }): Promise<boolean>;
  failDraft(input: { jobId: string; error: string }): Promise<boolean>;
  scheduleDraftRetry(input: { jobId: string; error: string; nextRetryAt: Date }): Promise<boolean>;
}

function packResult(job: TryOnJob, pack: TryOnPack) {
  return { job, pack };
}

export function createInMemoryVirtualTryOnStore(initial: { sources?: Array<SourceAsset & { userId: string; rightsAttestationRedactedAt?: Date | null }>; jobs?: TryOnJob[] } = {}): VirtualTryOnStore & { listJobs(): TryOnJob[]; listStateEvents(): VirtualTryOnStateEvent[] } {
  const sources = initial.sources ?? [];
  const jobs = initial.jobs ?? [];
  const packs: TryOnPack[] = [];
  const events: VirtualTryOnStateEvent[] = [];
  return {
    async findOwnedSources({ userId, assetIds }) {
      return sources.filter((item) => item.userId === userId && assetIds.includes(item.id) && Boolean(item.rightsAttestationId) && item.rightsAttestationVersion === "image_rights_v1" && item.rightsAttestationAcceptedAt instanceof Date && item.rightsAttestationRedactedAt == null).map(({ userId: _userId, rightsAttestationRedactedAt: _redactedAt, ...item }) => item);
    },
    async findByIdempotency({ userId, key }) {
      const job = jobs.find((item) => item.userId === userId && item.createIdempotencyKey === key);
      const pack = job ? packs.find((item) => item.virtualTryonJobId === job.id) : null;
      return job && pack ? packResult(job, pack) : null;
    },
    async createJobAndPack(input) {
      const existing = jobs.find((item) => item.userId === input.userId && item.createIdempotencyKey === input.key);
      if (existing) {
        const pack = packs.find((item) => item.virtualTryonJobId === existing.id);
        if (!pack) throw new Error("virtual_tryon_idempotency_conflict");
        return packResult(existing, pack);
      }
      const job: TryOnJob = { id: crypto.randomUUID(), userId: input.userId, mode: input.mode, status: "draft", isTest: input.isTest ?? false, creditCost: input.creditCost, createIdempotencyKey: input.key, sourceSnapshot: input.sourceSnapshot, rightsSnapshot: input.rightsSnapshot, reservedLedgerId: null, lastError: null, nextRetryAt: null };
      const pack: TryOnPack = { id: crypto.randomUUID(), virtualTryonJobId: job.id, status: "draft", requiredViews: input.requiredViews };
      jobs.push(job);
      packs.push(pack);
      return packResult(job, pack);
    },
    async queueDraft({ jobId, reservedLedgerId }) {
      const job = jobs.find((item) => item.id === jobId);
      if (!job || job.status !== "draft") return false;
      job.status = "queued";
      job.reservedLedgerId = reservedLedgerId;
      job.lastError = null;
      job.nextRetryAt = null;
      events.push({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "queued", reason: "reserve_succeeded", eventSnapshot: { reservedLedgerId } });
      return true;
    },
    async failDraft({ jobId, error }) {
      const job = jobs.find((item) => item.id === jobId);
      if (!job || job.status !== "draft") return false;
      job.status = "failed_unreserved";
      job.lastError = error;
      events.push({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "failed_unreserved", reason: "reserve_failed", eventSnapshot: null });
      return true;
    },
    async scheduleDraftRetry({ jobId, error, nextRetryAt }) {
      const job = jobs.find((item) => item.id === jobId);
      if (!job || job.status !== "draft") return false;
      job.lastError = error;
      job.nextRetryAt = nextRetryAt;
      return true;
    },
    listJobs: () => jobs,
    listStateEvents: () => events,
  };
}

export function createDrizzleVirtualTryOnStore(db = getDb()): VirtualTryOnStore {
  return {
    async findOwnedSources({ userId, assetIds }) {
      if (!assetIds.length) return [];
      return db.selectDistinctOn([assets.id], { id: assets.id, originalKey: assets.originalKey, detectedRole: assets.detectedRole, rightsAttestationId: assetRightsAttestations.rightsAttestationId, rightsAttestationVersion: rightsAttestations.version, rightsAttestationAcceptedAt: rightsAttestations.acceptedAt }).from(assets).innerJoin(assetRightsAttestations, eq(assets.id, assetRightsAttestations.assetId)).innerJoin(rightsAttestations, eq(assetRightsAttestations.rightsAttestationId, rightsAttestations.id)).where(and(eq(assets.userId, userId), inArray(assets.id, assetIds), inArray(assets.status, ["uploaded", "ready"]), isNull(assets.deletedAt), eq(rightsAttestations.userId, userId), eq(rightsAttestations.version, "image_rights_v1"), isNull(rightsAttestations.redactedAt))).orderBy(assets.id, desc(rightsAttestations.acceptedAt));
    },
    async findByIdempotency({ userId, key }) {
      const [job] = await db.select().from(virtualTryonJobs).where(and(eq(virtualTryonJobs.userId, userId), eq(virtualTryonJobs.createIdempotencyKey, key), isNull(virtualTryonJobs.deletedAt))).limit(1);
      if (!job) return null;
      const [pack] = await db.select().from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, job.id)).limit(1);
      return pack ? packResult(job as TryOnJob, { ...pack, requiredViews: pack.requiredViews as AppearanceView[] }) : null;
    },
    async createJobAndPack(input) {
      return db.transaction(async (tx) => {
        const [inserted] = await tx.insert(virtualTryonJobs).values({ userId: input.userId, mode: input.mode, status: "draft", skuName: input.skuName ?? null, isTest: input.isTest ?? false, createIdempotencyKey: input.key, creditCost: input.creditCost, sourceSnapshot: input.sourceSnapshot, modelSnapshot: input.modelSnapshot, rightsSnapshot: input.rightsSnapshot }).onConflictDoNothing({ target: [virtualTryonJobs.userId, virtualTryonJobs.createIdempotencyKey] }).returning();
        const job = inserted ?? (await tx.select().from(virtualTryonJobs).where(and(eq(virtualTryonJobs.userId, input.userId), eq(virtualTryonJobs.createIdempotencyKey, input.key), isNull(virtualTryonJobs.deletedAt))).limit(1))[0];
        if (!job) throw new Error("virtual_tryon_idempotency_conflict");
        if (!inserted) {
          const [pack] = await tx.select().from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, job.id)).limit(1);
          if (!pack) throw new Error("virtual_tryon_idempotency_conflict");
          return packResult(job as TryOnJob, { ...pack, requiredViews: pack.requiredViews as AppearanceView[] });
        }
        const [pack] = await tx.insert(appearancePacks).values({ virtualTryonJobId: job.id, version: 1, requiredViews: input.requiredViews, status: "draft" }).returning();
        if (!pack) throw new Error("virtual_tryon_pack_create_failed");
        await tx.insert(appearancePackAssets).values(input.requiredViews.map((view) => ({ appearancePackId: pack.id, view, provenance: { kind: "derived_ai_model" } })));
        return packResult(job as TryOnJob, { ...pack, requiredViews: input.requiredViews });
      });
    },
    async queueDraft({ jobId, reservedLedgerId }) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "queued", reservedLedgerId, lastError: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.status, "draft"))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "queued", reason: "reserve_succeeded", eventSnapshot: { reservedLedgerId } });
        return true;
      });
    },
    async failDraft({ jobId, error }) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_unreserved", lastError: error, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.status, "draft"))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "failed_unreserved", reason: "reserve_failed" });
        return true;
      });
    },
    async scheduleDraftRetry({ jobId, error, nextRetryAt }) {
      const [job] = await db.update(virtualTryonJobs).set({ lastError: error, nextRetryAt, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.status, "draft"))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
  };
}
