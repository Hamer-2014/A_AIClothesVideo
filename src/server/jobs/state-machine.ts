import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  jobStateEvents,
  type jobStatusValues,
  videoJobs,
} from "@/lib/db/schema/jobs";
import { eq } from "drizzle-orm";

export type JobStatus = (typeof jobStatusValues)[number];

export interface JobRecord {
  id: string;
  userId: string;
  status: JobStatus;
  userVisibleStatus?: string;
  failureReason?: string | null;
  lockedBy: string | null;
  lockedUntil: Date | null;
  attemptCount: number;
  lastError: string | null;
}

export interface JobStateEventRecord {
  id: string;
  videoJobId: string;
  segmentId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
  actorId: string | null;
  eventSnapshot: JsonValue | null;
  createdAt: Date;
}

export interface JobStatusChanges {
  status: JobStatus;
  lastError?: string | null;
  userVisibleStatus?: string;
  failureReason?: string | null;
  lockedBy?: string | null;
  lockedUntil?: Date | null;
  clearLock?: boolean;
}

export interface NewJobStateEvent {
  videoJobId: string;
  segmentId?: string | null;
  fromStatus?: string | null;
  toStatus: string;
  reason?: string | null;
  actorType?: string;
  actorId?: string | null;
  eventSnapshot?: JsonValue | null;
}

export interface JobStore {
  findJob(jobId: string): Promise<JobRecord | null>;
  updateJobStatus(
    jobId: string,
    changes: JobStatusChanges,
  ): Promise<JobRecord>;
  createStateEvent(input: NewJobStateEvent): Promise<JobStateEventRecord>;
}

const allowedTransitions: Partial<Record<JobStatus, JobStatus[]>> = {
  draft_uploaded: ["lite_check_queued", "asset_analysis_queued"],
  lite_check_queued: ["lite_check_running"],
  lite_check_running: ["lite_check_passed", "lite_check_failed"],
  lite_check_passed: ["asset_analysis_queued"],
  lite_check_failed: ["failed_released", "failed_refunded"],
  asset_analysis_queued: ["asset_analysis_running"],
  asset_analysis_running: [
    "asset_analysis_passed",
    "asset_analysis_failed",
    "storyboard_draft_ready",
  ],
  asset_analysis_failed: [
    "retrying",
    "asset_analysis_running",
    "failed_released",
    "failed_refunded",
  ],
  asset_analysis_passed: ["storyboard_draft_ready"],
  storyboard_draft_ready: ["storyboard_confirmed"],
  storyboard_confirmed: ["prompt_moderation_running"],
  prompt_moderation_running: [
    "prompt_moderation_passed",
    "prompt_moderation_blocked",
  ],
  prompt_moderation_passed: ["credits_reserved"],
  prompt_moderation_blocked: ["failed_released", "failed_refunded"],
  credits_reserved: ["segments_queued"],
  segments_queued: ["segment_generating", "segment_failed"],
  segment_generating: ["segment_succeeded", "segment_failed"],
  segment_succeeded: ["stitching_queued"],
  segment_failed: [
    "segment_succeeded",
    "retrying",
    "failed_released",
    "failed_refunded",
  ],
  stitching_queued: ["stitching_running"],
  stitching_running: ["stitched", "post_qa_queued", "post_qa_running"],
  stitched: ["post_qa_queued", "post_qa_running"],
  post_qa_queued: ["post_qa_running"],
  post_qa_running: ["post_qa_passed", "post_qa_failed"],
  post_qa_passed: ["deliverable"],
  post_qa_failed: ["retrying", "failed_released", "failed_refunded"],
  failed_released: ["retrying"],
  retrying: [
    "lite_check_queued",
    "asset_analysis_queued",
    "segments_queued",
    "post_qa_queued",
  ],
};

function isTransitionAllowed(fromStatus: JobStatus, toStatus: JobStatus) {
  return allowedTransitions[fromStatus]?.includes(toStatus) ?? false;
}

export function createInMemoryJobStore(initialJobs: JobRecord[] = []): JobStore & {
  listJobs: () => JobRecord[];
  listEvents: () => JobStateEventRecord[];
} {
  const jobs = new Map(initialJobs.map((job) => [job.id, { ...job }]));
  const events: JobStateEventRecord[] = [];

  return {
    async findJob(jobId) {
      const job = jobs.get(jobId);
      return job ? { ...job } : null;
    },
    async updateJobStatus(jobId, changes) {
      const job = jobs.get(jobId);
      if (!job) {
        throw new Error(`Video job not found: ${jobId}.`);
      }

      const updated: JobRecord = {
        ...job,
        status: changes.status,
        lastError:
          changes.lastError === undefined ? job.lastError : changes.lastError,
        userVisibleStatus:
          changes.userVisibleStatus === undefined
            ? job.userVisibleStatus
            : changes.userVisibleStatus,
        failureReason:
          changes.failureReason === undefined
            ? job.failureReason
            : changes.failureReason,
        lockedBy:
          changes.lockedBy !== undefined
            ? changes.lockedBy
            : changes.clearLock
              ? null
              : job.lockedBy,
        lockedUntil:
          changes.lockedUntil !== undefined
            ? changes.lockedUntil
            : changes.clearLock
              ? null
              : job.lockedUntil,
      };
      jobs.set(jobId, updated);
      return { ...updated };
    },
    async createStateEvent(input) {
      const event: JobStateEventRecord = {
        id: randomUUID(),
        videoJobId: input.videoJobId,
        segmentId: input.segmentId ?? null,
        fromStatus: input.fromStatus ?? null,
        toStatus: input.toStatus,
        reason: input.reason ?? null,
        actorType: input.actorType ?? "system",
        actorId: input.actorId ?? null,
        eventSnapshot: input.eventSnapshot ?? null,
        createdAt: new Date(),
      };
      events.push(event);
      return { ...event };
    },
    listJobs() {
      return Array.from(jobs.values()).map((job) => ({ ...job }));
    },
    listEvents() {
      return events.map((event) => ({ ...event }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobStore(db: DbClient = getDb()): JobStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          failureReason: videoJobs.failureReason,
          lockedBy: videoJobs.lockedBy,
          lockedUntil: videoJobs.lockedUntil,
          attemptCount: videoJobs.attemptCount,
          lastError: videoJobs.lastError,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as JobRecord | undefined) ?? null;
    },
    async updateJobStatus(jobId, changes) {
      const values = {
        status: changes.status,
        ...(changes.lastError !== undefined
          ? { lastError: changes.lastError }
          : {}),
        ...(changes.userVisibleStatus !== undefined
          ? { userVisibleStatus: changes.userVisibleStatus }
          : {}),
        ...(changes.failureReason !== undefined
          ? { failureReason: changes.failureReason }
          : {}),
        ...(changes.clearLock ? { lockedBy: null, lockedUntil: null } : {}),
        ...(changes.lockedBy !== undefined ? { lockedBy: changes.lockedBy } : {}),
        ...(changes.lockedUntil !== undefined
          ? { lockedUntil: changes.lockedUntil }
          : {}),
      };
      const [job] = await db
        .update(videoJobs)
        .set(values)
        .where(eq(videoJobs.id, jobId))
        .returning({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          failureReason: videoJobs.failureReason,
          lockedBy: videoJobs.lockedBy,
          lockedUntil: videoJobs.lockedUntil,
          attemptCount: videoJobs.attemptCount,
          lastError: videoJobs.lastError,
        });

      if (!job) {
        throw new Error(`Video job not found: ${jobId}.`);
      }

      return job as JobRecord;
    },
    async createStateEvent(input) {
      const [event] = await db
        .insert(jobStateEvents)
        .values({
          videoJobId: input.videoJobId,
          segmentId: input.segmentId ?? null,
          fromStatus: input.fromStatus ?? null,
          toStatus: input.toStatus,
          reason: input.reason ?? null,
          actorType: input.actorType ?? "system",
          actorId: input.actorId ?? null,
          eventSnapshot: input.eventSnapshot ?? null,
        })
        .returning();

      if (!event) {
        throw new Error("Failed to create job state event.");
      }

      return event as JobStateEventRecord;
    },
  };
}

export async function transitionJobStatus({
  store,
  jobId,
  toStatus,
  reason,
  actorType = "system",
  actorId,
  eventSnapshot,
  errorMessage,
  userVisibleStatus,
  failureReason,
  clearLock = false,
}: {
  store: JobStore;
  jobId: string;
  toStatus: JobStatus;
  reason?: string | null;
  actorType?: string;
  actorId?: string | null;
  eventSnapshot?: JsonValue | null;
  errorMessage?: string | null;
  userVisibleStatus?: string;
  failureReason?: string | null;
  clearLock?: boolean;
}) {
  const job = await store.findJob(jobId);
  if (!job) {
    throw new Error(`Video job not found: ${jobId}.`);
  }

  if (!isTransitionAllowed(job.status, toStatus)) {
    throw new Error(`Invalid job status transition: ${job.status} -> ${toStatus}.`);
  }

  const updated = await store.updateJobStatus(jobId, {
    status: toStatus,
    lastError: errorMessage === undefined ? job.lastError : errorMessage,
    userVisibleStatus,
    failureReason,
    clearLock,
  });

  try {
    await store.createStateEvent({
      videoJobId: jobId,
      fromStatus: job.status,
      toStatus,
      reason: reason ?? null,
      actorType,
      actorId: actorId ?? null,
      eventSnapshot: eventSnapshot ?? null,
    });
  } catch (error) {
    await store.updateJobStatus(jobId, {
      status: job.status,
      lastError: job.lastError,
      userVisibleStatus: job.userVisibleStatus,
      failureReason: job.failureReason,
      lockedBy: job.lockedBy,
      lockedUntil: job.lockedUntil,
      clearLock: false,
    });
    throw error;
  }

  return updated;
}
