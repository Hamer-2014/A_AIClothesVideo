import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { stitchJobs, videoJobs, videoSegments } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import { buildCoverKey, buildFinalVideoKey } from "@/lib/storage/keys";
import {
  createDrizzleJobStore,
  type JobStore,
  transitionJobStatus,
} from "@/server/jobs/state-machine";
import {
  triggerCloudRunStitchJob,
  type CloudRunStitchPayload,
  type CloudRunStitchTriggerResult,
} from "./trigger-cloud-run";

export interface StitchJobSourceRecord {
  id: string;
  status: string;
  isTest: boolean;
}

export interface StitchSegmentRecord {
  id: string;
  videoJobId: string;
  segmentIndex: number;
  status: string;
  videoKey: string | null;
}

export interface StitchJobRecord {
  id: string;
  videoJobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  segmentKeys: JsonValue;
  finalVideoKey: string | null;
  coverKey: string | null;
  frameKeys: JsonValue;
  callbackSnapshot: JsonValue | null;
  isTest: boolean;
  lockedBy: string | null;
  lockedUntil: Date | null;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewStitchJobRecord {
  videoJobId: string;
  segmentKeys: string[];
  isTest: boolean;
}

export interface StitchStore {
  findJob(jobId: string): Promise<StitchJobSourceRecord | null>;
  listSegments(jobId: string): Promise<StitchSegmentRecord[]>;
  createStitchJob(input: NewStitchJobRecord): Promise<StitchJobRecord>;
  findQueuedStitchJobForVideo(jobId: string): Promise<StitchJobRecord | null>;
  findStitchJob(stitchJobId: string): Promise<StitchJobRecord | null>;
  updateStitchJob(
    stitchJobId: string,
    changes: Partial<StitchJobRecord>,
  ): Promise<StitchJobRecord>;
  updateVideoJobOutput(input: {
    jobId: string;
    finalVideoKey: string;
    coverKey: string | null;
  }): Promise<void>;
}

export interface StitchDispatchResult {
  jobId: string;
  stitchJobId: string;
  status: "queued";
  segmentCount: number;
  segmentKeys: string[];
  finalVideoKey: string;
  coverKey?: string | null;
  frameKeyPrefix?: string | null;
  callbackUrl: string;
}

function asStringArray(value: JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function buildDispatchResult({
  jobId,
  stitchJob,
  segmentKeys,
}: {
  jobId: string;
  stitchJob: StitchJobRecord;
  segmentKeys: string[];
}): StitchDispatchResult {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/+$/, "");
  if (!appUrl) {
    throw new Error("APP_URL is required to create a Cloud Run stitch callback URL.");
  }

  return {
    jobId,
    stitchJobId: stitchJob.id,
    status: "queued",
    segmentCount: segmentKeys.length,
    segmentKeys,
    finalVideoKey: buildFinalVideoKey(jobId),
    coverKey: buildCoverKey(jobId),
    frameKeyPrefix: `jobs/${jobId}/qa/frames`,
    callbackUrl: `${appUrl}/api/internal/stitch/callback`,
  };
}

export async function createStitchJobForVideo({
  jobStore = createDrizzleJobStore(),
  stitchStore,
  jobId,
}: {
  jobStore?: JobStore;
  stitchStore: StitchStore;
  jobId: string;
}) {
  const job = await stitchStore.findJob(jobId);
  if (!job) {
    throw new Error("Video job not found.");
  }

  const segments = await stitchStore.listSegments(jobId);
  const sortedSegments = segments.sort((a, b) => a.segmentIndex - b.segmentIndex);
  const segmentKeys = sortedSegments.map((segment) => segment.videoKey);

  if (
    sortedSegments.length === 0 ||
    sortedSegments.some((segment) => segment.status !== "succeeded") ||
    segmentKeys.some((key) => !key)
  ) {
    throw new Error("All video segments must be succeeded before stitching.");
  }

  const stitchJob = await stitchStore.createStitchJob({
    videoJobId: jobId,
    segmentKeys: segmentKeys as string[],
    isTest: job.isTest,
  });
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "stitching_queued",
    reason: "stitch_job_created",
    eventSnapshot: {
      stitchJobId: stitchJob.id,
      segmentKeys,
    },
  });
  return buildDispatchResult({
    jobId,
    stitchJob,
    segmentKeys: segmentKeys as string[],
  });
}

export async function getQueuedStitchJobPayloadForVideo({
  stitchStore,
  jobId,
}: {
  stitchStore: StitchStore;
  jobId: string;
}) {
  const stitchJob = await stitchStore.findQueuedStitchJobForVideo(jobId);
  if (!stitchJob) {
    throw new Error("Queued stitch job not found.");
  }

  return buildDispatchResult({
    jobId,
    stitchJob,
    segmentKeys: asStringArray(stitchJob.segmentKeys),
  });
}

export async function triggerQueuedStitchJobForVideo({
  jobStore = createDrizzleJobStore(),
  stitchStore,
  jobId,
  triggerCloudRun = (payload) => triggerCloudRunStitchJob({ payload }),
}: {
  jobStore?: JobStore;
  stitchStore: StitchStore;
  jobId: string;
  triggerCloudRun?: (
    payload: CloudRunStitchPayload,
  ) => Promise<CloudRunStitchTriggerResult>;
}) {
  const result = await getQueuedStitchJobPayloadForVideo({ stitchStore, jobId });
  const cloudRun = await triggerCloudRun({
    stitchJobId: result.stitchJobId,
    videoJobId: result.jobId,
    segmentKeys: result.segmentKeys,
    finalVideoKey: result.finalVideoKey,
    coverKey: result.coverKey,
    frameKeyPrefix: result.frameKeyPrefix,
    callbackUrl: result.callbackUrl,
  });
  await markStitchJobRunning({
    jobStore,
    stitchStore,
    stitchJobId: result.stitchJobId,
  });

  return {
    ...result,
    cloudRun,
  };
}

export async function createAndTriggerStitchJobForVideo({
  jobStore = createDrizzleJobStore(),
  stitchStore,
  jobId,
  triggerCloudRun = (payload) => triggerCloudRunStitchJob({ payload }),
}: {
  jobStore?: JobStore;
  stitchStore: StitchStore;
  jobId: string;
  triggerCloudRun?: (
    payload: CloudRunStitchPayload,
  ) => Promise<CloudRunStitchTriggerResult>;
}) {
  const existing = await stitchStore.findQueuedStitchJobForVideo(jobId);
  const result = existing
    ? await getQueuedStitchJobPayloadForVideo({ stitchStore, jobId })
    : await createStitchJobForVideo({ jobStore, stitchStore, jobId });
  const cloudRun = await triggerCloudRun({
    stitchJobId: result.stitchJobId,
    videoJobId: result.jobId,
    segmentKeys: result.segmentKeys,
    finalVideoKey: result.finalVideoKey,
    coverKey: result.coverKey,
    frameKeyPrefix: result.frameKeyPrefix,
    callbackUrl: result.callbackUrl,
  });
  await markStitchJobRunning({
    jobStore,
    stitchStore,
    stitchJobId: result.stitchJobId,
  });

  return {
    ...result,
    cloudRun,
  };
}

export async function handleStitchCallback({
  jobStore = createDrizzleJobStore(),
  stitchStore,
  stitchJobId,
  status,
  finalVideoKey,
  coverKey,
  frameKeys,
  callbackSnapshot,
}: {
  jobStore?: JobStore;
  stitchStore: StitchStore;
  stitchJobId: string;
  status: "succeeded" | "failed";
  finalVideoKey?: string | null;
  coverKey?: string | null;
  frameKeys?: string[];
  callbackSnapshot?: JsonValue | null;
}) {
  const stitchJob = await stitchStore.findStitchJob(stitchJobId);
  if (!stitchJob) {
    throw new Error("Stitch job not found.");
  }

  if (status === "failed") {
    await stitchStore.updateStitchJob(stitchJobId, {
      status: "failed",
      callbackSnapshot: callbackSnapshot ?? null,
    });
    await transitionJobStatus({
      store: jobStore,
      jobId: stitchJob.videoJobId,
      toStatus: "post_qa_failed",
      reason: "stitch_failed",
      eventSnapshot: { stitchJobId, callbackSnapshot: callbackSnapshot ?? null },
    });
    return {
      jobId: stitchJob.videoJobId,
      stitchJobId,
      status: "post_qa_failed" as const,
    };
  }

  if (!finalVideoKey) {
    throw new Error("Successful stitch callback is missing final video key.");
  }

  await stitchStore.updateStitchJob(stitchJobId, {
    status: "succeeded",
    finalVideoKey,
    coverKey: coverKey ?? null,
    frameKeys: frameKeys ?? [],
    callbackSnapshot: callbackSnapshot ?? null,
  });
  await stitchStore.updateVideoJobOutput({
    jobId: stitchJob.videoJobId,
    finalVideoKey,
    coverKey: coverKey ?? null,
  });
  await transitionJobStatus({
    store: jobStore,
    jobId: stitchJob.videoJobId,
    toStatus: "post_qa_queued",
    reason: "stitch_succeeded",
    eventSnapshot: {
      stitchJobId,
      finalVideoKey,
      coverKey: coverKey ?? null,
      frameKeys: frameKeys ?? [],
    },
  });

  return {
    jobId: stitchJob.videoJobId,
    stitchJobId,
    status: "post_qa_queued" as const,
  };
}

export async function markStitchJobRunning({
  jobStore = createDrizzleJobStore(),
  stitchStore,
  stitchJobId,
}: {
  jobStore?: JobStore;
  stitchStore: StitchStore;
  stitchJobId: string;
}) {
  const stitchJob = await stitchStore.findStitchJob(stitchJobId);
  if (!stitchJob) {
    throw new Error("Stitch job not found.");
  }

  const updated = await stitchStore.updateStitchJob(stitchJobId, {
    status: "running",
  });
  await transitionJobStatus({
    store: jobStore,
    jobId: stitchJob.videoJobId,
    toStatus: "stitching_running",
    reason: "cloud_run_stitch_started",
    eventSnapshot: { stitchJobId },
  });

  return {
    jobId: stitchJob.videoJobId,
    stitchJobId,
    status: updated.status,
  };
}

export function createInMemoryStitchStore({
  jobs,
  segments,
}: {
  jobs: StitchJobSourceRecord[];
  segments: StitchSegmentRecord[];
}): StitchStore & {
  listStitchJobs: () => StitchJobRecord[];
} {
  const jobRecords = new Map(jobs.map((job) => [job.id, { ...job }]));
  const segmentRecords = segments.map((segment) => ({ ...segment }));
  const stitchRecords = new Map<string, StitchJobRecord>();

  return {
    async findJob(jobId) {
      const job = jobRecords.get(jobId);
      return job ? { ...job } : null;
    },
    async listSegments(jobId) {
      return segmentRecords
        .filter((segment) => segment.videoJobId === jobId)
        .map((segment) => ({ ...segment }));
    },
    async createStitchJob(input) {
      const now = new Date();
      const record: StitchJobRecord = {
        id: randomUUID(),
        videoJobId: input.videoJobId,
        status: "queued",
        segmentKeys: input.segmentKeys,
        finalVideoKey: null,
        coverKey: null,
        frameKeys: [],
        callbackSnapshot: null,
        isTest: input.isTest,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: now,
        updatedAt: now,
      };
      stitchRecords.set(record.id, record);
      return { ...record };
    },
    async findQueuedStitchJobForVideo(jobId) {
      const stitchJob = Array.from(stitchRecords.values()).find(
        (record) => record.videoJobId === jobId && record.status === "queued",
      );

      return stitchJob ? { ...stitchJob } : null;
    },
    async findStitchJob(stitchJobId) {
      const job = stitchRecords.get(stitchJobId);
      return job ? { ...job } : null;
    },
    async updateStitchJob(stitchJobId, changes) {
      const job = stitchRecords.get(stitchJobId);
      if (!job) {
        throw new Error(`Stitch job not found: ${stitchJobId}.`);
      }
      const updated = { ...job, ...changes, updatedAt: new Date() };
      stitchRecords.set(stitchJobId, updated);
      return { ...updated };
    },
    async updateVideoJobOutput({ jobId, finalVideoKey, coverKey }) {
      const job = jobRecords.get(jobId);
      if (!job) {
        throw new Error(`Video job not found: ${jobId}.`);
      }
      jobRecords.set(jobId, {
        ...job,
        finalVideoKey,
        coverKey,
      } as StitchJobSourceRecord);
    },
    listStitchJobs() {
      return Array.from(stitchRecords.values()).map((job) => ({ ...job }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleStitchStore(db: DbClient = getDb()): StitchStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          status: videoJobs.status,
          isTest: videoJobs.isTest,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as StitchJobSourceRecord | undefined) ?? null;
    },
    async listSegments(jobId) {
      return db
        .select({
          id: videoSegments.id,
          videoJobId: videoSegments.videoJobId,
          segmentIndex: videoSegments.segmentIndex,
          status: videoSegments.status,
          videoKey: videoSegments.videoKey,
        })
        .from(videoSegments)
        .where(eq(videoSegments.videoJobId, jobId));
    },
    async createStitchJob(input) {
      const [record] = await db
        .insert(stitchJobs)
        .values(input)
        .returning();

      if (!record) {
        throw new Error("Failed to create stitch job.");
      }

      return record as StitchJobRecord;
    },
    async findQueuedStitchJobForVideo(jobId) {
      const [record] = await db
        .select()
        .from(stitchJobs)
        .where(
          and(eq(stitchJobs.videoJobId, jobId), eq(stitchJobs.status, "queued")),
        )
        .limit(1);

      return (record as StitchJobRecord | undefined) ?? null;
    },
    async findStitchJob(stitchJobId) {
      const [record] = await db
        .select()
        .from(stitchJobs)
        .where(eq(stitchJobs.id, stitchJobId))
        .limit(1);

      return (record as StitchJobRecord | undefined) ?? null;
    },
    async updateStitchJob(stitchJobId, changes) {
      const [record] = await db
        .update(stitchJobs)
        .set(changes)
        .where(eq(stitchJobs.id, stitchJobId))
        .returning();

      if (!record) {
        throw new Error(`Stitch job not found: ${stitchJobId}.`);
      }

      return record as StitchJobRecord;
    },
    async updateVideoJobOutput({ jobId, finalVideoKey, coverKey }) {
      await db
        .update(videoJobs)
        .set({ finalVideoKey, coverKey })
        .where(eq(videoJobs.id, jobId));
    },
  };
}
