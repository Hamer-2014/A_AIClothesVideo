export type BillingMaintenanceJob = { id: string; userId: string; status: "draft" | "recovering_release"; creditCost: number; createdAt: Date };
export interface BillingMaintenanceStore {
  acquire(workerId: string, now: Date): Promise<BillingMaintenanceJob | null>;
  queue(jobId: string, workerId: string): Promise<boolean>;
  failUnreserved(jobId: string, workerId: string, error: string): Promise<boolean>;
  release(jobId: string, workerId: string): Promise<boolean>;
  retry(jobId: string, workerId: string, error: string, nextRetryAt: Date): Promise<boolean>;
  releaseLease(jobId: string, workerId: string): Promise<boolean>;
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleBillingMaintenanceStore(db: DbClient = getDb()): BillingMaintenanceStore {
  return {
    async acquire(workerId, now) {
      const staleAt = new Date(now.getTime() - 60_000);
      const [candidate] = await db.select().from(virtualTryonJobs).where(and(or(and(eq(virtualTryonJobs.status, "draft"), lte(virtualTryonJobs.createdAt, staleAt)), eq(virtualTryonJobs.status, "recovering_release")), or(isNull(virtualTryonJobs.nextRetryAt), lte(virtualTryonJobs.nextRetryAt, now)), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)), isNull(virtualTryonJobs.deletedAt))).orderBy(asc(virtualTryonJobs.createdAt)).limit(1);
      if (!candidate) return null;
      const [locked] = await db.update(virtualTryonJobs).set({ lockedBy: workerId, lockedUntil: new Date(now.getTime() + 60_000), attemptCount: candidate.attemptCount + 1 }).where(and(eq(virtualTryonJobs.id, candidate.id), eq(virtualTryonJobs.status, candidate.status), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)))).returning();
      return locked ? { id: locked.id, userId: locked.userId, status: locked.status as BillingMaintenanceJob["status"], creditCost: locked.creditCost, createdAt: locked.createdAt } : null;
    },
    async queue(jobId, workerId) { return db.transaction(async (tx) => { const [job] = await tx.update(virtualTryonJobs).set({ status: "queued", lockedBy: null, lockedUntil: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "draft"))).returning(); if (!job) return false; await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "queued", reason: "reserve_succeeded" }); return true; }); },
    async failUnreserved(jobId, workerId, error) { return db.transaction(async (tx) => { const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_unreserved", lastError: error, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "draft"))).returning(); if (!job) return false; await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "failed_unreserved", reason: "reserve_failed" }); return true; }); },
    async release(jobId, workerId) { return db.transaction(async (tx) => { const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_released", lockedBy: null, lockedUntil: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "recovering_release"))).returning(); if (!job) return false; await tx.update(appearancePacks).set({ status: "failed", updatedAt: new Date() }).where(eq(appearancePacks.virtualTryonJobId, jobId)); await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "recovering_release", toStatus: "failed_released", reason: "release_succeeded" }); return true; }); },
    async retry(jobId, workerId, error, nextRetryAt) { const [job] = await db.update(virtualTryonJobs).set({ lastError: error, nextRetryAt, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "recovering_release"))).returning({ id: virtualTryonJobs.id }); return Boolean(job); },
    async releaseLease(jobId, workerId) { const [job] = await db.update(virtualTryonJobs).set({ lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId))).returning({ id: virtualTryonJobs.id }); return Boolean(job); },
  };
}

export async function runBillingMaintenanceTick(input: { workerId: string; store: BillingMaintenanceStore; now: Date; reserve: (key: string) => Promise<void>; releaseCredits: (key: string) => Promise<void> }) {
  const job = await input.store.acquire(input.workerId, input.now); if (!job) return { processed: 0 as const };
  try {
    if (job.status === "draft") {
      if (input.now.getTime() - job.createdAt.getTime() < 60_000) return { processed: 0 as const };
      try { await input.reserve("virtual-tryon:" + job.id + ":reserve"); return (await input.store.queue(job.id, input.workerId)) ? { processed: 1 as const, action: "queued" as const } : { processed: 1 as const, action: "lost_lease" as const }; }
      catch (error) { return (await input.store.failUnreserved(job.id, input.workerId, error instanceof Error ? error.message : "reserve_failed")) ? { processed: 1 as const, action: "failed_unreserved" as const } : { processed: 1 as const, action: "lost_lease" as const }; }
    }
    try { await input.releaseCredits("virtual-tryon:" + job.id + ":release"); return (await input.store.release(job.id, input.workerId)) ? { processed: 1 as const, action: "released" as const } : { processed: 1 as const, action: "lost_lease" as const }; }
    catch (error) { return (await input.store.retry(job.id, input.workerId, error instanceof Error ? error.message : "release_failed", new Date(input.now.getTime() + 30_000))) ? { processed: 1 as const, action: "release_retry" as const } : { processed: 1 as const, action: "lost_lease" as const }; }
  } finally { await input.store.releaseLease(job.id, input.workerId); }
}
import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { appearancePacks, virtualTryonJobs, virtualTryonStateEvents } from "@/lib/db/schema";
