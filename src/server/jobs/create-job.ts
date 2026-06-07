import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { assets, jobStateEvents, videoJobAssets, videoJobs } from "@/lib/db/schema";
import type { assetRoleValues, assetStatusValues } from "@/lib/db/schema/assets";
import type {
  videoAspectRatioValues,
  jobStatusValues,
} from "@/lib/db/schema/jobs";

export type AssetRole = (typeof assetRoleValues)[number];
export type AssetStatus = (typeof assetStatusValues)[number];
export type VideoAspectRatio = (typeof videoAspectRatioValues)[number];
export type JobStatus = (typeof jobStatusValues)[number];

export interface JobCreatableAsset {
  id: string;
  userId: string;
  status: AssetStatus;
  detectedRole: AssetRole | null;
}

export interface CreatedVideoJob {
  id: string;
  userId: string;
  status: JobStatus;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: VideoAspectRatio;
  postQaMode: "lite" | "standard" | "strict" | "off";
  postQaRequired: string;
  creditCost: number;
  isTest: boolean;
}

export interface CreatedVideoJobAsset {
  id: string;
  videoJobId: string;
  assetId: string;
  role: string;
  sortOrder: number;
}

export interface VideoJobCreationEvent {
  id: string;
  videoJobId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
}

export interface VideoJobCreationStore {
  findOwnedAssets(input: {
    userId: string;
    assetIds: string[];
  }): Promise<JobCreatableAsset[]>;
  createJob(input: Omit<CreatedVideoJob, "id">): Promise<CreatedVideoJob>;
  createJobAsset(input: Omit<CreatedVideoJobAsset, "id">): Promise<CreatedVideoJobAsset>;
  createStateEvent(input: Omit<VideoJobCreationEvent, "id">): Promise<VideoJobCreationEvent>;
}

const allowedDurations = [8, 16, 24] as const;
const allowedAspectRatios: VideoAspectRatio[] = ["9:16", "1:1", "16:9"];

function creditCostForDuration(durationSeconds: number, isTrial: boolean) {
  if (isTrial) {
    return 0;
  }

  switch (durationSeconds) {
    case 8:
      return 70;
    case 16:
      return 130;
    case 24:
      return 190;
    default:
      throw new Error("Unsupported video duration.");
  }
}

function assertValidInput({
  assetIds,
  durationSeconds,
  aspectRatio,
}: {
  assetIds: string[];
  durationSeconds: number;
  aspectRatio: string;
}) {
  if (assetIds.length === 0) {
    throw new Error("At least one asset is required to create a video job.");
  }

  if (!allowedDurations.includes(durationSeconds as (typeof allowedDurations)[number])) {
    throw new Error("Unsupported video duration.");
  }

  if (!allowedAspectRatios.includes(aspectRatio as VideoAspectRatio)) {
    throw new Error("Unsupported video aspect ratio.");
  }
}

function roleForAsset(asset: JobCreatableAsset) {
  return asset.detectedRole && asset.detectedRole !== "unknown"
    ? asset.detectedRole
    : "unknown";
}

export function createInMemoryVideoJobCreationStore(
  initialAssets: JobCreatableAsset[],
): VideoJobCreationStore & {
  listJobs: () => CreatedVideoJob[];
  listJobAssets: () => CreatedVideoJobAsset[];
  listEvents: () => VideoJobCreationEvent[];
} {
  const ownedAssets = new Map(initialAssets.map((asset) => [asset.id, asset]));
  const jobs: CreatedVideoJob[] = [];
  const boundAssets: CreatedVideoJobAsset[] = [];
  const events: VideoJobCreationEvent[] = [];

  return {
    async findOwnedAssets({ userId, assetIds }) {
      return assetIds.flatMap((assetId) => {
        const asset = ownedAssets.get(assetId);
        if (!asset || asset.userId !== userId || asset.status === "deleted") {
          return [];
        }

        return [asset];
      });
    },
    async createJob(input) {
      const job = {
        id: randomUUID(),
        ...input,
      };
      jobs.push(job);
      return job;
    },
    async createJobAsset(input) {
      const jobAsset = {
        id: randomUUID(),
        ...input,
      };
      boundAssets.push(jobAsset);
      return jobAsset;
    },
    async createStateEvent(input) {
      const event = {
        id: randomUUID(),
        ...input,
      };
      events.push(event);
      return event;
    },
    listJobs() {
      return jobs;
    },
    listJobAssets() {
      return boundAssets;
    },
    listEvents() {
      return events;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleVideoJobCreationStore(
  db: DbClient = getDb(),
): VideoJobCreationStore {
  return {
    async findOwnedAssets({ userId, assetIds }) {
      if (assetIds.length === 0) {
        return [];
      }

      const rows = await db
        .select({
          id: assets.id,
          userId: assets.userId,
          status: assets.status,
          detectedRole: assets.detectedRole,
        })
        .from(assets)
        .where(
          and(
            eq(assets.userId, userId),
            inArray(assets.id, assetIds),
            isNull(assets.deletedAt),
          ),
        );

      return rows as JobCreatableAsset[];
    },
    async createJob(input) {
      const [job] = await db
        .insert(videoJobs)
        .values(input)
        .returning({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          postQaMode: videoJobs.postQaMode,
          postQaRequired: videoJobs.postQaRequired,
          creditCost: videoJobs.creditCost,
          isTest: videoJobs.isTest,
        });

      if (!job) {
        throw new Error("Failed to create video job.");
      }

      return job as CreatedVideoJob;
    },
    async createJobAsset(input) {
      const [jobAsset] = await db
        .insert(videoJobAssets)
        .values(input)
        .returning({
          id: videoJobAssets.id,
          videoJobId: videoJobAssets.videoJobId,
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
        });

      if (!jobAsset) {
        throw new Error("Failed to bind asset to video job.");
      }

      return jobAsset as CreatedVideoJobAsset;
    },
    async createStateEvent(input) {
      const [event] = await db
        .insert(jobStateEvents)
        .values(input)
        .returning({
          id: jobStateEvents.id,
          videoJobId: jobStateEvents.videoJobId,
          fromStatus: jobStateEvents.fromStatus,
          toStatus: jobStateEvents.toStatus,
          reason: jobStateEvents.reason,
          actorType: jobStateEvents.actorType,
        });

      if (!event) {
        throw new Error("Failed to create job state event.");
      }

      return event as VideoJobCreationEvent;
    },
  };
}

export async function createVideoJobWithAssets({
  store,
  userId,
  assetIds,
  durationSeconds,
  aspectRatio,
  isTrial,
  isTest = false,
}: {
  store: VideoJobCreationStore;
  userId: string;
  assetIds: string[];
  durationSeconds: number;
  aspectRatio: string;
  isTrial: boolean;
  isTest?: boolean;
}) {
  const uniqueAssetIds = Array.from(new Set(assetIds));
  assertValidInput({ assetIds: uniqueAssetIds, durationSeconds, aspectRatio });

  const ownedAssets = await store.findOwnedAssets({
    userId,
    assetIds: uniqueAssetIds,
  });

  if (ownedAssets.length !== uniqueAssetIds.length) {
    throw new Error("One or more assets were not found for user.");
  }

  const job = await store.createJob({
    userId,
    status: "asset_analysis_queued",
    userVisibleStatus: "analyzing_assets",
    durationSeconds,
    aspectRatio: aspectRatio as VideoAspectRatio,
    postQaMode: isTrial ? "lite" : "standard",
    postQaRequired: "true",
    creditCost: creditCostForDuration(durationSeconds, isTrial),
    isTest,
  });
  const assetById = new Map(ownedAssets.map((asset) => [asset.id, asset]));
  const jobAssets = [];

  for (const [sortOrder, assetId] of uniqueAssetIds.entries()) {
    const asset = assetById.get(assetId);
    if (!asset) {
      throw new Error("One or more assets were not found for user.");
    }

    jobAssets.push(
      await store.createJobAsset({
        videoJobId: job.id,
        assetId,
        role: roleForAsset(asset),
        sortOrder,
      }),
    );
  }

  await store.createStateEvent({
    videoJobId: job.id,
    fromStatus: "draft_uploaded",
    toStatus: "asset_analysis_queued",
    reason: "job_created",
    actorType: "user",
  });

  return {
    job,
    jobAssets,
  };
}
