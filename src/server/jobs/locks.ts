import { and, asc, inArray, lte, or, isNull, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";
import type { JobRecord, JobStatus } from "./state-machine";

export interface LockableJobRecord extends JobRecord {
  createdAt: Date;
}

export interface JobLockStore {
  acquireNext(input: {
    eligibleStatuses: JobStatus[];
    workerId: string;
    now: Date;
    lockMs: number;
  }): Promise<LockableJobRecord | null>;
}

export function createInMemoryJobLockStore(
  initialJobs: LockableJobRecord[] = [],
): JobLockStore & {
  listJobs: () => LockableJobRecord[];
} {
  const jobs = new Map(initialJobs.map((job) => [job.id, { ...job }]));

  return {
    async acquireNext({ eligibleStatuses, workerId, now, lockMs }) {
      const eligible = Array.from(jobs.values())
        .filter((job) => eligibleStatuses.includes(job.status))
        .filter(
          (job) => !job.lockedUntil || job.lockedUntil.getTime() <= now.getTime(),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const job = eligible[0];

      if (!job) {
        return null;
      }

      const updated: LockableJobRecord = {
        ...job,
        lockedBy: workerId,
        lockedUntil: new Date(now.getTime() + lockMs),
        attemptCount: job.attemptCount + 1,
      };
      jobs.set(job.id, updated);

      return { ...updated };
    },
    listJobs() {
      return Array.from(jobs.values()).map((job) => ({ ...job }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobLockStore(
  db: DbClient = getDb(),
): JobLockStore {
  return {
    async acquireNext({ eligibleStatuses, workerId, now, lockMs }) {
      const [candidate] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          lockedBy: videoJobs.lockedBy,
          lockedUntil: videoJobs.lockedUntil,
          attemptCount: videoJobs.attemptCount,
          lastError: videoJobs.lastError,
          createdAt: videoJobs.createdAt,
        })
        .from(videoJobs)
        .where(
          and(
            inArray(videoJobs.status, eligibleStatuses),
            or(isNull(videoJobs.lockedUntil), lte(videoJobs.lockedUntil, now)),
            isNull(videoJobs.deletedAt),
          ),
        )
        .orderBy(asc(videoJobs.createdAt))
        .limit(1);

      if (!candidate) {
        return null;
      }

      const [locked] = await db
        .update(videoJobs)
        .set({
          lockedBy: workerId,
          lockedUntil: new Date(now.getTime() + lockMs),
          attemptCount: candidate.attemptCount + 1,
        })
        .where(
          and(
            eq(videoJobs.id, candidate.id),
            inArray(videoJobs.status, eligibleStatuses),
            or(isNull(videoJobs.lockedUntil), lte(videoJobs.lockedUntil, now)),
          ),
        )
        .returning({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          lockedBy: videoJobs.lockedBy,
          lockedUntil: videoJobs.lockedUntil,
          attemptCount: videoJobs.attemptCount,
          lastError: videoJobs.lastError,
          createdAt: videoJobs.createdAt,
        });

      return (locked as LockableJobRecord | undefined) ?? null;
    },
  };
}

export async function acquireNextJobLock({
  store,
  workerId,
  eligibleStatuses,
  now = new Date(),
  lockMs = 60_000,
}: {
  store: JobLockStore;
  workerId: string;
  eligibleStatuses: JobStatus[];
  now?: Date;
  lockMs?: number;
}) {
  return store.acquireNext({
    eligibleStatuses,
    workerId,
    now,
    lockMs,
  });
}
