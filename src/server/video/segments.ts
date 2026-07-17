import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { assets, videoJobs, videoSegments } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
} from "@/lib/providers/log-call";
import {
  createVideoGeneration,
  pollVideoGenerationTask,
  pollVideoGenerationTaskForProvider,
  type VideoGenerationProvider,
  type VideoGenerationInput,
  type VideoGenerationResult,
  type VideoTaskResult,
} from "@/lib/providers/video-generation/router";
import { createDownloadSignedUrl } from "@/lib/storage/presign";
import { buildSegmentVideoKey } from "@/lib/storage/keys";
import { transferRemoteFileToR2 } from "@/lib/storage/transfer";
import {
  createDrizzleJobStore,
  type JobStore,
  transitionJobStatus,
} from "@/server/jobs/state-machine";
import type { VideoSegmentRecord } from "@/server/storyboard/confirm";

import { compileVideoPromptForSegment } from "./prompt-compiler";

export interface VideoSegmentJobRecord {
  id: string;
  userId: string;
  status: string;
  aspectRatio: string;
  creditCost: number;
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
  findSegmentByIndex(input: {
    jobId: string;
    segmentIndex: number;
  }): Promise<VideoSegmentRecord | null>;
  claimQueuedSegment(input: {
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

export interface GenerationKickResult {
  status: "submitted" | "failed" | "noop";
  submittedCount: number;
  failedCount: number;
  segmentIds: string[];
  providerTaskIds: string[];
  errorMessage?: string;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxSubmitAttempts() {
  return parsePositiveInteger(
    process.env.VIDEO_GENERATION_SUBMIT_MAX_ATTEMPTS ??
      process.env.EVOLINK_SUBMIT_MAX_ATTEMPTS,
    3,
  );
}

function getMaxTaskRegenerations() {
  return parsePositiveInteger(
    process.env.VIDEO_GENERATION_TASK_MAX_REGENERATIONS ??
      process.env.EVOLINK_TASK_MAX_REGENERATIONS,
    2,
  );
}

type JsonObject = { [key: string]: JsonValue };

export class VideoSegmentAlreadyClaimedError extends Error {
  constructor() {
    super("Video segment is already claimed.");
    this.name = "VideoSegmentAlreadyClaimedError";
  }
}

function getEnvVideoGenerationIdentity(
  env: Record<string, string | undefined> = process.env,
) {
  const provider = env.VIDEO_GENERATION_PROVIDER?.trim().toLowerCase() || "apimart";
  const model =
    env.VIDEO_GENERATION_MODEL?.trim() ||
    (provider === "apimart" ? "pixverse-v6" : "veo3.1-fast-beta");

  return { provider, model };
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

function promptCompilerSnapshot(inputAssetSnapshot: JsonValue) {
  return asRecord(inputAssetSnapshot).promptCompiler;
}

function compiledPromptRequestSnapshot(
  compiledPrompt: ReturnType<typeof compileVideoPromptForSegment>,
): JsonObject {
  return {
    compiledPromptVersion: compiledPrompt.compiledPromptVersion,
    globalHardConstraints: compiledPrompt.globalHardConstraints,
    globalUserIntent: jsonObjectFromRecord(compiledPrompt.globalUserIntent),
    segmentInstruction: compiledPrompt.segmentInstruction,
    compiledPromptSections: compiledPrompt.compiledPromptSections,
  };
}

function jsonObjectFromRecord(value: Record<string, unknown> | null): JsonObject {
  if (!value) {
    return {};
  }

  const result: JsonObject = {};

  for (const [key, item] of Object.entries(value)) {
    if (
      item === null ||
      typeof item === "string" ||
      typeof item === "number" ||
      typeof item === "boolean"
    ) {
      result[key] = item;
      continue;
    }

    if (Array.isArray(item)) {
      result[key] = item.filter(
        (entry): entry is string | number | boolean | null =>
          entry === null ||
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean",
      );
    }
  }

  return result;
}

export async function submitQueuedSegment({
  jobStore = createDrizzleJobStore(),
  segmentStore,
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  jobId,
  segmentId,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  createVideoGeneration: createVideoGenerationFn = createVideoGeneration,
  maxSubmitAttempts = getMaxSubmitAttempts(),
}: {
  jobStore?: JobStore;
  segmentStore: VideoSegmentStore;
  providerCallLogStore?: ProviderCallLogStore;
  jobId: string;
  segmentId: string;
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  createVideoGeneration?: (
    input: VideoGenerationInput,
    deps?: { apiKey?: string; model?: string },
  ) => Promise<VideoGenerationResult>;
  maxSubmitAttempts?: number;
}) {
  const job = await segmentStore.findJob(jobId);
  if (!job) {
    throw new Error("Video job not found.");
  }

  const segment = await segmentStore.claimQueuedSegment({ jobId, segmentId });
  if (!segment) {
    const existingSegment = await segmentStore.findSegment({ jobId, segmentId });
    if (!existingSegment) {
      throw new Error("Video segment not found.");
    }
    throw new VideoSegmentAlreadyClaimedError();
  }

  let imageUrls: string[];
  try {
    imageUrls = await signedUrlsForSegment({
      segment,
      store: segmentStore,
      createSignedUrl,
    });
  } catch (error) {
    await segmentStore.updateSegment(segmentId, {
      status: "queued",
      lastError: errorMessage(error),
    });
    throw error;
  }
  const startedAt = Date.now();
  const envIdentity = getEnvVideoGenerationIdentity();
  const compiledPrompt = compileVideoPromptForSegment({
    finalPromptSnapshot: promptCompilerSnapshot(segment.inputAssetSnapshot),
    segment: {
      prompt: segment.prompt,
      segmentIndex: segment.segmentIndex,
      templateId: segment.templateId,
    },
    inputAssetSnapshot: segment.inputAssetSnapshot,
  });
  let providerResult: VideoGenerationResult | null = null;
  let lastSubmitError: unknown;
  const attempts = Math.max(1, maxSubmitAttempts);
  let successfulAttempt: number | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await segmentStore.updateSegment(segmentId, {
        attemptCount: segment.attemptCount + attempt,
      });
      providerResult = await createVideoGenerationFn({
        prompt: compiledPrompt.prompt,
        imageUrls,
        aspectRatio: job.aspectRatio,
        resolution: segment.resolution,
        audio: segment.audioEnabled,
        watermarkEnabled: segment.watermarkEnabled,
        generationProfile: segment.generationProfile,
      });
      successfulAttempt = attempt;
      break;
    } catch (error) {
      lastSubmitError = error;
      await providerCallLogStore.createCallLog({
        provider: envIdentity.provider,
        providerKeyId: null,
        modelRouteId: null,
        routeSnapshot: null,
        model: envIdentity.model,
        purpose: "video_generation",
        userId: job.userId,
        videoJobId: jobId,
        segmentId,
        requestSnapshot: {
          templateId: segment.templateId,
          assetCount: imageUrls.length,
          attempt,
          maxAttempts: attempts,
          generationProfile: segment.generationProfile,
          resolution: segment.resolution,
          audio: segment.audioEnabled,
          watermarkEnabled: segment.watermarkEnabled,
          configSource: "env",
          ...compiledPromptRequestSnapshot(compiledPrompt),
        },
        durationMs: Date.now() - startedAt,
        status: "failed",
        errorCode: "video_generation_submit_failed",
        errorMessage: errorMessage(error),
      });
    }
  }

  if (!providerResult) {
    await segmentStore.updateSegment(segmentId, {
      status: "queued",
      lastError: errorMessage(lastSubmitError),
    });
    throw lastSubmitError instanceof Error
      ? lastSubmitError
      : new Error("Video generation submit failed.");
  }

  const callLog = await providerCallLogStore.createCallLog({
    provider: providerResult.provider,
    providerKeyId: null,
    modelRouteId: null,
    routeSnapshot: null,
    model: providerResult.model,
    purpose: "video_generation",
    userId: job.userId,
    videoJobId: jobId,
    segmentId,
    requestSnapshot: {
      templateId: segment.templateId,
      assetCount: imageUrls.length,
      attempt: successfulAttempt ?? attempts,
      maxAttempts: attempts,
      generationProfile: segment.generationProfile,
      resolution: segment.resolution,
      audio: segment.audioEnabled,
      watermarkEnabled: segment.watermarkEnabled,
      configSource: "env",
      ...compiledPromptRequestSnapshot(compiledPrompt),
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
    try {
      await transitionJobStatus({
        store: jobStore,
        jobId,
        toStatus: "segment_generating",
        reason: "segment_submitted",
        errorMessage: null,
        failureReason: null,
        userVisibleStatus: "generating",
        eventSnapshot: {
          segmentId,
          provider: providerResult.provider,
          model: providerResult.model,
          providerTaskId: providerResult.providerTaskId,
        },
      });
    } catch (error) {
      const currentJob = await jobStore.findJob(jobId);
      if (currentJob?.status !== "segment_generating") {
        throw error;
      }
    }
  }

  return {
    jobId,
    segmentId,
    status: "generating" as const,
    providerTaskId: providerResult.providerTaskId,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown generation submit error.";
}

export async function kickQueuedSegmentsForJob({
  jobStore = createDrizzleJobStore(),
  segmentStore,
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  jobId,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  createVideoGeneration: createVideoGenerationFn = createVideoGeneration,
  maxSubmitAttempts = getMaxSubmitAttempts(),
}: {
  jobStore?: JobStore;
  segmentStore: VideoSegmentStore;
  providerCallLogStore?: ProviderCallLogStore;
  jobId: string;
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  createVideoGeneration?: (
    input: VideoGenerationInput,
    deps?: { apiKey?: string; model?: string },
  ) => Promise<VideoGenerationResult>;
  maxSubmitAttempts?: number;
}): Promise<GenerationKickResult> {
  const segments = await segmentStore.listSegmentsForJob(jobId);
  const queuedSegments = segments
    .filter((segment) => segment.status === "queued")
    .sort((a, b) => a.segmentIndex - b.segmentIndex);

  if (queuedSegments.length === 0) {
    return {
      status: "noop",
      submittedCount: 0,
      failedCount: 0,
      segmentIds: [],
      providerTaskIds: [],
    };
  }

  const results = await Promise.allSettled(
    queuedSegments.map((segment) =>
      submitQueuedSegment({
        jobStore,
        segmentStore,
        providerCallLogStore,
        jobId,
        segmentId: segment.id,
        createSignedUrl,
        createVideoGeneration: createVideoGenerationFn,
        maxSubmitAttempts,
      }),
    ),
  );
  const submitted = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failures = results.flatMap((result, index) =>
    result.status === "rejected"
      && result.reason instanceof VideoSegmentAlreadyClaimedError
      ? []
      : result.status === "rejected"
      ? [{ segment: queuedSegments[index], message: errorMessage(result.reason) }]
      : [],
  );
  const firstError = failures[0]?.message;

  if (failures.length > 0) {
    await Promise.all(
      failures.map(({ segment, message }) =>
        segmentStore.updateSegment(segment.id, {
          status: "failed",
          lastError: message,
        }),
      ),
    );

    const currentJob = await jobStore.findJob(jobId);
    if (currentJob?.status === "segments_queued" || currentJob?.status === "segment_generating") {
      await transitionJobStatus({
        store: jobStore,
        jobId,
        toStatus: "segment_failed",
        reason: "immediate_segment_submit_failed",
        errorMessage: firstError,
        failureReason: firstError,
        userVisibleStatus: "failed",
        clearLock: true,
        eventSnapshot: {
          failedSegmentIds: failures.map(({ segment }) => segment.id),
          submittedSegmentIds: submitted.map((item) => item.segmentId),
          errorMessage: firstError,
        },
      });
    }
  }

  return {
    status:
      failures.length > 0 ? "failed" : submitted.length > 0 ? "submitted" : "noop",
    submittedCount: submitted.length,
    failedCount: failures.length,
    segmentIds: queuedSegments.map((segment) => segment.id),
    providerTaskIds: submitted.map((item) => item.providerTaskId),
    ...(firstError ? { errorMessage: firstError } : {}),
  };
}

export async function pollSubmittedSegment({
  jobStore = createDrizzleJobStore(),
  segmentStore,
  jobId,
  segmentId,
  pollTask,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  createVideoGeneration: createVideoGenerationFn = createVideoGeneration,
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  maxSubmitAttempts = getMaxSubmitAttempts(),
  maxTaskRegenerations = getMaxTaskRegenerations(),
  storeProviderOutput,
}: {
  jobStore?: JobStore;
  segmentStore: VideoSegmentStore;
  providerCallLogStore?: ProviderCallLogStore;
  jobId: string;
  segmentId: string;
  pollTask?: (
    providerTaskId: string,
    provider?: VideoGenerationProvider,
    deps?: { apiKey?: string; model?: string },
  ) => Promise<VideoTaskResult>;
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  createVideoGeneration?: (
    input: VideoGenerationInput,
    deps?: { apiKey?: string; model?: string },
  ) => Promise<VideoGenerationResult>;
  maxSubmitAttempts?: number;
  maxTaskRegenerations?: number;
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

  const taskProvider =
    segment.provider === "evolink" || segment.provider === "apimart"
      ? segment.provider
      : undefined;
  const task = await (pollTask
    ? pollTask(segment.providerTaskId, taskProvider)
    : taskProvider
      ? pollVideoGenerationTaskForProvider(taskProvider, segment.providerTaskId)
      : pollVideoGenerationTask(segment.providerTaskId));

  if (task.status === "failed") {
    const providerError = task.errorMessage ?? "Provider task failed.";
    if (segment.attemptCount < Math.max(1, maxTaskRegenerations)) {
      await segmentStore.updateSegment(segmentId, {
        status: "queued",
        providerTaskId: null,
        providerCallLogId: null,
        lastError: providerError,
        nextRetryAt: null,
      });
      await submitQueuedSegment({
        jobStore,
        segmentStore,
        providerCallLogStore,
        jobId,
        segmentId,
        createSignedUrl,
        createVideoGeneration: createVideoGenerationFn,
        maxSubmitAttempts,
      });
      return {
        jobId,
        segmentId,
        status: "generating" as const,
        videoKey: null,
      };
    }

    await segmentStore.updateSegment(segmentId, {
      status: "failed",
      lastError: providerError,
    });
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "segment_failed",
      reason: "provider_task_failed",
      errorMessage: providerError,
      eventSnapshot: {
        segmentId,
        providerTaskId: segment.providerTaskId,
        errorMessage: providerError,
      },
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
    ...(task.costEstimate ? { costEstimate: task.costEstimate } : {}),
  });
  const allSegments = await segmentStore.listSegmentsForJob(jobId);
  const allSucceeded = allSegments.every((jobSegment) =>
    jobSegment.id === segmentId ? true : jobSegment.status === "succeeded",
  );

  if (allSucceeded) {
    const currentJob = await jobStore.findJob(jobId);
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "segment_succeeded",
      reason:
        currentJob?.status === "segment_failed"
          ? "repair_all_segments_succeeded_after_transition_conflict"
          : "all_segment_videos_stored",
      errorMessage: null,
      failureReason: null,
      userVisibleStatus: "generating",
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
    async findSegmentByIndex({ jobId, segmentIndex }) {
      const segment = Array.from(segmentRecords.values()).find(
        (item) =>
          item.videoJobId === jobId && item.segmentIndex === segmentIndex,
      );
      return segment ? { ...segment } : null;
    },
    async claimQueuedSegment({ jobId, segmentId }) {
      const segment = segmentRecords.get(segmentId);
      if (!segment || segment.videoJobId !== jobId || segment.status !== "queued") {
        return null;
      }

      const updated: VideoSegmentRecord = {
        ...segment,
        status: "generating",
        updatedAt: new Date(),
      };
      segmentRecords.set(segmentId, updated);
      return { ...updated };
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
          creditCost: videoJobs.creditCost,
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
    async findSegmentByIndex({ jobId, segmentIndex }) {
      const [segment] = await db
        .select()
        .from(videoSegments)
        .where(
          and(
            eq(videoSegments.videoJobId, jobId),
            eq(videoSegments.segmentIndex, segmentIndex),
          ),
        )
        .limit(1);

      return (segment as VideoSegmentRecord | undefined) ?? null;
    },
    async claimQueuedSegment({ jobId, segmentId }) {
      const [segment] = await db
        .update(videoSegments)
        .set({
          status: "generating",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(videoSegments.id, segmentId),
            eq(videoSegments.videoJobId, jobId),
            eq(videoSegments.status, "queued"),
          ),
        )
        .returning();

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
