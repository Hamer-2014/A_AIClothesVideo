import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { assets, videoJobs, videoSegments } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  createEvoLinkVideoGeneration,
  pollEvoLinkTask,
  type EvoLinkTaskResult,
  type EvoLinkVideoGenerationInput,
  type EvoLinkVideoGenerationResult,
} from "@/lib/providers/evolink/video";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
} from "@/lib/providers/log-call";
import { createDownloadSignedUrl } from "@/lib/storage/presign";
import { buildSegmentVideoKey } from "@/lib/storage/keys";
import { transferRemoteFileToR2 } from "@/lib/storage/transfer";
import {
  createDrizzleJobStore,
  type JobStore,
  transitionJobStatus,
} from "@/server/jobs/state-machine";
import type { VideoSegmentRecord } from "@/server/storyboard/confirm";

export interface VideoSegmentJobRecord {
  id: string;
  userId: string;
  status: string;
  aspectRatio: string;
}

export interface VideoSegmentAssetRecord {
  id: string;
  userId: string;
  originalKey: string;
}

export interface VideoSegmentStore {
  findJob(jobId: string): Promise<VideoSegmentJobRecord | null>;
  findSegment(input: {
    jobId: string;
    segmentId: string;
  }): Promise<VideoSegmentRecord | null>;
  listAssetsByIds(assetIds: string[]): Promise<VideoSegmentAssetRecord[]>;
  listSegmentsForJob(jobId: string): Promise<VideoSegmentRecord[]>;
  updateSegment(
    segmentId: string,
    changes: Partial<VideoSegmentRecord>,
  ): Promise<VideoSegmentRecord>;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function assetIdsFromSnapshot(snapshot: JsonValue) {
  const record = asRecord(snapshot);
  const list = Array.isArray(record.assets) ? record.assets : [];

  return list
    .map((item) => asRecord(item).assetId)
    .filter((assetId): assetId is string => typeof assetId === "string");
}

async function signedUrlsForSegment({
  segment,
  store,
  createSignedUrl,
}: {
  segment: VideoSegmentRecord;
  store: VideoSegmentStore;
  createSignedUrl: (input: { key: string }) => Promise<string>;
}) {
  const assetIds = assetIdsFromSnapshot(segment.inputAssetSnapshot);
  const assetRecords = await store.listAssetsByIds(assetIds);

  return Promise.all(
    assetRecords
      .sort((a, b) => assetIds.indexOf(a.id) - assetIds.indexOf(b.id))
      .map((asset) => createSignedUrl({ key: asset.originalKey })),
  );
}

export async function submitQueuedSegment({
  jobStore = createDrizzleJobStore(),
  segmentStore,
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  jobId,
  segmentId,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  createVideoGeneration = createEvoLinkVideoGeneration,
}: {
  jobStore?: JobStore;
  segmentStore: VideoSegmentStore;
  providerCallLogStore?: ProviderCallLogStore;
  jobId: string;
  segmentId: string;
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  createVideoGeneration?: (
    input: EvoLinkVideoGenerationInput,
  ) => Promise<EvoLinkVideoGenerationResult>;
}) {
  const job = await segmentStore.findJob(jobId);
  if (!job) {
    throw new Error("Video job not found.");
  }

  const segment = await segmentStore.findSegment({ jobId, segmentId });
  if (!segment) {
    throw new Error("Video segment not found.");
  }

  if (segment.status !== "queued") {
    throw new Error("Video segment is not queued.");
  }

  const imageUrls = await signedUrlsForSegment({
    segment,
    store: segmentStore,
    createSignedUrl,
  });
  const startedAt = Date.now();

  let providerResult: EvoLinkVideoGenerationResult;
  try {
    providerResult = await createVideoGeneration({
      prompt: segment.prompt,
      imageUrls,
      aspectRatio: job.aspectRatio,
    });
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: "evolink",
      model: "unknown",
      purpose: "video_generation",
      userId: job.userId,
      videoJobId: jobId,
      segmentId,
      requestSnapshot: {
        templateId: segment.templateId,
        assetCount: imageUrls.length,
      },
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "video_generation_submit_failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  const callLog = await providerCallLogStore.createCallLog({
    provider: providerResult.provider,
    model: providerResult.model,
    purpose: "video_generation",
    userId: job.userId,
    videoJobId: jobId,
    segmentId,
    requestSnapshot: {
      templateId: segment.templateId,
      assetCount: imageUrls.length,
    },
    responseSummary: providerResult.raw,
    durationMs: Date.now() - startedAt,
    status: "succeeded",
    providerTaskId: providerResult.providerTaskId,
  });

  await segmentStore.updateSegment(segmentId, {
    status: "generating",
    provider: providerResult.provider,
    model: providerResult.model,
    providerTaskId: providerResult.providerTaskId,
    providerCallLogId: callLog.id,
  });
  if (job.status === "segments_queued") {
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "segment_generating",
      reason: "segment_submitted",
      eventSnapshot: {
        segmentId,
        provider: providerResult.provider,
        model: providerResult.model,
        providerTaskId: providerResult.providerTaskId,
      },
    });
  }

  return {
    jobId,
    segmentId,
    status: "generating" as const,
    providerTaskId: providerResult.providerTaskId,
  };
}

export async function pollSubmittedSegment({
  jobStore = createDrizzleJobStore(),
  segmentStore,
  jobId,
  segmentId,
  pollTask = pollEvoLinkTask,
  storeProviderOutput,
}: {
  jobStore?: JobStore;
  segmentStore: VideoSegmentStore;
  jobId: string;
  segmentId: string;
  pollTask?: (providerTaskId: string) => Promise<EvoLinkTaskResult>;
  storeProviderOutput: (input: {
    jobId: string;
    segmentId: string;
    outputUrl: string;
  }) => Promise<string>;
}) {
  const segment = await segmentStore.findSegment({ jobId, segmentId });
  if (!segment) {
    throw new Error("Video segment not found.");
  }

  if (!segment.providerTaskId) {
    throw new Error("Video segment is missing provider task id.");
  }

  const task = await pollTask(segment.providerTaskId);

  if (task.status === "failed") {
    await segmentStore.updateSegment(segmentId, {
      status: "failed",
      lastError: "Provider task failed.",
    });
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "segment_failed",
      reason: "provider_task_failed",
      eventSnapshot: { segmentId, providerTaskId: segment.providerTaskId },
    });
    return {
      jobId,
      segmentId,
      status: "failed" as const,
      videoKey: null,
    };
  }

  if (task.status !== "succeeded") {
    return {
      jobId,
      segmentId,
      status: "generating" as const,
      videoKey: null,
    };
  }

  if (!task.outputUrl) {
    throw new Error("Provider task succeeded without output URL.");
  }

  const videoKey = await storeProviderOutput({
    jobId,
    segmentId,
    outputUrl: task.outputUrl,
  });
  await segmentStore.updateSegment(segmentId, {
    status: "succeeded",
    videoKey,
  });
  const allSegments = await segmentStore.listSegmentsForJob(jobId);
  const allSucceeded = allSegments.every((jobSegment) =>
    jobSegment.id === segmentId ? true : jobSegment.status === "succeeded",
  );

  if (allSucceeded) {
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "segment_succeeded",
      reason: "all_segment_videos_stored",
      eventSnapshot: { segmentId, videoKey },
    });
  }

  return {
    jobId,
    segmentId,
    status: "succeeded" as const,
    videoKey,
  };
}

export function createInMemoryVideoSegmentStore({
  jobs,
  segments: initialSegments,
  assets: initialAssets,
}: {
  jobs: VideoSegmentJobRecord[];
  segments: VideoSegmentRecord[];
  assets: VideoSegmentAssetRecord[];
}): VideoSegmentStore & {
  listSegments: () => VideoSegmentRecord[];
  updateSegment: (
    segmentId: string,
    changes: Partial<VideoSegmentRecord>,
  ) => Promise<VideoSegmentRecord>;
} {
  const jobRecords = new Map(jobs.map((job) => [job.id, { ...job }]));
  const segmentRecords = new Map(
    initialSegments.map((segment) => [segment.id, { ...segment }]),
  );
  const assetRecords = new Map(initialAssets.map((asset) => [asset.id, { ...asset }]));

  return {
    async findJob(jobId) {
      const job = jobRecords.get(jobId);
      return job ? { ...job } : null;
    },
    async findSegment({ jobId, segmentId }) {
      const segment = segmentRecords.get(segmentId);
      return segment && segment.videoJobId === jobId ? { ...segment } : null;
    },
    async listAssetsByIds(assetIds) {
      return assetIds
        .map((assetId) => assetRecords.get(assetId))
        .filter((asset): asset is VideoSegmentAssetRecord => Boolean(asset))
        .map((asset) => ({ ...asset }));
    },
    async listSegmentsForJob(jobId) {
      return Array.from(segmentRecords.values())
        .filter((segment) => segment.videoJobId === jobId)
        .sort((a, b) => a.segmentIndex - b.segmentIndex)
        .map((segment) => ({ ...segment }));
    },
    async updateSegment(segmentId, changes) {
      const segment = segmentRecords.get(segmentId);
      if (!segment) {
        throw new Error(`Video segment not found: ${segmentId}.`);
      }

      const updated: VideoSegmentRecord = {
        ...segment,
        ...changes,
        updatedAt: new Date(),
      };
      segmentRecords.set(segmentId, updated);
      return { ...updated };
    },
    listSegments() {
      return Array.from(segmentRecords.values()).map((segment) => ({ ...segment }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleVideoSegmentStore(
  db: DbClient = getDb(),
): VideoSegmentStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          aspectRatio: videoJobs.aspectRatio,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as VideoSegmentJobRecord | undefined) ?? null;
    },
    async findSegment({ jobId, segmentId }) {
      const [segment] = await db
        .select()
        .from(videoSegments)
        .where(
          and(
            eq(videoSegments.id, segmentId),
            eq(videoSegments.videoJobId, jobId),
          ),
        )
        .limit(1);

      return (segment as VideoSegmentRecord | undefined) ?? null;
    },
    async listAssetsByIds(assetIds) {
      if (assetIds.length === 0) {
        return [];
      }

      const rows = await Promise.all(
        assetIds.map(async (assetId) => {
          const [asset] = await db
            .select({
              id: assets.id,
              userId: assets.userId,
              originalKey: assets.originalKey,
            })
            .from(assets)
            .where(eq(assets.id, assetId))
            .limit(1);

          return asset as VideoSegmentAssetRecord | undefined;
        }),
      );

      return rows.filter((row): row is VideoSegmentAssetRecord => Boolean(row));
    },
    async listSegmentsForJob(jobId) {
      return db
        .select()
        .from(videoSegments)
        .where(eq(videoSegments.videoJobId, jobId));
    },
    async updateSegment(segmentId, changes) {
      const [segment] = await db
        .update(videoSegments)
        .set(changes)
        .where(eq(videoSegments.id, segmentId))
        .returning();

      if (!segment) {
        throw new Error(`Video segment not found: ${segmentId}.`);
      }

      return segment as VideoSegmentRecord;
    },
  };
}

export async function defaultStoreProviderOutput({
  jobId,
  segmentId,
  outputUrl,
}: {
  jobId: string;
  segmentId: string;
  outputUrl: string;
}) {
  const key = buildSegmentVideoKey(jobId, segmentId);
  await transferRemoteFileToR2({
    url: outputUrl,
    key,
    contentType: "video/mp4",
  });

  return key;
}
