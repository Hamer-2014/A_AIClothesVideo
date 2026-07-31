import { captureReservedCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { transferRemoteFileToR2 } from "@/lib/storage/transfer";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appearancePackAssets, appearancePacks, virtualTryonJobs } from "@/lib/db/schema";
import type { AppearanceView, VirtualTryOnMode } from "./config";
import { finalizeAppearancePack } from "./service";
import { retryDecision } from "./retry";

export type RuntimeAsset = { view: AppearanceView; providerTaskId: string | null; providerStatus: "pending" | "queued" | "running" | "succeeded" | "failed"; attemptCount: number; r2Key: string | null; lastErrorCode?: string | null; nextRetryAt?: Date | null; outputUrl?: string | null };
export type RuntimeJob = { id: string; packId: string; userId: string; mode: VirtualTryOnMode; status: string; creditCost: number; lockedUntil: Date | null; assets: RuntimeAsset[] };
type RuntimeStatus = "generating" | "ready" | "recovering_release" | "failed_released" | "failed_refunded";
export interface RuntimeStore { acquire(workerId: string, now: Date): Promise<RuntimeJob | null>; saveAsset(jobId: string, asset: RuntimeAsset): Promise<void>; setStatus(jobId: string, status: RuntimeStatus, error?: string): Promise<void>; releaseLease(jobId: string, workerId: string): Promise<void>; scheduleRetry(jobId: string, retryAt: Date): Promise<void>; }

export function createDrizzleVirtualTryOnRuntimeStore(db = getDb()): RuntimeStore {
  return {
    async acquire(workerId, now) {
      const [candidate] = await db.select().from(virtualTryonJobs).where(and(or(eq(virtualTryonJobs.status, "queued"), eq(virtualTryonJobs.status, "generating"), eq(virtualTryonJobs.status, "qa_queued")), or(isNull(virtualTryonJobs.nextRetryAt), lte(virtualTryonJobs.nextRetryAt, now)), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)), isNull(virtualTryonJobs.deletedAt))).orderBy(virtualTryonJobs.createdAt).limit(1);
      if (!candidate) return null;
      const [locked] = await db.update(virtualTryonJobs).set({ lockedBy: workerId, lockedUntil: new Date(now.getTime() + 60_000), attemptCount: candidate.attemptCount + 1 }).where(and(eq(virtualTryonJobs.id, candidate.id), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)))).returning();
      if (!locked) return null;
      const [pack] = await db.select().from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, locked.id)).limit(1); if (!pack) throw new Error("virtual_tryon_pack_missing");
      const rows = await db.select().from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id));
      return { id: locked.id, packId: pack.id, userId: locked.userId, mode: locked.mode, status: locked.status, creditCost: locked.creditCost, lockedUntil: locked.lockedUntil, assets: rows.map((item) => ({ view: item.view, providerTaskId: item.providerTaskId, providerStatus: item.providerStatus as RuntimeAsset["providerStatus"], attemptCount: item.attemptCount, r2Key: item.r2Key, lastErrorCode: item.lastErrorCode, nextRetryAt: item.nextRetryAt })) };
    },
    async saveAsset(jobId, asset) { const [pack] = await db.select({ id: appearancePacks.id }).from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, jobId)).limit(1); if (!pack) throw new Error("virtual_tryon_pack_missing"); await db.update(appearancePackAssets).set({ providerTaskId: asset.providerTaskId, providerStatus: asset.providerStatus, attemptCount: asset.attemptCount, r2Key: asset.r2Key, lastErrorCode: asset.lastErrorCode ?? null, nextRetryAt: asset.nextRetryAt ?? null, updatedAt: new Date() }).where(and(eq(appearancePackAssets.appearancePackId, pack.id), eq(appearancePackAssets.view, asset.view))); },
    async setStatus(jobId, status, error) { await db.update(virtualTryonJobs).set({ status, lastError: error ?? null, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(eq(virtualTryonJobs.id, jobId)); },
    async releaseLease(jobId, workerId) { await db.update(virtualTryonJobs).set({ lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId))); },
    async scheduleRetry(jobId, retryAt) { await db.update(virtualTryonJobs).set({ nextRetryAt: retryAt, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(eq(virtualTryonJobs.id, jobId)); },
  };
}

export async function runVirtualTryOnTick(input: { workerId: string; store: RuntimeStore; credits: CreditLedgerStore; submit: (view: AppearanceView) => Promise<string>; poll: (taskId: string) => Promise<{ status: RuntimeAsset["providerStatus"]; outputUrl: string | null }>; qa: (job: RuntimeJob) => Promise<boolean>; transfer?: typeof transferRemoteFileToR2; now?: Date }) {
  const job = await input.store.acquire(input.workerId, input.now ?? new Date()); if (!job) return { processed: 0, action: "idle" as const };
  const order: AppearanceView[] = job.mode === "front_only" ? ["front"] : ["front", "side", "back"];
  const asset = order.map((view) => job.assets.find((item) => item.view === view)).find((item) => item && !item.r2Key);
  try {
    if (asset) {
      if (!asset.providerTaskId) { asset.providerTaskId = await input.submit(asset.view); asset.providerStatus = "queued"; asset.attemptCount += 1; await input.store.saveAsset(job.id, asset); await input.store.setStatus(job.id, "generating"); return { processed: 1, action: "submit" as const }; }
      const polled = await input.poll(asset.providerTaskId); asset.providerStatus = polled.status; asset.outputUrl = polled.outputUrl;
      if (polled.status === "failed") throw new Error("provider_failed");
      if (polled.status !== "succeeded" || !polled.outputUrl) { await input.store.saveAsset(job.id, asset); return { processed: 1, action: "poll" as const }; }
      const key = "virtual-tryon/" + job.id + "/packs/" + job.packId + "/" + asset.view + ".png"; await (input.transfer ?? transferRemoteFileToR2)({ url: polled.outputUrl, key }); asset.r2Key = key; asset.outputUrl = null; await input.store.saveAsset(job.id, asset); return { processed: 1, action: "transfer" as const };
    }
    const passed = await input.qa(job); if (!passed) throw new Error("strict_qa_not_passed");
    await finalizeAppearancePack({ jobId: job.id, packId: job.packId, mode: job.mode, r2Keys: Object.fromEntries(job.assets.filter((item) => item.r2Key).map((item) => [item.view, item.r2Key])), viewPasses: order.map(() => true), crossViewPass: job.mode === "front_only" || passed }, { capture: async ({ idempotencyKey }) => { await captureReservedCredits({ store: input.credits, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_capture", relatedJobId: job.id, idempotencyKey }); } });
    await input.store.setStatus(job.id, "ready"); return { processed: 1, action: "ready" as const };
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : error instanceof Error ? error.message : "worker_failed";
    const decision = retryDecision({ code, attemptCount: asset?.attemptCount ?? 0, now: input.now ?? new Date() });
    if (asset && decision.retry) { asset.attemptCount += 1; asset.lastErrorCode = decision.errorCode ?? code; asset.nextRetryAt = decision.nextRetryAt; asset.providerStatus = asset.providerTaskId ? "running" : "pending"; await input.store.saveAsset(job.id, asset); await input.store.scheduleRetry(job.id, decision.nextRetryAt); return { processed: 1, action: "retry" as const }; }
    await input.store.setStatus(job.id, "recovering_release", code); return { processed: 1, action: "failed" as const };
  } finally { await input.store.releaseLease(job.id, input.workerId); }
}
