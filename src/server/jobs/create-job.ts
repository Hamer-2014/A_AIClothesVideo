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
  trialAbuseSignals,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { assetRoleValues, assetStatusValues } from "@/lib/db/schema/assets";
import type {
  videoAspectRatioValues,
  jobStatusValues,
  billingModeValues,
  generationProfileValues,
} from "@/lib/db/schema/jobs";
import {
  evaluateTrialEligibility,
  type TrialAbuseSignalInput,
  type TrialEligibilityInput,
  type TrialEligibilityStore,
} from "@/server/abuse/trial-eligibility";
import { hashAbuseSignal } from "@/server/abuse/hash";

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
  emailHash?: string | null;
  oauthProvider?: string | null;
  oauthAccountIdHash?: string | null;
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
  countTrialUsagesByUserId(userId: string): Promise<number>;
  countTrialUsagesByEmailHash(emailHash: string): Promise<number>;
  countTrialUsagesByOauthAccount(
    provider: string,
    oauthAccountIdHash: string,
  ): Promise<number>;
  countRecentTrialSignalsByDevice(
    deviceFingerprintHash: string,
    since: Date,
  ): Promise<number>;
  countRecentTrialSignalsByIp(ipHash: string, since: Date): Promise<number>;
  countRecentTrialSignalsByIpAndUserAgent(
    ipHash: string,
    userAgentHash: string,
    since: Date,
  ): Promise<number>;
  createTrialAbuseSignal(input: TrialAbuseSignalInput): Promise<void>;
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
      emailHash?: string | null;
      oauthProvider?: string | null;
      oauthAccountIdHash?: string | null;
    }>;
    trialEligibilityCounts?: {
      userTrialCount?: number;
      emailTrialCount?: number;
      oauthTrialCount?: number;
      deviceSignalCount?: number;
      ipSignalCount?: number;
      ipUserAgentSignalCount?: number;
    };
  } = {},
): VideoJobCreationStore & {
  listJobs: () => CreatedVideoJob[];
  listJobAssets: () => CreatedVideoJobAsset[];
  listEvents: () => VideoJobCreationEvent[];
  listTrialUsages: () => FreeTrialUsageRecord[];
  listAccessEvents: () => UserAccessEventRecord[];
  listTrialAbuseSignals: () => TrialAbuseSignalInput[];
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
      emailHash: usage.emailHash ?? null,
      oauthProvider: usage.oauthProvider ?? null,
      oauthAccountIdHash: usage.oauthAccountIdHash ?? null,
    }),
  );
  const accessEvents: UserAccessEventRecord[] = [];
  const trialAbuseSignalRecords: TrialAbuseSignalInput[] = [];
  const trialEligibilityCounts = options.trialEligibilityCounts ?? {};

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
    async countTrialUsagesByUserId(userId) {
      return (
        trialEligibilityCounts.userTrialCount ??
        trialUsageRecords.filter((usage) => usage.userId === userId).length
      );
    },
    async countTrialUsagesByEmailHash(emailHash) {
      return (
        trialEligibilityCounts.emailTrialCount ??
        trialUsageRecords.filter(
          (usage) => usage.emailHash === emailHash,
        ).length
      );
    },
    async countTrialUsagesByOauthAccount(provider, oauthAccountIdHash) {
      return (
        trialEligibilityCounts.oauthTrialCount ??
        trialUsageRecords.filter(
          (usage) =>
            usage.oauthProvider === provider &&
            usage.oauthAccountIdHash === oauthAccountIdHash,
        ).length
      );
    },
    async countRecentTrialSignalsByDevice() {
      return trialEligibilityCounts.deviceSignalCount ?? 0;
    },
    async countRecentTrialSignalsByIp() {
      return trialEligibilityCounts.ipSignalCount ?? 0;
    },
    async countRecentTrialSignalsByIpAndUserAgent() {
      return trialEligibilityCounts.ipUserAgentSignalCount ?? 0;
    },
    async createTrialAbuseSignal(input) {
      trialAbuseSignalRecords.push(input);
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
    listTrialAbuseSignals() {
      return trialAbuseSignalRecords;
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
    async countTrialUsagesByUserId(userId) {
      const rows = await db
        .select({ id: freeTrialUsages.id })
        .from(freeTrialUsages)
        .where(eq(freeTrialUsages.userId, userId));

      return rows.length;
    },
    async countTrialUsagesByEmailHash(emailHash) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.emailHash, emailHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
          ),
        );

      return rows.length;
    },
    async countTrialUsagesByOauthAccount(provider, oauthAccountIdHash) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.oauthProvider, provider),
            eq(trialAbuseSignals.oauthAccountIdHash, oauthAccountIdHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByDevice(deviceFingerprintHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.deviceFingerprintHash, deviceFingerprintHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByIp(ipHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.ipHash, ipHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async countRecentTrialSignalsByIpAndUserAgent(ipHash, userAgentHash, since) {
      const rows = await db
        .select({ id: trialAbuseSignals.id })
        .from(trialAbuseSignals)
        .where(
          and(
            eq(trialAbuseSignals.ipHash, ipHash),
            eq(trialAbuseSignals.userAgentHash, userAgentHash),
            eq(trialAbuseSignals.eventType, "trial_granted"),
            gte(trialAbuseSignals.createdAt, since),
          ),
        );

      return rows.length;
    },
    async createTrialAbuseSignal(input) {
      await db.insert(trialAbuseSignals).values({
        userId: input.userId,
        videoJobId: input.videoJobId ?? null,
        emailHash: input.emailHash ?? null,
        oauthProvider: input.oauthProvider ?? null,
        oauthAccountIdHash: input.oauthAccountIdHash ?? null,
        ipHash: input.ipHash ?? null,
        deviceFingerprintHash: input.deviceFingerprintHash ?? null,
        userAgentHash: input.userAgentHash ?? null,
        eventType: input.eventType,
        decision: input.decision,
        riskScore: input.riskScore,
        reasonCodes: input.reasonCodes,
        metadata: input.metadata ?? null,
        createdAt: input.createdAt,
      });
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
  email,
  emailVerified,
  oauthAccounts,
  deviceFingerprint,
  abuseHashSecret = process.env.ABUSE_HASH_SECRET,
  appEnvironment = process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
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
  email?: string | null;
  emailVerified?: boolean | null;
  oauthAccounts?: TrialEligibilityInput["oauthAccounts"];
  deviceFingerprint?: string | null;
  abuseHashSecret?: string | null;
  appEnvironment?: string;
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

  if (ownedAssets.some((asset) => asset.status === "pending_upload")) {
    throw new Error("One or more assets are not uploaded yet.");
  }

  const shouldAttemptFreeTrial =
    durationSeconds === 8 && useFreeTrialIfAvailable === true;
  let trialEligibility:
    | Awaited<ReturnType<typeof evaluateTrialEligibility>>
    | null = null;

  if (shouldAttemptFreeTrial) {
    trialEligibility = await evaluateTrialEligibility({
      store,
      input: {
        userId,
        email,
        emailVerified,
        oauthAccounts,
        ipAddress: requestContext?.ipAddress,
        userAgent: requestContext?.userAgent,
        deviceFingerprint,
        now,
      },
      hashSecret: abuseHashSecret,
      environment: appEnvironment,
    });
  }

  const recentTrialCount = shouldAttemptFreeTrial
    ? await store.countRecentFreeTrialUsages({
        userId,
        since: trialWindowStart(now),
      })
    : 0;
  if (
    shouldAttemptFreeTrial &&
    (recentTrialCount > 0 || trialEligibility?.decision !== "allow")
  ) {
    await recordAccessEvent({
      store,
      userId,
      eventType: "trial_eligibility_check",
      requestContext,
      metadata: {
        durationSeconds,
        requested: true,
        previousTrialCount: recentTrialCount,
        riskScore: trialEligibility?.riskScore ?? 0,
        reasonCodes: trialEligibility?.reasonCodes ?? [],
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
        riskScore: trialEligibility?.riskScore ?? 0,
        reasonCodes: trialEligibility?.reasonCodes ?? [],
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
          decision: billingMode === "free_trial" ? "allow" : "deny",
          riskScore: trialEligibility?.riskScore ?? 0,
          reasonCodes: trialEligibility?.reasonCodes ?? [],
          signals: trialEligibility?.signalSnapshot ?? null,
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
      riskScore: trialEligibility?.riskScore ?? 0,
      reasonCodes: trialEligibility?.reasonCodes ?? [],
      decision: billingMode === "free_trial" ? "allow" : "deny",
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
    await store.createTrialAbuseSignal({
      userId,
      videoJobId: job.id,
      emailHash:
        typeof trialEligibility?.signalSnapshot === "object" &&
        trialEligibility.signalSnapshot !== null &&
        !Array.isArray(trialEligibility.signalSnapshot) &&
        typeof trialEligibility.signalSnapshot.emailHash === "string"
          ? trialEligibility.signalSnapshot.emailHash
          : null,
      oauthProvider:
        typeof trialEligibility?.signalSnapshot === "object" &&
        trialEligibility.signalSnapshot !== null &&
        !Array.isArray(trialEligibility.signalSnapshot) &&
        Array.isArray(trialEligibility.signalSnapshot.oauthAccounts) &&
        typeof trialEligibility.signalSnapshot.oauthAccounts[0] === "object" &&
        trialEligibility.signalSnapshot.oauthAccounts[0] !== null &&
        !Array.isArray(trialEligibility.signalSnapshot.oauthAccounts[0]) &&
        typeof trialEligibility.signalSnapshot.oauthAccounts[0].provider === "string"
          ? trialEligibility.signalSnapshot.oauthAccounts[0].provider
          : null,
      oauthAccountIdHash:
        typeof trialEligibility?.signalSnapshot === "object" &&
        trialEligibility.signalSnapshot !== null &&
        !Array.isArray(trialEligibility.signalSnapshot) &&
        Array.isArray(trialEligibility.signalSnapshot.oauthAccounts) &&
        typeof trialEligibility.signalSnapshot.oauthAccounts[0] === "object" &&
        trialEligibility.signalSnapshot.oauthAccounts[0] !== null &&
        !Array.isArray(trialEligibility.signalSnapshot.oauthAccounts[0]) &&
        typeof trialEligibility.signalSnapshot.oauthAccounts[0].accountHash === "string"
          ? trialEligibility.signalSnapshot.oauthAccounts[0].accountHash
          : null,
      ipHash: hashAbuseSignal(requestContext?.ipAddress, abuseHashSecret ?? ""),
      deviceFingerprintHash: hashAbuseSignal(deviceFingerprint, abuseHashSecret ?? ""),
      userAgentHash: hashAbuseSignal(requestContext?.userAgent, abuseHashSecret ?? ""),
      eventType: "trial_granted",
      decision: "allow",
      riskScore: trialEligibility?.riskScore ?? 0,
      reasonCodes: trialEligibility?.reasonCodes ?? [],
      metadata: trialEligibility?.signalSnapshot ?? null,
      createdAt: now,
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
