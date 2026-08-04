import { captureReservedCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { appearancePackAssets, appearancePacks, virtualTryonJobs, virtualTryonStateEvents } from "@/lib/db/schema";
import { createAPIMartImageGeneration, pollAPIMartImageTask } from "@/lib/providers/apimart/image";
import { createDrizzleProviderCallLogStore, type ProviderCallLogStore } from "@/lib/providers/log-call";
import { createVisionVirtualTryOnQa } from "@/lib/providers/vision/client";
import { createDownloadSignedUrl } from "@/lib/storage/presign";
import { and, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type { AppearanceView, VirtualTryOnMode } from "./config";
import { runVirtualTryOnQa } from "./qa";
import { createDrizzleVirtualTryOnQaStore, type VirtualTryOnQaStore } from "./qa-store";
import { createVirtualTryOnGenerationProvider } from "./generation-provider";
import { transferVirtualTryOnImageToR2 } from "./transfer";

export type RuntimeAsset = { view: AppearanceView; providerTaskId: string | null; providerStatus: "pending" | "queued" | "running" | "succeeded" | "failed"; attemptCount: number; submitAttemptCount?: number; pollFailureCount?: number; deliveryFailureCount?: number; r2Key: string | null; mimeType?: string | null; fileSize?: number | null; lastErrorCode?: string | null; nextRetryAt?: Date | null; outputUrl?: string | null };
export type RuntimeStatus = "queued" | "generating" | "qa_queued" | "capturing" | "ready" | "recovering_release" | "recovering_refund" | "failed_released" | "failed_refunded";
export type RuntimeJob = { id: string; packId: string; userId: string; mode: VirtualTryOnMode; status: RuntimeStatus; creditCost: number; lockedUntil: Date | null; sourceKeys: Partial<Record<"front" | "back" | "detail", string>>; modelKeys: Record<AppearanceView, string>; assets: RuntimeAsset[]; deliveryPersistAttemptCount?: number };
export type QaRunner = (job: RuntimeJob) => Promise<{ allPassed: boolean }>;
type VirtualTryOnQaDeps = Parameters<typeof runVirtualTryOnQa>[1];

export interface RuntimeStore {
  acquire(workerId: string, now: Date): Promise<RuntimeJob | null>;
  renewLease(jobId: string, workerId: string, now: Date): Promise<boolean>;
  saveAsset(jobId: string, workerId: string, asset: RuntimeAsset): Promise<boolean>;
  transitionToGenerating(jobId: string, workerId: string, expectedStatus: "queued" | "generating"): Promise<boolean>;
  transitionAssetsReadyToQaQueued(jobId: string, packId: string, workerId: string): Promise<boolean>;
  resolveQa(jobId: string, packId: string, workerId: string, passed: boolean): Promise<boolean>;
  finalizeCapturedPack(jobId: string, packId: string, workerId: string, capturedLedgerId: string): Promise<boolean>;
  scheduleCapturePersistenceRetry(jobId: string, workerId: string, error: string, retryAt: Date): Promise<"retry" | "recovering_refund" | "lost_lease">;
  transitionCaptureToRefund(jobId: string, workerId: string, error: string): Promise<boolean>;
  transitionToRecoveringRelease(jobId: string, workerId: string, expectedStatus: "queued" | "generating", error: string): Promise<boolean>;
  scheduleRetry(jobId: string, workerId: string, retryAt: Date): Promise<boolean>;
  releaseLease(jobId: string, workerId: string): Promise<boolean>;
}

export function createDefaultVirtualTryOnRuntimeDeps(input: {
  credits: CreditLedgerStore;
  store?: RuntimeStore;
  signer?: (input: { key: string; expiresIn: number }) => Promise<string>;
  imageClient?: typeof createAPIMartImageGeneration;
  pollClient?: typeof pollAPIMartImageTask;
  providerLogStore?: ProviderCallLogStore;
  transfer?: typeof transferVirtualTryOnImageToR2;
  qaStore?: VirtualTryOnQaStore;
  visionProvider?: VirtualTryOnQaDeps["visionProvider"];
}) {
  const signer = input.signer ?? ((request: { key: string; expiresIn: number }) => createDownloadSignedUrl(request));
  const providerLogStore = input.providerLogStore ?? createDrizzleProviderCallLogStore();
  const provider = createVirtualTryOnGenerationProvider({
    signer,
    imageClient: input.imageClient,
    pollClient: input.pollClient,
    providerLogStore,
  });
  return {
    credits: input.credits,
    store: input.store ?? createDrizzleVirtualTryOnRuntimeStore(),
    submit: provider.submit,
    poll: provider.poll,
    transfer: input.transfer ?? transferVirtualTryOnImageToR2,
    qaDeps: {
      signer: (key: string) => signer({ key, expiresIn: 300 }),
      qaStore: input.qaStore ?? createDrizzleVirtualTryOnQaStore(),
      providerLogStore,
      visionProvider: input.visionProvider ?? createVisionVirtualTryOnQa,
    },
  };
}

function sourceKeysFromSnapshot(snapshot: unknown): RuntimeJob["sourceKeys"] {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return {};
  const sources = (snapshot as { sources?: unknown }).sources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)) return {};
  return Object.fromEntries(["front", "back", "detail"].flatMap((role) => {
    const item = (sources as Record<string, unknown>)[role];
    return item && typeof item === "object" && typeof (item as { key?: unknown }).key === "string" ? [[role, (item as { key: string }).key]] : [];
  }));
}

export function parseRuntimeModelKeys(snapshot: unknown): RuntimeJob["modelKeys"] | null {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const values = snapshot as Record<string, unknown>;
  const keys = ["front", "side", "back"] as const;
  if (!keys.every((view) => typeof values[view] === "string" && values[view].trim().length > 0)) return null;
  return { front: values.front as string, side: values.side as string, back: values.back as string };
}

export function createDrizzleVirtualTryOnRuntimeStore(db = getDb()): RuntimeStore {
  const held = async (jobId: string, workerId: string, statuses: RuntimeStatus[]) => {
    const [job] = await db.select({ id: virtualTryonJobs.id }).from(virtualTryonJobs).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), inArray(virtualTryonJobs.status, statuses))).limit(1);
    return Boolean(job);
  };
  return {
    async acquire(workerId, now) {
      const runnable: RuntimeStatus[] = ["queued", "generating", "qa_queued", "capturing"];
      const [candidate] = await db.select().from(virtualTryonJobs).where(and(inArray(virtualTryonJobs.status, runnable), or(isNull(virtualTryonJobs.nextRetryAt), lte(virtualTryonJobs.nextRetryAt, now)), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)), isNull(virtualTryonJobs.deletedAt))).orderBy(virtualTryonJobs.createdAt).limit(1);
      if (!candidate) return null;
      const [locked] = await db.update(virtualTryonJobs).set({ lockedBy: workerId, lockedUntil: new Date(now.getTime() + 60_000), attemptCount: candidate.attemptCount + 1 }).where(and(eq(virtualTryonJobs.id, candidate.id), eq(virtualTryonJobs.status, candidate.status), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)))).returning();
      if (!locked) return null;
      const [pack] = await db.select().from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, locked.id)).orderBy(desc(appearancePacks.version)).limit(1);
      if (!pack) throw new Error("virtual_tryon_pack_missing");
      const rows = await db.select().from(appearancePackAssets).where(eq(appearancePackAssets.appearancePackId, pack.id));
      const modelKeys = parseRuntimeModelKeys(locked.modelSnapshot);
      if (!modelKeys) {
        await db.transaction(async (tx) => {
          const [failed] = await tx.update(virtualTryonJobs).set({ status: "recovering_release", lastError: "virtual_tryon_model_keys_invalid", lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, locked.id), eq(virtualTryonJobs.lockedBy, workerId), inArray(virtualTryonJobs.status, runnable))).returning({ id: virtualTryonJobs.id });
          if (failed) await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: locked.id, fromStatus: locked.status, toStatus: "recovering_release", reason: "virtual_tryon_model_keys_invalid" });
        });
        return null;
      }
      return { id: locked.id, packId: pack.id, userId: locked.userId, mode: locked.mode, status: locked.status as RuntimeStatus, creditCost: locked.creditCost, lockedUntil: locked.lockedUntil, sourceKeys: sourceKeysFromSnapshot(locked.sourceSnapshot), modelKeys, deliveryPersistAttemptCount: locked.deliveryPersistAttemptCount, assets: rows.map((item) => ({ view: item.view, providerTaskId: item.providerTaskId, providerStatus: item.providerStatus as RuntimeAsset["providerStatus"], attemptCount: item.attemptCount, submitAttemptCount: item.submitAttemptCount, pollFailureCount: item.pollFailureCount, deliveryFailureCount: item.deliveryFailureCount, r2Key: item.r2Key, mimeType: item.mimeType, fileSize: item.fileSize, lastErrorCode: item.lastErrorCode, nextRetryAt: item.nextRetryAt })) };
    },
    async renewLease(jobId, workerId, now) {
      const [job] = await db.update(virtualTryonJobs).set({ lockedUntil: new Date(now.getTime() + 60_000), updatedAt: now }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), inArray(virtualTryonJobs.status, ["queued", "generating", "qa_queued", "capturing"]))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
    async saveAsset(jobId, workerId, asset) {
      if (!await held(jobId, workerId, ["queued", "generating"])) return false;
      const [pack] = await db.select({ id: appearancePacks.id }).from(appearancePacks).where(eq(appearancePacks.virtualTryonJobId, jobId)).orderBy(desc(appearancePacks.version)).limit(1);
      if (!pack) throw new Error("virtual_tryon_pack_missing");
      const [saved] = await db.update(appearancePackAssets).set({ providerTaskId: asset.providerTaskId, providerStatus: asset.providerStatus, attemptCount: asset.attemptCount, submitAttemptCount: asset.submitAttemptCount ?? 0, pollFailureCount: asset.pollFailureCount ?? 0, deliveryFailureCount: asset.deliveryFailureCount ?? 0, r2Key: asset.r2Key, mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null, lastErrorCode: asset.lastErrorCode ?? null, nextRetryAt: asset.nextRetryAt ?? null, updatedAt: new Date() }).where(and(eq(appearancePackAssets.appearancePackId, pack.id), eq(appearancePackAssets.view, asset.view))).returning({ id: appearancePackAssets.id });
      return Boolean(saved);
    },
    async transitionToGenerating(jobId, workerId, expectedStatus) {
      const [job] = await db.update(virtualTryonJobs).set({ status: "generating", nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, expectedStatus))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
    async transitionAssetsReadyToQaQueued(jobId, packId, workerId) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "qa_queued", nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), inArray(virtualTryonJobs.status, ["queued", "generating"]))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.update(appearancePacks).set({ status: "qa_queued", updatedAt: new Date() }).where(and(eq(appearancePacks.id, packId), eq(appearancePacks.virtualTryonJobId, jobId)));
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "generating", toStatus: "qa_queued", reason: "required_assets_transferred" });
        return true;
      });
    },
    async resolveQa(jobId, _packId, workerId, passed) {
      return db.transaction(async (tx) => {
        const target = passed ? "capturing" : "recovering_release";
        const [job] = await tx.update(virtualTryonJobs).set({ status: target, nextRetryAt: null, lastError: passed ? null : "strict_qa_not_passed", updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "qa_queued"))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "qa_queued", toStatus: target, reason: passed ? "strict_qa_passed" : "strict_qa_failed" });
        return true;
      });
    },
    async finalizeCapturedPack(jobId, packId, workerId, capturedLedgerId) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "ready", capturedLedgerId, nextRetryAt: null, lastError: null, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "capturing"))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.update(appearancePacks).set({ status: "ready", updatedAt: new Date() }).where(and(eq(appearancePacks.id, packId), eq(appearancePacks.virtualTryonJobId, jobId)));
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "capturing", toStatus: "ready", reason: "credits_captured_and_pack_ready", eventSnapshot: { capturedLedgerId } });
        return true;
      });
    },
    async scheduleCapturePersistenceRetry(jobId, workerId, error, retryAt) {
      return db.transaction(async (tx) => {
        const [current] = await tx.select({ attempts: virtualTryonJobs.deliveryPersistAttemptCount }).from(virtualTryonJobs).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "capturing"))).limit(1);
        if (!current) return "lost_lease" as const;
        if (current.attempts >= 2) {
          const [job] = await tx.update(virtualTryonJobs).set({ status: "recovering_refund", lastError: error, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "capturing"))).returning({ id: virtualTryonJobs.id });
          if (!job) return "lost_lease" as const;
          await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "capturing", toStatus: "recovering_refund", reason: "ready_persistence_retry_exhausted" });
          return "recovering_refund" as const;
        }
        const [job] = await tx.update(virtualTryonJobs).set({ deliveryPersistAttemptCount: current.attempts + 1, lastError: error, nextRetryAt: retryAt, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "capturing"))).returning({ id: virtualTryonJobs.id });
        return job ? "retry" as const : "lost_lease" as const;
      });
    },
    async transitionCaptureToRefund(jobId, workerId, error) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "recovering_refund", lastError: error, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "capturing"))).returning({ id: virtualTryonJobs.id });
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "capturing", toStatus: "recovering_refund", reason: "ready_persistence_permanent_failure" });
        return true;
      });
    },
    async transitionToRecoveringRelease(jobId, workerId, expectedStatus, error) {
      const [job] = await db.update(virtualTryonJobs).set({ status: "recovering_release", lastError: error, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, expectedStatus))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
    async scheduleRetry(jobId, workerId, retryAt) {
      const [job] = await db.update(virtualTryonJobs).set({ nextRetryAt: retryAt, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), inArray(virtualTryonJobs.status, ["queued", "generating", "capturing"]))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
    async releaseLease(jobId, workerId) {
      const [job] = await db.update(virtualTryonJobs).set({ lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
  };
}

function errorCode(error: unknown) {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : error instanceof Error ? error.message : "worker_failed";
}

function errorStatus(error: unknown) {
  return error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : undefined;
}

async function runQa(job: RuntimeJob, qa: QaRunner | undefined, qaDeps: VirtualTryOnQaDeps | undefined) {
  const front = job.sourceKeys.front;
  if (!front || (job.mode === "three_view" && (!job.sourceKeys.back || !job.sourceKeys.detail))) return { allPassed: false };
  if (qa) return qa(job);
  if (!qaDeps) return { allPassed: false };
  const generatedKeys = Object.fromEntries(job.assets.flatMap((asset) => asset.r2Key ? [[asset.view, asset.r2Key]] : []));
  return runVirtualTryOnQa({ jobId: job.id, userId: job.userId, packId: job.packId, mode: job.mode, sourceKeys: { front, back: job.sourceKeys.back, detail: job.sourceKeys.detail }, modelKeys: job.modelKeys, generatedKeys }, qaDeps);
}

export async function runVirtualTryOnTick(input: { workerId: string; store: RuntimeStore; credits: CreditLedgerStore; submit: (job: RuntimeJob, view: AppearanceView) => Promise<string>; poll: (job: RuntimeJob, view: AppearanceView, taskId: string) => Promise<{ status: RuntimeAsset["providerStatus"]; outputUrl: string | null }>; qa?: QaRunner; qaDeps?: VirtualTryOnQaDeps; transfer?: typeof transferVirtualTryOnImageToR2; now?: Date }) {
  const now = input.now ?? new Date();
  const job = await input.store.acquire(input.workerId, now);
  if (!job) return { processed: 0, action: "idle" as const };
  const order: AppearanceView[] = job.mode === "front_only" ? ["front"] : ["front", "side", "back"];
  const asset = order.map((view) => job.assets.find((item) => item.view === view)).find((item) => item && !item.r2Key);
  try {
    if (asset) {
      let phase: "submit" | "poll" | "transfer" = "submit";
      try {
        if (!asset.providerTaskId) {
          phase = "submit";
          asset.providerTaskId = await input.submit(job, asset.view);
          asset.providerStatus = "queued";
          asset.attemptCount += 1;
          asset.submitAttemptCount = (asset.submitAttemptCount ?? asset.attemptCount - 1) + 1;
          if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
          const transitioned = await input.store.transitionToGenerating(job.id, input.workerId, job.status === "queued" ? "queued" : "generating");
          return { processed: 1, action: transitioned ? "submit" as const : "lost_lease" as const };
        }
        phase = "poll";
        const polled = await input.poll(job, asset.view, asset.providerTaskId);
        asset.providerStatus = polled.status;
        asset.outputUrl = polled.outputUrl;
        asset.pollFailureCount = 0;
        if (polled.status === "failed") throw new Error("provider_failed");
        if (polled.status !== "succeeded" || !polled.outputUrl) {
          if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
          return { processed: 1, action: "poll" as const };
        }
        const key = "virtual-tryon/" + job.id + "/packs/" + job.packId + "/" + asset.view + ".png";
        phase = "transfer";
        const transferred = await (input.transfer ?? transferVirtualTryOnImageToR2)({ url: polled.outputUrl, key });
        asset.r2Key = transferred.key;
        asset.mimeType = transferred.contentType;
        asset.fileSize = transferred.fileSize;
        asset.outputUrl = null;
        if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
        return { processed: 1, action: "transfer" as const };
      } catch (error) {
        const code = errorCode(error);
        const status = errorStatus(error) ?? Number(code.match(/^http_(\d{3})$/)?.[1]);
        const retryable = code === "timeout" || code === "network_error" || status === 429 || (Number.isInteger(status) && status >= 500);
        if (phase === "submit") {
          const attempts = (asset.submitAttemptCount ?? asset.attemptCount) + 1;
          asset.submitAttemptCount = attempts;
          asset.attemptCount = attempts;
          asset.lastErrorCode = code;
          asset.nextRetryAt = status === 429 && attempts < 2 ? new Date(now.getTime() + 30_000) : null;
          asset.providerStatus = "pending";
          if (status === 429 && attempts < 2) {
            if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
            await input.store.scheduleRetry(job.id, input.workerId, new Date(now.getTime() + 30_000));
            return { processed: 1, action: "retry" as const };
          }
        } else if (retryable && phase === "poll" && (asset.pollFailureCount ?? 0) < 10) {
          asset.pollFailureCount = (asset.pollFailureCount ?? 0) + 1;
          asset.lastErrorCode = code;
          asset.nextRetryAt = new Date(now.getTime() + 30_000);
          asset.providerStatus = "running";
          if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
          await input.store.scheduleRetry(job.id, input.workerId, asset.nextRetryAt);
          return { processed: 1, action: "retry" as const };
        } else if (retryable && phase === "transfer" && (asset.deliveryFailureCount ?? 0) < 3) {
          asset.deliveryFailureCount = (asset.deliveryFailureCount ?? 0) + 1;
          asset.lastErrorCode = code;
          asset.nextRetryAt = new Date(now.getTime() + 30_000);
          asset.providerStatus = "succeeded";
          if (!await input.store.saveAsset(job.id, input.workerId, asset)) return { processed: 1, action: "lost_lease" as const };
          await input.store.scheduleRetry(job.id, input.workerId, asset.nextRetryAt);
          return { processed: 1, action: "retry" as const };
        }
        await input.store.transitionToRecoveringRelease(job.id, input.workerId, job.status === "queued" ? "queued" : "generating", code);
        return { processed: 1, action: "recovering_release" as const };
      }
    }
    if (job.status === "queued" || job.status === "generating") {
      const transitioned = await input.store.transitionAssetsReadyToQaQueued(job.id, job.packId, input.workerId);
      return { processed: 1, action: transitioned ? "qa_queued" as const : "lost_lease" as const };
    }
    if (job.status === "qa_queued") {
      let summary: { allPassed: boolean };
      try {
        const renewLease = () => input.store.renewLease(job.id, input.workerId, new Date());
        if (input.qa) {
          if (!await renewLease()) return { processed: 1, action: "lost_lease" as const };
          summary = await input.qa(job);
          if (!await renewLease()) return { processed: 1, action: "lost_lease" as const };
        } else {
          summary = await runQa(job, undefined, input.qaDeps ? { ...input.qaDeps, renewLease } : undefined);
        }
      } catch (error) {
        if (errorCode(error) === "virtual_tryon_qa_lease_lost") return { processed: 1, action: "lost_lease" as const };
        summary = { allPassed: false };
      }
      const transitioned = await input.store.resolveQa(job.id, job.packId, input.workerId, summary.allPassed);
      return { processed: 1, action: transitioned ? summary.allPassed ? "capturing" as const : "recovering_release" as const : "lost_lease" as const };
    }
    if (job.status === "capturing") {
      let captured;
      try {
        captured = await captureReservedCredits({ store: input.credits, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_capture", relatedJobId: job.id, idempotencyKey: "virtual-tryon:" + job.id + ":capture" });
      } catch (error) {
        const outcome = await input.store.scheduleCapturePersistenceRetry(job.id, input.workerId, errorCode(error), new Date(now.getTime() + 30_000));
        return { processed: 1, action: outcome === "retry" ? "capture_retry" as const : outcome };
      }
      try {
        const finalized = await input.store.finalizeCapturedPack(job.id, job.packId, input.workerId, captured.ledger.id);
        return { processed: 1, action: finalized ? "ready" as const : "lost_lease" as const };
      } catch (error) {
        const code = errorCode(error);
        if (code === "ready_persistence_permanent") {
          const transitioned = await input.store.transitionCaptureToRefund(job.id, input.workerId, code);
          return { processed: 1, action: transitioned ? "recovering_refund" as const : "lost_lease" as const };
        }
        const outcome = await input.store.scheduleCapturePersistenceRetry(job.id, input.workerId, code, new Date(now.getTime() + 30_000));
        return { processed: 1, action: outcome === "retry" ? "capture_retry" as const : outcome };
      }
    }
    return { processed: 0, action: "ignored" as const };
  } finally {
    await input.store.releaseLease(job.id, input.workerId);
  }
}
