import { randomUUID } from "node:crypto";

import { and, eq, gte, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assets,
  freeTrialUsages,
  jobStateEvents,
  userAccessEvents,
  videoJobAssets,
  videoJobs,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { assetRoleValues, assetStatusValues } from "@/lib/db/schema/assets";
import type {
  videoAspectRatioValues,
  jobStatusValues,
  billingModeValues,
  generationProfileValues,
} from "@/lib/db/schema/jobs";

export type AssetRole = (typeof assetRoleValues)[number];
export type AssetStatus = (typeof assetStatusValues)[number];
export type VideoAspectRatio = (typeof videoAspectRatioValues)[number];
export type JobStatus = (typeof jobStatusValues)[number];
export type BillingMode = (typeof billingModeValues)[number];
export type GenerationProfile = (typeof generationProfileValues)[number];

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
  billingMode: BillingMode;
  generationProfile: GenerationProfile;
  watermarkEnabled: boolean;
  trialEligibilitySnapshot: JsonValue | null;
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

export interface FreeTrialUsageRecord {
  id: string;
  userId: string;
  videoJobId: string;
  usedAt: Date;
  durationSeconds: number;
  generationProfile: GenerationProfile;
  resolution: string;
  watermarkEnabled: boolean;
  provider: string;
  model: string;
}

export interface UserAccessEventRecord {
  id: string;
  userId: string | null;
  eventType:
    | "job_create"
    | "trial_eligibility_check"
    | "trial_granted"
    | "trial_denied"
    | "checkout_start";
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
}

export interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
  path?: string | null;
}

export interface VideoJobCreationStore {
  findOwnedAssets(input: {
    userId: string;
    assetIds: string[];
  }): Promise<JobCreatableAsset[]>;
  createJob(input: Omit<CreatedVideoJob, "id">): Promise<CreatedVideoJob>;
  createJobAsset(input: Omit<CreatedVideoJobAsset, "id">): Promise<CreatedVideoJobAsset>;
  createStateEvent(input: Omit<VideoJobCreationEvent, "id">): Promise<VideoJobCreationEvent>;
  countRecentFreeTrialUsages(input: {
    userId: string;
    since: Date;
  }): Promise<number>;
  createFreeTrialUsage(
    input: Omit<FreeTrialUsageRecord, "id">,
  ): Promise<FreeTrialUsageRecord>;
  createAccessEvent(
    input: Omit<UserAccessEventRecord, "id" | "createdAt">,
  ): Promise<UserAccessEventRecord>;
}

const allowedDurations = [8, 16, 24] as const;
const allowedAspectRatios: VideoAspectRatio[] = ["9:16", "1:1", "16:9"];

function creditCostForDuration(durationSeconds: number, billingMode: BillingMode) {
  if (billingMode === "free_trial") {
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

function profileForBillingMode(billingMode: BillingMode) {
  if (billingMode === "free_trial") {
    return {
      generationProfile: "trial_540p_watermarked" as const,
      watermarkEnabled: true,
      postQaMode: "lite" as const,
      resolution: "540p",
      audioEnabled: false,
    };
  }

  return {
    generationProfile: "paid_720p_audio" as const,
    watermarkEnabled: false,
    postQaMode: "standard" as const,
    resolution: "720p",
    audioEnabled: true,
  };
}

function trialWindowStart(now: Date) {
  return new Date(now.getTime() - 24 * 60 * 60 * 1000);
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
  options: {
    trialUsages?: Array<{
      userId: string;
      usedAt: Date;
    }>;
  } = {},
): VideoJobCreationStore & {
  listJobs: () => CreatedVideoJob[];
  listJobAssets: () => CreatedVideoJobAsset[];
  listEvents: () => VideoJobCreationEvent[];
  listTrialUsages: () => FreeTrialUsageRecord[];
  listAccessEvents: () => UserAccessEventRecord[];
} {
  const ownedAssets = new Map(initialAssets.map((asset) => [asset.id, asset]));
  const jobs: CreatedVideoJob[] = [];
  const boundAssets: CreatedVideoJobAsset[] = [];
  const events: VideoJobCreationEvent[] = [];
  const trialUsageRecords: FreeTrialUsageRecord[] = (options.trialUsages ?? []).map(
    (usage) => ({
      id: randomUUID(),
      userId: usage.userId,
      videoJobId: "existing-job",
      usedAt: usage.usedAt,
      durationSeconds: 8,
      generationProfile: "trial_540p_watermarked",
      resolution: "540p",
      watermarkEnabled: true,
      provider: "apimart",
      model: "pixverse-v6",
    }),
  );
  const accessEvents: UserAccessEventRecord[] = [];

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
    async countRecentFreeTrialUsages({ userId, since }) {
      return trialUsageRecords.filter(
        (usage) => usage.userId === userId && usage.usedAt >= since,
      ).length;
    },
    async createFreeTrialUsage(input) {
      const record = {
        id: randomUUID(),
        ...input,
      };
      trialUsageRecords.push(record);
      return record;
    },
    async createAccessEvent(input) {
      const event = {
        id: randomUUID(),
        createdAt: new Date(),
        ...input,
      };
      accessEvents.push(event);
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
    listTrialUsages() {
      return trialUsageRecords;
    },
    listAccessEvents() {
      return accessEvents;
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
          billingMode: videoJobs.billingMode,
          generationProfile: videoJobs.generationProfile,
          watermarkEnabled: videoJobs.watermarkEnabled,
          trialEligibilitySnapshot: videoJobs.trialEligibilitySnapshot,
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
    async countRecentFreeTrialUsages({ userId, since }) {
      const rows = await db
        .select({ id: freeTrialUsages.id })
        .from(freeTrialUsages)
        .where(
          and(
            eq(freeTrialUsages.userId, userId),
            gte(freeTrialUsages.usedAt, since),
          ),
        );

      return rows.length;
    },
    async createFreeTrialUsage(input) {
      const [record] = await db
        .insert(freeTrialUsages)
        .values(input)
        .returning();

      if (!record) {
        throw new Error("Failed to create free trial usage.");
      }

      return record as FreeTrialUsageRecord;
    },
    async createAccessEvent(input) {
      const [event] = await db
        .insert(userAccessEvents)
        .values(input)
        .returning();

      if (!event) {
        throw new Error("Failed to create user access event.");
      }

      return event as UserAccessEventRecord;
    },
  };
}

async function recordAccessEvent({
  store,
  userId,
  eventType,
  requestContext,
  metadata,
}: {
  store: VideoJobCreationStore;
  userId: string;
  eventType: UserAccessEventRecord["eventType"];
  requestContext?: RequestContext;
  metadata?: JsonValue;
}) {
  await store.createAccessEvent({
    userId,
    eventType,
    ipAddress: requestContext?.ipAddress ?? null,
    userAgent: requestContext?.userAgent ?? null,
    path: requestContext?.path ?? null,
    metadata: metadata ?? null,
  });
}

export async function createVideoJobWithAssets({
  store,
  userId,
  assetIds,
  durationSeconds,
  aspectRatio,
  isTrial: _clientIsTrial,
  useFreeTrialIfAvailable,
  isTest = false,
  now = new Date(),
  requestContext,
}: {
  store: VideoJobCreationStore;
  userId: string;
  assetIds: string[];
  durationSeconds: number;
  aspectRatio: string;
  isTrial?: boolean;
  useFreeTrialIfAvailable?: boolean;
  isTest?: boolean;
  now?: Date;
  requestContext?: RequestContext;
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

  const shouldAttemptFreeTrial =
    durationSeconds === 8 && useFreeTrialIfAvailable === true;
  const recentTrialCount = shouldAttemptFreeTrial
    ? await store.countRecentFreeTrialUsages({
        userId,
        since: trialWindowStart(now),
      })
    : 0;
  if (shouldAttemptFreeTrial && recentTrialCount > 0) {
    await recordAccessEvent({
      store,
      userId,
      eventType: "trial_eligibility_check",
      requestContext,
      metadata: {
        durationSeconds,
        requested: true,
        previousTrialCount: recentTrialCount,
        decision: "denied",
      },
    });
    await recordAccessEvent({
      store,
      userId,
      eventType: "trial_denied",
      requestContext,
      metadata: {
        durationSeconds,
        previousTrialCount: recentTrialCount,
      },
    });
    throw new Error("Free trial is not available.");
  }
  const billingMode: BillingMode =
    shouldAttemptFreeTrial && recentTrialCount === 0 ? "free_trial" : "paid";
  const profile = profileForBillingMode(billingMode);
  const trialEligibilitySnapshot =
    shouldAttemptFreeTrial
      ? ({
          decision: billingMode === "free_trial" ? "granted" : "denied",
          window: "rolling_24h",
          previousTrialCount: recentTrialCount,
          checkedAt: now.toISOString(),
        } satisfies JsonValue)
      : null;

  await recordAccessEvent({
    store,
    userId,
    eventType: "trial_eligibility_check",
    requestContext,
    metadata: {
      durationSeconds,
      requested: shouldAttemptFreeTrial,
      previousTrialCount: recentTrialCount,
      decision: billingMode === "free_trial" ? "granted" : "denied",
    },
  });

  const job = await store.createJob({
    userId,
    status: "asset_analysis_queued",
    userVisibleStatus: "analyzing_assets",
    durationSeconds,
    aspectRatio: aspectRatio as VideoAspectRatio,
    postQaMode: profile.postQaMode,
    postQaRequired: "true",
    creditCost: creditCostForDuration(durationSeconds, billingMode),
    billingMode,
    generationProfile: profile.generationProfile,
    watermarkEnabled: profile.watermarkEnabled,
    trialEligibilitySnapshot,
    isTest,
  });

  await recordAccessEvent({
    store,
    userId,
    eventType: "job_create",
    requestContext,
    metadata: {
      videoJobId: job.id,
      billingMode,
      generationProfile: profile.generationProfile,
      creditCost: job.creditCost,
    },
  });

  if (billingMode === "free_trial") {
    await store.createFreeTrialUsage({
      userId,
      videoJobId: job.id,
      usedAt: now,
      durationSeconds,
      generationProfile: profile.generationProfile,
      resolution: profile.resolution,
      watermarkEnabled: profile.watermarkEnabled,
      provider: "apimart",
      model: "pixverse-v6",
    });
    await recordAccessEvent({
      store,
      userId,
      eventType: "trial_granted",
      requestContext,
      metadata: { videoJobId: job.id, durationSeconds },
    });
  } else if (shouldAttemptFreeTrial) {
    await recordAccessEvent({
      store,
      userId,
      eventType: "trial_denied",
      requestContext,
      metadata: {
        videoJobId: job.id,
        durationSeconds,
        previousTrialCount: recentTrialCount,
      },
    });
  }
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
