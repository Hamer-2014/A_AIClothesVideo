import { refundCredits, releaseReservedCredits, reserveCredits } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { appearancePacks, virtualTryonJobs, virtualTryonStateEvents } from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

export type BillingMaintenanceStatus = "draft" | "recovering_release" | "recovering_refund";
export type BillingMaintenanceJob = { id: string; userId: string; status: BillingMaintenanceStatus; creditCost: number; createdAt: Date };
export type BillingLedgerResult = { ledger: { id: string } };
export type BillingMaintenanceOperations = {
  reserve: (input: { job: BillingMaintenanceJob; key: string }) => Promise<BillingLedgerResult>;
  release: (input: { job: BillingMaintenanceJob; key: string }) => Promise<BillingLedgerResult>;
  refund: (input: { job: BillingMaintenanceJob; key: string }) => Promise<BillingLedgerResult>;
};

export interface BillingMaintenanceStore {
  acquire(workerId: string, now: Date): Promise<BillingMaintenanceJob | null>;
  queue(jobId: string, workerId: string, reservedLedgerId: string): Promise<boolean>;
  failUnreserved(jobId: string, workerId: string, error: string): Promise<boolean>;
  release(jobId: string, workerId: string, releasedLedgerId: string): Promise<boolean>;
  refund(jobId: string, workerId: string, refundedLedgerId: string): Promise<boolean>;
  retry(jobId: string, workerId: string, status: "recovering_release" | "recovering_refund", error: string, nextRetryAt: Date): Promise<boolean>;
  releaseLease(jobId: string, workerId: string): Promise<boolean>;
}

type DbClient = ReturnType<typeof getDb>;

export function createBillingMaintenanceCreditOperations(store: CreditLedgerStore): BillingMaintenanceOperations {
  return {
    reserve: ({ job, key }) => reserveCredits({ store, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_reserve", relatedJobId: job.id, idempotencyKey: key }),
    release: ({ job, key }) => releaseReservedCredits({ store, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_release", relatedJobId: job.id, idempotencyKey: key }),
    refund: ({ job, key }) => refundCredits({ store, userId: job.userId, amount: job.creditCost, reason: "virtual_tryon_refund", relatedJobId: job.id, idempotencyKey: key }),
  };
}

export function createDrizzleBillingMaintenanceStore(db: DbClient = getDb()): BillingMaintenanceStore {
  return {
    async acquire(workerId, now) {
      const staleAt = new Date(now.getTime() - 60_000);
      const [candidate] = await db.select().from(virtualTryonJobs).where(and(or(and(eq(virtualTryonJobs.status, "draft"), lte(virtualTryonJobs.createdAt, staleAt)), inArray(virtualTryonJobs.status, ["recovering_release", "recovering_refund"])), or(isNull(virtualTryonJobs.nextRetryAt), lte(virtualTryonJobs.nextRetryAt, now)), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)), isNull(virtualTryonJobs.deletedAt))).orderBy(asc(virtualTryonJobs.createdAt)).limit(1);
      if (!candidate) return null;
      const [locked] = await db.update(virtualTryonJobs).set({ lockedBy: workerId, lockedUntil: new Date(now.getTime() + 60_000), attemptCount: candidate.attemptCount + 1 }).where(and(eq(virtualTryonJobs.id, candidate.id), eq(virtualTryonJobs.status, candidate.status), or(isNull(virtualTryonJobs.lockedUntil), lte(virtualTryonJobs.lockedUntil, now)))).returning();
      return locked ? { id: locked.id, userId: locked.userId, status: locked.status as BillingMaintenanceStatus, creditCost: locked.creditCost, createdAt: locked.createdAt } : null;
    },
    async queue(jobId, workerId, reservedLedgerId) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "queued", reservedLedgerId, lockedBy: null, lockedUntil: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "draft"))).returning();
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "queued", reason: "reserve_succeeded", eventSnapshot: { reservedLedgerId } });
        return true;
      });
    },
    async failUnreserved(jobId, workerId, error) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_unreserved", lastError: error, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "draft"))).returning();
        if (!job) return false;
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "draft", toStatus: "failed_unreserved", reason: "reserve_failed" });
        return true;
      });
    },
    async release(jobId, workerId, releasedLedgerId) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_released", releasedLedgerId, lockedBy: null, lockedUntil: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "recovering_release"))).returning();
        if (!job) return false;
        await tx.update(appearancePacks).set({ status: "failed", updatedAt: new Date() }).where(eq(appearancePacks.virtualTryonJobId, jobId));
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "recovering_release", toStatus: "failed_released", reason: "release_succeeded", eventSnapshot: { releasedLedgerId } });
        return true;
      });
    },
    async refund(jobId, workerId, refundedLedgerId) {
      return db.transaction(async (tx) => {
        const [job] = await tx.update(virtualTryonJobs).set({ status: "failed_refunded", refundedLedgerId, lockedBy: null, lockedUntil: null, nextRetryAt: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, "recovering_refund"))).returning();
        if (!job) return false;
        await tx.update(appearancePacks).set({ status: "failed", updatedAt: new Date() }).where(eq(appearancePacks.virtualTryonJobId, jobId));
        await tx.insert(virtualTryonStateEvents).values({ virtualTryonJobId: jobId, fromStatus: "recovering_refund", toStatus: "failed_refunded", reason: "refund_succeeded", eventSnapshot: { refundedLedgerId } });
        return true;
      });
    },
    async retry(jobId, workerId, status, error, nextRetryAt) {
      const [job] = await db.update(virtualTryonJobs).set({ lastError: error, nextRetryAt, lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId), eq(virtualTryonJobs.status, status))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
    async releaseLease(jobId, workerId) {
      const [job] = await db.update(virtualTryonJobs).set({ lockedBy: null, lockedUntil: null, updatedAt: new Date() }).where(and(eq(virtualTryonJobs.id, jobId), eq(virtualTryonJobs.lockedBy, workerId))).returning({ id: virtualTryonJobs.id });
      return Boolean(job);
    },
  };
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "ledger_operation_failed";
}

export async function runBillingMaintenanceTick(input: { workerId: string; store: BillingMaintenanceStore; now: Date; operations: BillingMaintenanceOperations }) {
  const job = await input.store.acquire(input.workerId, input.now);
  if (!job) return { processed: 0 as const };
  try {
    if (job.status === "draft") {
      if (input.now.getTime() - job.createdAt.getTime() < 60_000) return { processed: 0 as const };
      try {
        const result = await input.operations.reserve({ job, key: "virtual-tryon:" + job.id + ":reserve" });
        return (await input.store.queue(job.id, input.workerId, result.ledger.id)) ? { processed: 1 as const, action: "queued" as const } : { processed: 1 as const, action: "lost_lease" as const };
      } catch (error) {
        return (await input.store.failUnreserved(job.id, input.workerId, message(error))) ? { processed: 1 as const, action: "failed_unreserved" as const } : { processed: 1 as const, action: "lost_lease" as const };
      }
    }
    if (job.status === "recovering_release") {
      try {
        const result = await input.operations.release({ job, key: "virtual-tryon:" + job.id + ":release" });
        return (await input.store.release(job.id, input.workerId, result.ledger.id)) ? { processed: 1 as const, action: "released" as const } : { processed: 1 as const, action: "lost_lease" as const };
      } catch (error) {
        return (await input.store.retry(job.id, input.workerId, "recovering_release", message(error), new Date(input.now.getTime() + 30_000))) ? { processed: 1 as const, action: "release_retry" as const } : { processed: 1 as const, action: "lost_lease" as const };
      }
    }
    try {
      const result = await input.operations.refund({ job, key: "virtual-tryon:" + job.id + ":refund" });
      return (await input.store.refund(job.id, input.workerId, result.ledger.id)) ? { processed: 1 as const, action: "refunded" as const } : { processed: 1 as const, action: "lost_lease" as const };
    } catch (error) {
      return (await input.store.retry(job.id, input.workerId, "recovering_refund", message(error), new Date(input.now.getTime() + 30_000))) ? { processed: 1 as const, action: "refund_retry" as const } : { processed: 1 as const, action: "lost_lease" as const };
    }
  } finally {
    await input.store.releaseLease(job.id, input.workerId);
  }
}
