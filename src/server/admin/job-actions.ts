import { and, desc, eq } from "drizzle-orm";

import { releaseReservedCredits, reserveCredits } from "@/lib/credits/ledger";
import {
  createDrizzleCreditLedgerStore,
  createDrizzleCreditLedgerStoreForTransaction,
} from "@/lib/credits/drizzle-store";
import type {
  CreditLedgerEntry,
  CreditLedgerStore,
  CreditLedgerType,
} from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import {
  creditLedger,
  jobStateEvents,
  stitchJobs,
  videoJobs,
} from "@/lib/db/schema";
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
  metadata?: JsonValue | null;
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
  reopen(input: {
    jobId: string;
    actorUserId: string;
    reason: string;
  }): Promise<{
    before: AdminJobActionRecord;
    after: AdminJobActionRecord;
    stitchJob: AdminPostQaReopenStitchRecord;
    frameKeys: string[];
    reservedLedgerId: string | null;
    idempotent: boolean;
  }>;
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
  reservedLedgerId: string | null,
) {
  return Boolean(reservedLedgerId) && ledger.some(
    (entry) =>
      types.includes(entry.type) &&
      metadataReservedLedgerId(entry.metadata ?? null) === reservedLedgerId,
  );
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
  if (hasLedgerResolution(ledger, ["capture", "refund"], before.reservedLedgerId)) {
    throw new Error("Video job reserved credits are already resolved.");
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

  const existingRelease = ledger.find(
    (entry) =>
      entry.type === "release" &&
      metadataReservedLedgerId(entry.metadata ?? null) === before.reservedLedgerId,
  );
  const releaseResult = existingRelease
    ? { ledger: existingRelease, idempotent: true }
    : await releaseReservedCredits({
        store: creditStore,
        userId: before.userId,
        amount: before.creditCost,
        reason: normalizedReason,
        idempotencyKey: `admin_release:job:${jobId}:reserve:${before.reservedLedgerId}`,
        relatedJobId: jobId,
        metadata: {
          actorUserId: actor.userId,
          actorEmail: actor.email,
          reservedLedgerId: before.reservedLedgerId,
        },
      });

  let after: AdminJobActionRecord = before;
  const currentJob = await jobStore.findJob(jobId);
  if ((currentJob?.status ?? before.status) !== "failed_released") {
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

function metadataReservedLedgerId(value: JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return typeof value.reservedLedgerId === "string"
    ? value.reservedLedgerId
    : null;
}

function reservationIsResolved(
  ledger: CreditLedgerEntry[],
  reservedLedgerId: string,
) {
  return ledger.some(
    (entry) =>
      ["capture", "release", "refund"].includes(entry.type) &&
      metadataReservedLedgerId(entry.metadata) === reservedLedgerId,
  );
}

function isReopenReservation(entry: CreditLedgerEntry | undefined, jobId: string) {
  return entry?.type === "reserve" &&
    entry.idempotencyKey.startsWith(`reserve:job:${jobId}:post_qa_reopen:`);
}

export async function reopenPostQaByAdmin({
  postQaStore,
  auditStore,
  actor,
  jobId,
  reason,
  requestMeta,
}: {
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
  const reopened = await postQaStore.reopen({
    jobId,
    actorUserId: actor.userId,
    reason: normalizedReason,
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "job:reopen_post_qa",
    targetType: "video_job",
    targetId: jobId,
    reason: normalizedReason,
    beforeSnapshot: toAuditSnapshot(reopened.before),
    afterSnapshot: toAuditSnapshot({
      ...reopened.after,
      idempotent: reopened.idempotent,
    }),
    requestMeta,
  });

  return {
    jobId,
    status: "post_qa_queued" as const,
    stitchJobId: reopened.stitchJob.id,
    frameCount: reopened.frameKeys.length,
    reservedLedgerId: reopened.reservedLedgerId,
    idempotent: reopened.idempotent,
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
  input: {
    jobs: AdminJobActionRecord[];
    stitchJobs: AdminPostQaReopenStitchRecord[];
    creditStore: CreditLedgerStore & { listLedger: () => CreditLedgerEntry[] };
  },
): AdminPostQaReopenStore & { listJobs: () => AdminJobActionRecord[] } {
  const jobs = new Map(input.jobs.map((job) => [job.id, { ...job }]));
  const stitchJobRecords = input.stitchJobs.map((record) => ({ ...record }));

  return {
    async reopen({ jobId, actorUserId, reason }) {
      const before = jobs.get(jobId);
      if (!before) {
        throw new Error("Video job not found.");
      }
      const stitchJob = stitchJobRecords.find(
        (record) => record.videoJobId === jobId && record.status === "succeeded",
      );
      const frameKeys = frameKeysFrom(stitchJob?.frameKeys ?? []);
      if (!stitchJob?.finalVideoKey || frameKeys.length === 0) {
        throw new Error("Successful stitch output is required to reopen Post-QA.");
      }

      const ledger = input.creditStore.listLedger();
      const currentReserve = ledger.find(
        (entry) => entry.id === before.reservedLedgerId && entry.type === "reserve",
      );
      const currentReservationResolved = currentReserve
        ? reservationIsResolved(ledger, currentReserve.id)
        : true;
      if (
        before.status === "post_qa_queued" &&
        currentReserve &&
        isReopenReservation(currentReserve, jobId) &&
        !currentReservationResolved
      ) {
        return {
          before: { ...before },
          after: { ...before },
          stitchJob: { ...stitchJob },
          frameKeys,
          reservedLedgerId: currentReserve.id,
          idempotent: true,
        };
      }
      if (before.status === "post_qa_failed") {
        throw new Error("Video job is not settled after Post-QA failure.");
      }
      if (!["failed_released", "failed_refunded"].includes(before.status)) {
        throw new Error("Video job is not failed in Post-QA.");
      }

      let reservedLedgerId = currentReserve?.id ?? null;
      if (before.creditCost > 0 && (!currentReserve || currentReservationResolved)) {
        const reserveResult = await reserveCredits({
          store: input.creditStore,
          userId: before.userId,
          amount: before.creditCost,
          reason,
          idempotencyKey: `reserve:job:${jobId}:post_qa_reopen:${currentReserve?.id ?? "none"}`,
          relatedJobId: jobId,
          metadata: {
            actorUserId,
            priorReservedLedgerId: currentReserve?.id ?? null,
          },
        });
        reservedLedgerId = reserveResult.ledger.id;
      }

      const after: AdminJobActionRecord = {
        ...before,
        status: "post_qa_queued",
        reservedLedgerId,
        failureReason: null,
      };
      jobs.set(jobId, after);
      return {
        before: { ...before },
        after: { ...after },
        stitchJob: { ...stitchJob },
        frameKeys,
        reservedLedgerId,
        idempotent: false,
      };
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
    async listLedger(jobId) {
      return db
        .select({
          id: creditLedger.id,
          type: creditLedger.type,
          relatedJobId: creditLedger.relatedJobId,
          metadata: creditLedger.metadata,
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
    async reopen({ jobId, actorUserId, reason }) {
      return db.transaction(async (tx) => {
        const [job] = await tx
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
          .limit(1)
          .for("update");
        if (!job) {
          throw new Error("Video job not found.");
        }

        const [stitchJob] = await tx
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
        const frameKeys = frameKeysFrom(stitchJob?.frameKeys ?? []);
        if (!stitchJob?.finalVideoKey || frameKeys.length === 0) {
          throw new Error("Successful stitch output is required to reopen Post-QA.");
        }

        const ledger = (await tx
          .select()
          .from(creditLedger)
          .where(eq(creditLedger.relatedJobId, jobId))) as CreditLedgerEntry[];
        const currentReserve = ledger.find(
          (entry) => entry.id === job.reservedLedgerId && entry.type === "reserve",
        );
        const currentReservationResolved = currentReserve
          ? reservationIsResolved(ledger, currentReserve.id)
          : true;
        const before = job as AdminJobActionRecord;
        if (
          job.status === "post_qa_queued" &&
          currentReserve &&
          isReopenReservation(currentReserve, jobId) &&
          !currentReservationResolved
        ) {
          return {
            before,
            after: before,
            stitchJob: stitchJob as AdminPostQaReopenStitchRecord,
            frameKeys,
            reservedLedgerId: currentReserve.id,
            idempotent: true,
          };
        }
        if (job.status === "post_qa_failed") {
          throw new Error("Video job is not settled after Post-QA failure.");
        }
        if (!["failed_released", "failed_refunded"].includes(job.status)) {
          throw new Error("Video job is not failed in Post-QA.");
        }

        let reservedLedgerId = currentReserve?.id ?? null;
        if (job.creditCost > 0 && (!currentReserve || currentReservationResolved)) {
          const reserveResult = await reserveCredits({
            store: createDrizzleCreditLedgerStoreForTransaction(tx),
            userId: job.userId,
            amount: job.creditCost,
            reason,
            idempotencyKey: `reserve:job:${jobId}:post_qa_reopen:${currentReserve?.id ?? "none"}`,
            relatedJobId: jobId,
            metadata: {
              actorUserId,
              priorReservedLedgerId: currentReserve?.id ?? null,
            },
          });
          reservedLedgerId = reserveResult.ledger.id;
        }

        const [after] = await tx
          .update(videoJobs)
          .set({
            status: "post_qa_queued",
            userVisibleStatus: "quality_checking",
            reservedLedgerId,
            failureReason: null,
            lastError: null,
            lockedBy: null,
            lockedUntil: null,
            nextRetryAt: null,
            updatedAt: new Date(),
          })
          .where(and(eq(videoJobs.id, jobId), eq(videoJobs.status, job.status)))
          .returning({
            id: videoJobs.id,
            userId: videoJobs.userId,
            status: videoJobs.status,
            creditCost: videoJobs.creditCost,
            reservedLedgerId: videoJobs.reservedLedgerId,
            failureReason: videoJobs.failureReason,
          });
        if (!after) {
          throw new Error("Video job changed while reopening Post-QA.");
        }

        await tx.insert(jobStateEvents).values([
          {
            videoJobId: jobId,
            fromStatus: job.status,
            toStatus: "retrying",
            reason: "admin_reopen_post_qa",
            actorType: "admin",
            actorId: actorUserId,
            eventSnapshot: {
              reason,
              stitchJobId: stitchJob.id,
              reservedLedgerId,
            },
          },
          {
            videoJobId: jobId,
            fromStatus: "retrying",
            toStatus: "post_qa_queued",
            reason: "admin_reopen_post_qa_requeued",
            actorType: "admin",
            actorId: actorUserId,
            eventSnapshot: {
              stitchJobId: stitchJob.id,
              frameCount: frameKeys.length,
              reservedLedgerId,
            },
          },
        ]);

        return {
          before,
          after: after as AdminJobActionRecord,
          stitchJob: stitchJob as AdminPostQaReopenStitchRecord,
          frameKeys,
          reservedLedgerId,
          idempotent: false,
        };
      });
    },
  };
}
