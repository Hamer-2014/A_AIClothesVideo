import { and, desc, eq } from "drizzle-orm";

import { releaseReservedCredits } from "@/lib/credits/ledger";
import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import type { CreditLedgerStore, CreditLedgerType } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { creditLedger, stitchJobs, videoJobs } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
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
  normalizeAdminReason,
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

export interface AdminJobActionLedgerRecord {
  id: string;
  type: CreditLedgerType;
  relatedJobId: string | null;
}

export interface AdminJobActionStore {
  findJob(jobId: string): Promise<AdminJobActionRecord | null>;
  updateFailureReason(input: {
    jobId: string;
    failureReason: string;
  }): Promise<AdminJobActionRecord>;
  listLedger(jobId: string): Promise<AdminJobActionLedgerRecord[]>;
}

export interface AdminPostQaReopenStitchRecord {
  id: string;
  videoJobId: string;
  status: string;
  finalVideoKey: string | null;
  coverKey: string | null;
  frameKeys: JsonValue;
}

export interface AdminPostQaReopenStore {
  findLatestSucceededStitchJob(
    jobId: string,
  ): Promise<AdminPostQaReopenStitchRecord | null>;
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

  const normalizedReason = normalizeAdminReason(reason);

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
    errorMessage: null,
    failureReason: null,
    clearLock: true,
    eventSnapshot: { segmentId, reason: normalizedReason },
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "segments_queued",
    reason: "admin_retry_segment_requeued",
    actorType: "admin",
    actorId: actor.userId,
    errorMessage: null,
    failureReason: null,
    clearLock: true,
    eventSnapshot: { segmentId },
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:retry_segment",
    targetType: "video_segment",
    targetId: segmentId,
    reason: normalizedReason,
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

  const result = await releaseJobCreditsByAdmin({
    jobStore,
    actionStore,
    creditStore,
    auditStore,
    actor,
    jobId,
    reason,
    requestMeta,
  });

  if (result.idempotent) {
    throw new Error("Video job reserved credits are already resolved.");
  }

  return result;
}

const adminReleaseableStatuses = new Set([
  "asset_analysis_failed",
  "prompt_moderation_blocked",
  "segment_failed",
  "post_qa_failed",
  "failed_released",
]);

function hasLedgerResolution(
  ledger: AdminJobActionLedgerRecord[],
  types: CreditLedgerType[],
) {
  return ledger.some((entry) => types.includes(entry.type));
}

export async function releaseJobCreditsByAdmin({
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
  if (!canRolePerformAdminAction(actor.role, "job:release_credits")) {
    throw new Error("Actor cannot release job credits.");
  }

  const normalizedReason = normalizeAdminReason(reason);
  const before = await actionStore.findJob(jobId);
  if (!before) {
    throw new Error("Video job not found.");
  }

  const ledger = await actionStore.listLedger(jobId);
  if (hasLedgerResolution(ledger, ["capture", "refund"])) {
    throw new Error("Video job reserved credits are already resolved.");
  }

  if (hasLedgerResolution(ledger, ["release"])) {
    return {
      jobId,
      status: before.status === "failed_released" ? before.status : "failed_released",
      ledgerType: "release" as CreditLedgerType,
      idempotent: true,
    };
  }

  if (!before.reservedLedgerId) {
    throw new Error("Video job has no reserved ledger to release.");
  }
  if (before.creditCost <= 0) {
    throw new Error("Video job has no paid credits to release.");
  }
  if (!adminReleaseableStatuses.has(before.status)) {
    throw new Error("Video job credits cannot be released in this state.");
  }

  const releaseResult = await releaseReservedCredits({
    store: creditStore,
    userId: before.userId,
    amount: before.creditCost,
    reason: normalizedReason,
    idempotencyKey: `admin_release:job:${jobId}`,
    relatedJobId: jobId,
    metadata: {
      actorUserId: actor.userId,
      actorEmail: actor.email,
      reservedLedgerId: before.reservedLedgerId,
    },
  });

  if (releaseResult.idempotent) {
    return {
      jobId,
      status: "failed_released" as const,
      ledgerType: "release" as CreditLedgerType,
      idempotent: true,
    };
  }

  let after: AdminJobActionRecord = before;
  if (before.status !== "failed_released") {
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "failed_released",
      reason: "admin_release_credits",
      actorType: "admin",
      actorId: actor.userId,
      failureReason: before.failureReason ?? normalizedReason,
      clearLock: true,
      eventSnapshot: {
        reason: normalizedReason,
        reservedLedgerId: before.reservedLedgerId,
        releaseLedgerId: releaseResult.ledger.id,
      },
    });
    after = {
      ...before,
      status: "failed_released",
    };
  }

  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:release_credits",
    targetType: "video_job",
    targetId: jobId,
    reason: normalizedReason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot({
      ...after,
      releaseLedgerId: releaseResult.ledger.id,
      idempotent: releaseResult.idempotent,
    }),
    requestMeta,
  });

  return {
    jobId,
    status: "failed_released" as const,
    ledgerType: "release" as CreditLedgerType,
    idempotent: releaseResult.idempotent,
  };
}

function frameKeysFrom(value: JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function reopenPostQaByAdmin({
  jobStore = createDrizzleJobStore(),
  actionStore,
  postQaStore,
  auditStore,
  actor,
  jobId,
  reason,
  requestMeta,
}: {
  jobStore?: JobStore;
  actionStore: AdminJobActionStore;
  postQaStore: AdminPostQaReopenStore;
  auditStore: AdminAuditStore;
  actor: AdminJobActionActor;
  jobId: string;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "job:reopen_post_qa")) {
    throw new Error("Actor cannot reopen Post-QA.");
  }

  const normalizedReason = normalizeAdminReason(reason);

  const before = await actionStore.findJob(jobId);
  if (!before) {
    throw new Error("Video job not found.");
  }

  if (!["post_qa_failed", "failed_released", "failed_refunded"].includes(before.status)) {
    throw new Error("Video job is not failed in Post-QA.");
  }

  const stitchJob = await postQaStore.findLatestSucceededStitchJob(jobId);
  const frameKeys = frameKeysFrom(stitchJob?.frameKeys ?? []);
  if (!stitchJob?.finalVideoKey || frameKeys.length === 0) {
    throw new Error("Successful stitch output is required to reopen Post-QA.");
  }

  await actionStore.updateFailureReason({ jobId, failureReason: "" });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "retrying",
    reason: "admin_reopen_post_qa",
    actorType: "admin",
    actorId: actor.userId,
    errorMessage: null,
    failureReason: null,
    eventSnapshot: { reason: normalizedReason, stitchJobId: stitchJob.id },
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "post_qa_queued",
    reason: "admin_reopen_post_qa_requeued",
    actorType: "admin",
    actorId: actor.userId,
    clearLock: true,
    eventSnapshot: {
      stitchJobId: stitchJob.id,
      finalVideoKey: stitchJob.finalVideoKey,
      frameKeys,
    },
  });
  const after = await actionStore.findJob(jobId);
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:reopen_post_qa",
    targetType: "video_job",
    targetId: jobId,
    reason: normalizedReason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return {
    jobId,
    status: "post_qa_queued" as const,
    stitchJobId: stitchJob.id,
    frameCount: frameKeys.length,
  };
}

export function createInMemoryAdminJobActionStore(
  initialJobs: AdminJobActionRecord[],
  ledgerRecords: AdminJobActionLedgerRecord[] = [],
): AdminJobActionStore & {
  listJobs: () => AdminJobActionRecord[];
} {
  const jobs = new Map(initialJobs.map((job) => [job.id, { ...job }]));
  const ledger = ledgerRecords.map((entry) => ({ ...entry }));

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
    async listLedger(jobId) {
      return ledger.filter((entry) => entry.relatedJobId === jobId);
    },
    listJobs() {
      return Array.from(jobs.values()).map((job) => ({ ...job }));
    },
  };
}

export function createInMemoryAdminPostQaReopenStore(
  stitchJobRecords: AdminPostQaReopenStitchRecord[],
): AdminPostQaReopenStore {
  const records = stitchJobRecords.map((record) => ({ ...record }));

  return {
    async findLatestSucceededStitchJob(jobId) {
      return (
        records.find(
          (record) => record.videoJobId === jobId && record.status === "succeeded",
        ) ?? null
      );
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
    async listLedger(jobId) {
      return db
        .select({
          id: creditLedger.id,
          type: creditLedger.type,
          relatedJobId: creditLedger.relatedJobId,
        })
        .from(creditLedger)
        .where(eq(creditLedger.relatedJobId, jobId));
    },
  };
}

export function createDrizzleAdminPostQaReopenStore(
  db: DbClient = getDb(),
): AdminPostQaReopenStore {
  return {
    async findLatestSucceededStitchJob(jobId) {
      const [record] = await db
        .select({
          id: stitchJobs.id,
          videoJobId: stitchJobs.videoJobId,
          status: stitchJobs.status,
          finalVideoKey: stitchJobs.finalVideoKey,
          coverKey: stitchJobs.coverKey,
          frameKeys: stitchJobs.frameKeys,
        })
        .from(stitchJobs)
        .where(
          and(eq(stitchJobs.videoJobId, jobId), eq(stitchJobs.status, "succeeded")),
        )
        .orderBy(desc(stitchJobs.createdAt))
        .limit(1);

      return (record as AdminPostQaReopenStitchRecord | undefined) ?? null;
    },
  };
}
