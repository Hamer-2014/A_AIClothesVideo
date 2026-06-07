import { eq } from "drizzle-orm";

import { releaseReservedCredits } from "@/lib/credits/ledger";
import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import type { CreditLedgerStore, CreditLedgerType } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";
import { canRolePerformAdminAction, type AdminRole } from "@/server/auth/admin-access";
import {
  createDrizzleJobStore,
  type JobStore,
  transitionJobStatus,
} from "@/server/jobs/state-machine";
import {
  createDrizzleVideoSegmentStore,
  type VideoSegmentStore,
} from "@/server/video/segments";

import {
  type AdminAuditActor,
  type AdminAuditRequestMeta,
  type AdminAuditStore,
  toAuditSnapshot,
  writeAdminAuditLog,
} from "./audit";

export interface AdminJobActionActor extends AdminAuditActor {
  role: AdminRole;
}

export interface AdminJobActionRecord {
  id: string;
  userId: string;
  status: string;
  creditCost: number;
  reservedLedgerId: string | null;
  failureReason: string | null;
}

export interface AdminJobActionStore {
  findJob(jobId: string): Promise<AdminJobActionRecord | null>;
  updateFailureReason(input: {
    jobId: string;
    failureReason: string;
  }): Promise<AdminJobActionRecord>;
}

export async function retryVideoSegmentByAdmin({
  jobStore = createDrizzleJobStore(),
  segmentStore = createDrizzleVideoSegmentStore(),
  auditStore,
  actor,
  jobId,
  segmentId,
  reason,
  requestMeta,
}: {
  jobStore?: JobStore;
  segmentStore?: VideoSegmentStore;
  auditStore: AdminAuditStore;
  actor: AdminJobActionActor;
  jobId: string;
  segmentId: string;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "job:retry_segment")) {
    throw new Error("Actor cannot retry video segments.");
  }

  const before = await segmentStore.findSegment({ jobId, segmentId });
  if (!before) {
    throw new Error("Video segment not found.");
  }

  const after = await segmentStore.updateSegment(segmentId, {
    status: "queued",
    providerTaskId: null,
    providerCallLogId: null,
    videoKey: null,
    lockedBy: null,
    lockedUntil: null,
    lastError: null,
    nextRetryAt: null,
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "retrying",
    reason: "admin_retry_segment",
    actorType: "admin",
    actorId: actor.userId,
    eventSnapshot: { segmentId, reason },
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "segments_queued",
    reason: "admin_retry_segment_requeued",
    actorType: "admin",
    actorId: actor.userId,
    eventSnapshot: { segmentId },
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:retry_segment",
    targetType: "video_segment",
    targetId: segmentId,
    reason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return {
    jobId,
    segmentId,
    status: "queued" as const,
  };
}

export async function markJobUndeliverable({
  jobStore = createDrizzleJobStore(),
  actionStore,
  creditStore = createDrizzleCreditLedgerStore(),
  auditStore,
  actor,
  jobId,
  reason,
  requestMeta,
}: {
  jobStore?: JobStore;
  actionStore: AdminJobActionStore;
  creditStore?: CreditLedgerStore;
  auditStore: AdminAuditStore;
  actor: AdminJobActionActor;
  jobId: string;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "job:mark_undeliverable")) {
    throw new Error("Actor cannot mark jobs undeliverable.");
  }

  const before = await actionStore.findJob(jobId);
  if (!before) {
    throw new Error("Video job not found.");
  }

  await releaseReservedCredits({
    store: creditStore,
    userId: before.userId,
    amount: before.creditCost,
    reason,
    idempotencyKey: `admin_release:job:${jobId}`,
    relatedJobId: jobId,
    metadata: {
      actorUserId: actor.userId,
      actorEmail: actor.email,
      reservedLedgerId: before.reservedLedgerId,
    },
  });
  const after = await actionStore.updateFailureReason({
    jobId,
    failureReason: reason,
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "failed_released",
    reason: "admin_mark_undeliverable",
    actorType: "admin",
    actorId: actor.userId,
    eventSnapshot: { reason },
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:mark_undeliverable",
    targetType: "video_job",
    targetId: jobId,
    reason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return {
    jobId,
    status: "failed_released" as const,
    ledgerType: "release" as CreditLedgerType,
  };
}

export function createInMemoryAdminJobActionStore(
  initialJobs: AdminJobActionRecord[],
): AdminJobActionStore & {
  listJobs: () => AdminJobActionRecord[];
} {
  const jobs = new Map(initialJobs.map((job) => [job.id, { ...job }]));

  return {
    async findJob(jobId) {
      const job = jobs.get(jobId);
      return job ? { ...job } : null;
    },
    async updateFailureReason({ jobId, failureReason }) {
      const job = jobs.get(jobId);
      if (!job) {
        throw new Error("Video job not found.");
      }
      const updated = { ...job, failureReason };
      jobs.set(jobId, updated);
      return { ...updated };
    },
    listJobs() {
      return Array.from(jobs.values()).map((job) => ({ ...job }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminJobActionStore(
  db: DbClient = getDb(),
): AdminJobActionStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          creditCost: videoJobs.creditCost,
          reservedLedgerId: videoJobs.reservedLedgerId,
          failureReason: videoJobs.failureReason,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as AdminJobActionRecord | undefined) ?? null;
    },
    async updateFailureReason({ jobId, failureReason }) {
      const [job] = await db
        .update(videoJobs)
        .set({ failureReason })
        .where(eq(videoJobs.id, jobId))
        .returning({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          creditCost: videoJobs.creditCost,
          reservedLedgerId: videoJobs.reservedLedgerId,
          failureReason: videoJobs.failureReason,
        });

      if (!job) {
        throw new Error("Video job not found.");
      }

      return job as AdminJobActionRecord;
    },
  };
}
