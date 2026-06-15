import { randomUUID } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import { reserveCredits, type CreditLedgerResult } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { storyboards, videoJobAssets, videoJobs, videoSegments } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { BillingMode, GenerationProfile } from "@/server/jobs/create-job";
import type { CreemPromptModerationResult } from "@/lib/providers/creem/moderation";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { createDrizzleJobStore, type JobStore } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";
import { checkPrompt } from "@/server/moderation/check-prompt";
import {
  createDrizzleModerationResultStore,
  type ModerationResultStore,
} from "@/server/moderation/results";
import type { RequiredAssetKind } from "@/lib/templates/types";
import { COMPILED_PROMPT_VERSION } from "@/server/video/prompt-compiler";

import {
  assetFactsSnapshotFromAssets,
  buildGlobalHardConstraints,
} from "./global-constraints";
import {
  buildGlobalUserIntent,
  formatGlobalUserIntentForPrompt,
  type GlobalUserIntent,
} from "./global-intent";
import { parseStoryboardJson, type ParsedStoryboard } from "./schema";
import type { StoryboardRecord } from "./generate";

type ConfirmFlowStatus =
  | "storyboard_draft_ready"
  | "storyboard_confirmed"
  | "prompt_moderation_running"
  | "prompt_moderation_passed"
  | "credits_reserved"
  | "segments_queued";

export interface StoryboardConfirmJobRecord {
  id: string;
  userId: string;
  status: string;
  durationSeconds: number;
  creditCost: number;
  billingMode: BillingMode;
  generationProfile: GenerationProfile;
  watermarkEnabled: boolean;
  reservedLedgerId?: string | null;
  isTest: boolean;
}

export interface StoryboardConfirmJobAssetRecord {
  videoJobId: string;
  assetId: string;
  role: string;
  sortOrder: number;
}

export interface VideoSegmentRecord {
  id: string;
  videoJobId: string;
  storyboardId: string | null;
  segmentIndex: number;
  status: "queued" | "generating" | "succeeded" | "failed" | "stored";
  templateId: string;
  prompt: string;
  inputAssetSnapshot: JsonValue;
  provider: string | null;
  model: string | null;
  providerTaskId: string | null;
  providerCallLogId: string | null;
  videoKey: string | null;
  costEstimate: string;
  generationProfile: GenerationProfile;
  resolution: string;
  audioEnabled: boolean;
  watermarkEnabled: boolean;
  isTest: boolean;
  lockedBy: string | null;
  lockedUntil: Date | null;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewVideoSegmentRecord {
  videoJobId: string;
  storyboardId: string;
  segmentIndex: number;
  templateId: string;
  prompt: string;
  inputAssetSnapshot: JsonValue;
  generationProfile: GenerationProfile;
  resolution: string;
  audioEnabled: boolean;
  watermarkEnabled: boolean;
  isTest: boolean;
}

export interface StoryboardConfirmationStore {
  findJob(input: {
    jobId: string;
    userId: string;
  }): Promise<StoryboardConfirmJobRecord | null>;
  findStoryboard(input: {
    storyboardId: string;
    jobId: string;
  }): Promise<StoryboardRecord | null>;
  listJobAssets(jobId: string): Promise<StoryboardConfirmJobAssetRecord[]>;
  confirmStoryboard(input: {
    storyboardId: string;
    finalPromptSnapshot: JsonValue;
  }): Promise<StoryboardRecord>;
  setReservedLedgerId(input: {
    jobId: string;
    reservedLedgerId: string;
  }): Promise<void>;
  listSegmentsForStoryboard(input: {
    storyboardId: string;
    jobId: string;
  }): Promise<VideoSegmentRecord[]>;
  createVideoSegments(input: NewVideoSegmentRecord[]): Promise<VideoSegmentRecord[]>;
}

type JsonObject = { [key: string]: JsonValue };

type GlobalUserIntentSnapshot = JsonObject & {
  sourcePromptSummary: string | null;
  styleIntent: string | null;
  sellingPoints: string[];
  negativeIntent: string[];
};

type AssetFactsSnapshot = JsonObject & {
  hasBack: boolean;
  hasDetail: boolean;
  hasScene: boolean;
};

type FinalPromptSnapshot = JsonObject & {
  version: typeof COMPILED_PROMPT_VERSION;
  durationSeconds: number;
  globalHardConstraints: string[];
  globalUserIntent: GlobalUserIntentSnapshot;
  segmentPrompts: Array<{
    index: number;
    durationSeconds: number;
    templateId: string;
    prompt: string;
  }>;
  systemConstraints: string[];
  inputAssets: Array<{
    assetId: string;
    role: string;
    sortOrder: number;
  }>;
  assetFactsSnapshot: AssetFactsSnapshot;
  templatePolicySnapshot: JsonObject;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function globalUserIntentSnapshot(intent: GlobalUserIntent): GlobalUserIntentSnapshot {
  return {
    sourcePromptSummary: intent.sourcePromptSummary,
    styleIntent: intent.styleIntent,
    sellingPoints: intent.sellingPoints,
    negativeIntent: intent.negativeIntent,
  };
}

function readGlobalUserIntent(value: unknown): GlobalUserIntentSnapshot {
  const record = asRecord(value);

  return {
    sourcePromptSummary:
      typeof record.sourcePromptSummary === "string"
        ? record.sourcePromptSummary
        : null,
    styleIntent:
      typeof record.styleIntent === "string" ? record.styleIntent : null,
    sellingPoints: readStringArray(record.sellingPoints),
    negativeIntent: readStringArray(record.negativeIntent),
  };
}

function buildFinalPromptSnapshot({
  parsed,
  assets,
}: {
  parsed: ParsedStoryboard;
  assets: StoryboardConfirmJobAssetRecord[];
}): FinalPromptSnapshot {
  const assetFactsSnapshot = assetFactsSnapshotFromAssets(assets);
  const rawStoryboard = asRecord(parsed.raw);
  const globalHardConstraints = buildGlobalHardConstraints({
    hasBackAsset: assetFactsSnapshot.hasBack,
    hasDetailAsset: assetFactsSnapshot.hasDetail,
    hasSceneAsset: assetFactsSnapshot.hasScene,
  });
  const globalUserIntent =
    Object.keys(asRecord(rawStoryboard.globalUserIntent)).length > 0
      ? readGlobalUserIntent(rawStoryboard.globalUserIntent)
      : globalUserIntentSnapshot(
          buildGlobalUserIntent({
            userPrompt: null,
            hasDetailAsset: assetFactsSnapshot.hasDetail,
          }),
        );
  const systemConstraints = [
    "Do not invent clothing details absent from provided assets.",
    "Do not show back views unless a back asset is present.",
    "Do not create detail closeups unless detail assets are present.",
    ...(assetFactsSnapshot.hasScene
      ? [
          "Use scene assets only as background, lighting, and mood reference.",
          "Do not copy people, faces, logos, storefront names, or readable text from scene assets.",
        ]
      : []),
  ];

  return {
    version: COMPILED_PROMPT_VERSION,
    durationSeconds: parsed.durationSeconds,
    globalHardConstraints,
    globalUserIntent,
    segmentPrompts: parsed.segments.map((segment) => ({
      index: segment.index,
      durationSeconds: segment.durationSeconds,
      templateId: segment.templateId,
      prompt: segment.prompt,
    })),
    systemConstraints,
    inputAssets: assets.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      sortOrder: asset.sortOrder,
    })),
    assetFactsSnapshot,
    templatePolicySnapshot: {
      selectedTemplateIds: parsed.segments.map((segment) => segment.templateId),
      disabledReasons: {},
    },
  };
}

function finalPromptText(snapshot: FinalPromptSnapshot) {
  return [
    "GLOBAL HARD CONSTRAINTS:",
    ...snapshot.globalHardConstraints.map((constraint) => `- ${constraint}`),
    "",
    "GLOBAL USER INTENT:",
    ...formatGlobalUserIntentForPrompt(snapshot.globalUserIntent).map(
      (intent) => `- ${intent}`,
    ),
    "",
    ...snapshot.segmentPrompts.map(
      (segment) =>
        `SEGMENT ${segment.index + 1} (${segment.templateId}): ${segment.prompt}`,
    ),
  ].join("\n");
}

function rolesForRequiredAsset(kind: RequiredAssetKind) {
  switch (kind) {
    case "front":
    case "back":
    case "side":
    case "detail":
    case "scene":
      return [kind];
    case "model_front":
    case "flat_lay_or_white_background":
      return ["front"];
  }
}

function assetsForSegmentTemplate({
  segment,
  assets,
}: {
  segment: ParsedStoryboard["segments"][number];
  assets: StoryboardConfirmJobAssetRecord[];
}) {
  const template = mvpShotTemplates.find(
    (item) => item.templateId === segment.templateId,
  );
  if (!template) {
    return [];
  }

  const allowedRoles = new Set(
    template.requiredAssets.flatMap((requiredAsset) =>
      rolesForRequiredAsset(requiredAsset),
    ),
  );

  return assets.filter((asset) => allowedRoles.has(asset.role));
}

function assetSnapshotForSegment({
  segment,
  assets,
  finalPromptSnapshot,
}: {
  segment: ParsedStoryboard["segments"][number];
  assets: StoryboardConfirmJobAssetRecord[];
  finalPromptSnapshot: FinalPromptSnapshot;
}) {
  const segmentAssets = assetsForSegmentTemplate({ segment, assets });

  return {
    segmentIndex: segment.index,
    templateId: segment.templateId,
    assets: segmentAssets.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      sortOrder: asset.sortOrder,
    })),
    promptCompiler: {
      version: finalPromptSnapshot.version,
      globalHardConstraints: finalPromptSnapshot.globalHardConstraints,
      globalUserIntent: finalPromptSnapshot.globalUserIntent,
      assetFactsSnapshot: finalPromptSnapshot.assetFactsSnapshot,
    },
  } satisfies JsonObject;
}

async function getOrCreateVideoSegments({
  storyboardStore,
  storyboardId,
  jobId,
  parsed,
  assets,
  finalPromptSnapshot,
  job,
  generationParameters,
}: {
  storyboardStore: StoryboardConfirmationStore;
  storyboardId: string;
  jobId: string;
  parsed: ParsedStoryboard;
  assets: StoryboardConfirmJobAssetRecord[];
  finalPromptSnapshot: FinalPromptSnapshot;
  job: StoryboardConfirmJobRecord;
  generationParameters: ReturnType<typeof generationParametersForProfile>;
}) {
  const existingSegments = await storyboardStore.listSegmentsForStoryboard({
    storyboardId,
    jobId,
  });

  if (existingSegments.length > 0) {
    const expectedIndexes = new Set(
      parsed.segments.map((segment) => segment.index),
    );
    const reusableSegments = existingSegments.filter((segment) =>
      expectedIndexes.has(segment.segmentIndex),
    );

    if (reusableSegments.length === parsed.segments.length) {
      return reusableSegments.sort((a, b) => a.segmentIndex - b.segmentIndex);
    }

    throw new Error("Existing storyboard segments are incomplete.");
  }

  return storyboardStore.createVideoSegments(
    parsed.segments.map((segment) => ({
      videoJobId: jobId,
      storyboardId,
      segmentIndex: segment.index,
      templateId: segment.templateId,
      prompt: segment.prompt,
      inputAssetSnapshot: assetSnapshotForSegment({
        segment,
        assets,
        finalPromptSnapshot,
      }),
      generationProfile: job.generationProfile,
      resolution: generationParameters.resolution,
      audioEnabled: generationParameters.audioEnabled,
      watermarkEnabled: job.watermarkEnabled,
      isTest: job.isTest,
    })),
  );
}

function assertDraftStoryboard(storyboard: StoryboardRecord) {
  if (storyboard.status === "confirmed") {
    throw new Error("Storyboard is already confirmed.");
  }

  if (storyboard.status !== "draft") {
    throw new Error("Storyboard is not confirmable.");
  }
}

const debugResolutionValues = new Set(["360p", "540p", "720p", "1080p"]);

function debugResolutionOverride(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.VIDEO_GENERATION_DEBUG_RESOLUTION?.trim();
  return value && debugResolutionValues.has(value) ? value : null;
}

const confirmFlowOrder: ConfirmFlowStatus[] = [
  "storyboard_draft_ready",
  "storyboard_confirmed",
  "prompt_moderation_running",
  "prompt_moderation_passed",
  "credits_reserved",
  "segments_queued",
];

async function currentJobStatus({
  jobStore,
  jobId,
}: {
  jobStore: JobStore;
  jobId: string;
}) {
  const job = await jobStore.findJob(jobId);
  if (!job) {
    throw new Error(`Video job not found: ${jobId}.`);
  }

  return job.status;
}

function hasReachedStatus(currentStatus: string, targetStatus: ConfirmFlowStatus) {
  const currentIndex = confirmFlowOrder.indexOf(currentStatus as ConfirmFlowStatus);
  const targetIndex = confirmFlowOrder.indexOf(targetStatus);

  return currentIndex >= targetIndex && targetIndex >= 0;
}

async function transitionIfNotReached({
  jobStore,
  jobId,
  toStatus,
  reason,
  actorType,
  actorId,
  eventSnapshot,
}: {
  jobStore: JobStore;
  jobId: string;
  toStatus: ConfirmFlowStatus;
  reason: string;
  actorType?: "user" | "system";
  actorId?: string;
  eventSnapshot?: JsonValue;
}) {
  const status = await currentJobStatus({ jobStore, jobId });
  if (hasReachedStatus(status, toStatus)) {
    return;
  }

  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus,
    reason,
    ...(actorType ? { actorType } : {}),
    ...(actorId ? { actorId } : {}),
    ...(eventSnapshot ? { eventSnapshot } : {}),
  });
}

function generationParametersForProfile(profile: GenerationProfile) {
  const resolutionOverride = debugResolutionOverride();
  if (profile === "trial_540p_watermarked") {
    return {
      resolution: resolutionOverride ?? "540p",
      audioEnabled: false,
    };
  }

  return {
    resolution:
      resolutionOverride ??
      (profile === "paid_1080p_audio" ? "1080p" : "720p"),
    audioEnabled: true,
  };
}

function assertTrialAllowedTemplates(parsed: ParsedStoryboard) {
  const templatesById = new Map(
    mvpShotTemplates.map((template) => [template.templateId, template]),
  );
  const hasNonTrialAllowedTemplate = parsed.segments.some((segment) => {
    const template = templatesById.get(segment.templateId);
    return !template?.isTrialAllowed;
  });

  if (hasNonTrialAllowedTemplate) {
    throw new Error("Free trial storyboard contains non trial-allowed templates.");
  }
}

export async function confirmStoryboard({
  jobStore = createDrizzleJobStore(),
  storyboardStore,
  creditStore = createDrizzleCreditLedgerStore(),
  moderationStore = createDrizzleModerationResultStore(),
  jobId,
  userId,
  storyboardId,
  moderatePrompt,
}: {
  jobStore?: JobStore;
  storyboardStore: StoryboardConfirmationStore;
  creditStore?: CreditLedgerStore;
  moderationStore?: ModerationResultStore;
  jobId: string;
  userId: string;
  storyboardId: string;
  moderatePrompt?: (input: {
    prompt: string;
    externalId?: string;
  }) => Promise<CreemPromptModerationResult>;
}) {
  const job = await storyboardStore.findJob({ jobId, userId });
  if (!job) {
    throw new Error("Video job not found for user.");
  }

  const storyboard = await storyboardStore.findStoryboard({ storyboardId, jobId });
  if (!storyboard) {
    throw new Error("Storyboard not found for job.");
  }
  assertDraftStoryboard(storyboard);

  const parsed = parseStoryboardJson(storyboard.storyboardJson, {
    durationSeconds: job.durationSeconds,
    allowedTemplateIds: Array.isArray(storyboard.selectedTemplateIds)
      ? storyboard.selectedTemplateIds.filter((id): id is string => typeof id === "string")
      : [],
  });
  if (job.billingMode === "free_trial") {
    assertTrialAllowedTemplates(parsed);
  }
  const assets = await storyboardStore.listJobAssets(jobId);
  const finalPromptSnapshot = buildFinalPromptSnapshot({ parsed, assets });
  const shouldReserveCredits = job.creditCost > 0;
  const generationParameters = generationParametersForProfile(job.generationProfile);

  await transitionIfNotReached({
    jobStore,
    jobId,
    toStatus: "storyboard_confirmed",
    reason: "storyboard_confirmed",
    actorType: "user",
    actorId: userId,
    eventSnapshot: { storyboardId },
  });
  await transitionIfNotReached({
    jobStore,
    jobId,
    toStatus: "prompt_moderation_running",
    reason: "final_prompt_moderation_started",
    eventSnapshot: { storyboardId },
  });

  const moderation = await checkPrompt(
    {
      userId,
      videoJobId: jobId,
      source: "final_video_prompt",
      prompt: finalPromptText(finalPromptSnapshot),
      externalId: `job:${jobId}:storyboard:${storyboardId}:final_prompt`,
    },
    {
      resultStore: moderationStore,
      moderatePrompt,
    },
  );

  if (!moderation.allowed) {
    if (moderation.decision === "error") {
      throw new Error("Final prompt moderation unavailable for video generation.");
    }

    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "prompt_moderation_blocked",
      reason: "final_prompt_moderation_blocked",
      eventSnapshot: {
        storyboardId,
        decision: moderation.decision,
        errorCode: moderation.errorCode,
      },
    });
    throw new Error("Final prompt moderation blocked video generation.");
  }

  await transitionIfNotReached({
    jobStore,
    jobId,
    toStatus: "prompt_moderation_passed",
    reason: "final_prompt_moderation_passed",
    eventSnapshot: { storyboardId, moderationId: moderation.moderationId },
  });

  let reserveResult: CreditLedgerResult | null = null;
  if (shouldReserveCredits) {
    reserveResult = await reserveCredits({
      store: creditStore,
      userId,
      amount: job.creditCost,
      reason: "reserve credits for confirmed storyboard",
      idempotencyKey: `reserve:job:${jobId}`,
      relatedJobId: jobId,
      metadata: {
        storyboardId,
        durationSeconds: job.durationSeconds,
      },
    });
    await storyboardStore.setReservedLedgerId({
      jobId,
      reservedLedgerId: reserveResult.ledger.id,
    });
  }

  const segments = await getOrCreateVideoSegments({
    storyboardStore,
    storyboardId,
    jobId,
    parsed,
    assets,
    finalPromptSnapshot,
    job,
    generationParameters,
  });

  const confirmedStoryboard = await storyboardStore.confirmStoryboard({
    storyboardId,
    finalPromptSnapshot,
  });

  if (shouldReserveCredits && reserveResult) {
    await transitionIfNotReached({
      jobStore,
      jobId,
      toStatus: "credits_reserved",
      reason: "credits_reserved",
      eventSnapshot: {
        storyboardId,
        ledgerId: reserveResult.ledger.id,
        amount: job.creditCost,
      },
    });
  }

  await transitionIfNotReached({
    jobStore,
    jobId,
    toStatus: shouldReserveCredits ? "segments_queued" : "credits_reserved",
    reason: shouldReserveCredits ? "segments_created" : "trial_segments_prepared",
    eventSnapshot: {
      storyboardId,
      ...(reserveResult ? { ledgerId: reserveResult.ledger.id } : {}),
      segmentIds: segments.map((segment) => segment.id),
    },
  });

  if (!shouldReserveCredits) {
    await transitionIfNotReached({
      jobStore,
      jobId,
      toStatus: "segments_queued",
      reason: "trial_segments_created",
      eventSnapshot: {
        storyboardId,
        segmentIds: segments.map((segment) => segment.id),
      },
    });
  }

  return {
    jobId,
    storyboardId: confirmedStoryboard.id,
    status: "segments_queued" as const,
    reservedLedgerId: reserveResult?.ledger.id ?? null,
    segmentCount: segments.length,
  };
}

export function createInMemoryStoryboardConfirmationStore({
  jobs,
  jobAssets,
  storyboards: initialStoryboards,
}: {
  jobs: StoryboardConfirmJobRecord[];
  jobAssets: StoryboardConfirmJobAssetRecord[];
  storyboards: StoryboardRecord[];
}): StoryboardConfirmationStore & {
  listJobs: () => StoryboardConfirmJobRecord[];
  listStoryboards: () => StoryboardRecord[];
  listSegments: () => VideoSegmentRecord[];
} {
  const jobRecords = new Map(jobs.map((job) => [job.id, { ...job }]));
  const storyboardRecords = new Map(
    initialStoryboards.map((storyboard) => [storyboard.id, { ...storyboard }]),
  );
  const segments: VideoSegmentRecord[] = [];

  return {
    async findJob({ jobId, userId }) {
      const job = jobRecords.get(jobId);
      return job && job.userId === userId ? { ...job } : null;
    },
    async findStoryboard({ storyboardId, jobId }) {
      const storyboard = storyboardRecords.get(storyboardId);
      return storyboard && storyboard.videoJobId === jobId
        ? { ...storyboard }
        : null;
    },
    async listJobAssets(videoJobId) {
      return jobAssets
        .filter((asset) => asset.videoJobId === videoJobId)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((asset) => ({ ...asset }));
    },
    async confirmStoryboard({ storyboardId: id, finalPromptSnapshot }) {
      const storyboard = storyboardRecords.get(id);
      if (!storyboard) {
        throw new Error(`Storyboard not found: ${id}.`);
      }
      const updated: StoryboardRecord = {
        ...storyboard,
        status: "confirmed",
        finalPromptSnapshot,
        confirmedAt: new Date(),
        updatedAt: new Date(),
      };
      storyboardRecords.set(id, updated);
      return { ...updated };
    },
    async setReservedLedgerId({ jobId: id, reservedLedgerId }) {
      const job = jobRecords.get(id);
      if (!job) {
        throw new Error(`Video job not found: ${id}.`);
      }
      jobRecords.set(id, { ...job, reservedLedgerId });
    },
    async listSegmentsForStoryboard({ storyboardId: id, jobId: videoJobId }) {
      return segments
        .filter(
          (segment) =>
            segment.storyboardId === id && segment.videoJobId === videoJobId,
        )
        .sort((a, b) => a.segmentIndex - b.segmentIndex)
        .map((segment) => ({ ...segment }));
    },
    async createVideoSegments(input) {
      const now = new Date();
      const created = input.map((segment) => ({
        ...segment,
        id: randomUUID(),
        status: "queued" as const,
        provider: null,
        model: null,
        providerTaskId: null,
        providerCallLogId: null,
        videoKey: null,
        costEstimate: "0",
        generationProfile: segment.generationProfile,
        resolution: segment.resolution,
        audioEnabled: segment.audioEnabled,
        watermarkEnabled: segment.watermarkEnabled,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: now,
        updatedAt: now,
      }));
      segments.push(...created);
      return created.map((segment) => ({ ...segment }));
    },
    listJobs() {
      return Array.from(jobRecords.values()).map((job) => ({ ...job }));
    },
    listStoryboards() {
      return Array.from(storyboardRecords.values()).map((storyboard) => ({
        ...storyboard,
      }));
    },
    listSegments() {
      return segments.map((segment) => ({ ...segment }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleStoryboardConfirmationStore(
  db: DbClient = getDb(),
): StoryboardConfirmationStore {
  return {
    async findJob({ jobId, userId }) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          durationSeconds: videoJobs.durationSeconds,
          creditCost: videoJobs.creditCost,
          reservedLedgerId: videoJobs.reservedLedgerId,
          billingMode: videoJobs.billingMode,
          generationProfile: videoJobs.generationProfile,
          watermarkEnabled: videoJobs.watermarkEnabled,
          isTest: videoJobs.isTest,
        })
        .from(videoJobs)
        .where(and(eq(videoJobs.id, jobId), eq(videoJobs.userId, userId)))
        .limit(1);

      return (job as StoryboardConfirmJobRecord | undefined) ?? null;
    },
    async findStoryboard({ storyboardId, jobId }) {
      const [storyboard] = await db
        .select()
        .from(storyboards)
        .where(
          and(
            eq(storyboards.id, storyboardId),
            eq(storyboards.videoJobId, jobId),
          ),
        )
        .limit(1);

      return (storyboard as StoryboardRecord | undefined) ?? null;
    },
    async listJobAssets(jobId) {
      return db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
        })
        .from(videoJobAssets)
        .where(eq(videoJobAssets.videoJobId, jobId))
        .orderBy(asc(videoJobAssets.sortOrder));
    },
    async confirmStoryboard({ storyboardId, finalPromptSnapshot }) {
      const [storyboard] = await db
        .update(storyboards)
        .set({
          status: "confirmed",
          finalPromptSnapshot,
          confirmedAt: new Date(),
        })
        .where(eq(storyboards.id, storyboardId))
        .returning();

      if (!storyboard) {
        throw new Error(`Storyboard not found: ${storyboardId}.`);
      }

      return storyboard as StoryboardRecord;
    },
    async setReservedLedgerId({ jobId, reservedLedgerId }) {
      await db
        .update(videoJobs)
        .set({ reservedLedgerId })
        .where(eq(videoJobs.id, jobId));
    },
    async listSegmentsForStoryboard({ storyboardId, jobId }) {
      return db
        .select()
        .from(videoSegments)
        .where(
          and(
            eq(videoSegments.storyboardId, storyboardId),
            eq(videoSegments.videoJobId, jobId),
          ),
        )
        .orderBy(asc(videoSegments.segmentIndex)) as Promise<VideoSegmentRecord[]>;
    },
    async createVideoSegments(input) {
      if (input.length === 0) {
        return [];
      }

      const records = await db
        .insert(videoSegments)
        .values(input)
        .returning();

      return records as VideoSegmentRecord[];
    },
  };
}
