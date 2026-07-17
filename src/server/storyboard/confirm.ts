import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";

import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import { reserveCredits, type CreditLedgerResult } from "@/lib/credits/ledger";
import type { CreditLedgerStore } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import {
  freeTrialUsages,
  assetAnalyses,
  assetConsistencyAnalyses,
  storyboards,
  trialAbuseSignals,
  userAccessEvents,
  videoJobAssets,
  videoJobs,
  videoSegments,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { BillingMode, GenerationProfile } from "@/server/jobs/create-job";
import type { CreemPromptModerationResult } from "@/lib/providers/creem/moderation";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  recordFunnelEventSafely,
  type FunnelEventStore,
} from "@/server/analytics/funnel-events";
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
  postQaMode: "off" | "lite" | "standard" | "strict";
  postQaReason: string | null;
  reservedLedgerId?: string | null;
  trialEligibilitySnapshot?: JsonValue | null;
  isTest: boolean;
}

export interface StoryboardConfirmJobAssetRecord {
  videoJobId: string;
  assetId: string;
  role: string;
  subjectKind: "product" | "human_model" | "unknown";
  sortOrder: number;
}

export interface StoryboardConfirmConsistencyRecord {
  videoJobId: string;
  analysisKind: string;
  status: string;
  garmentMatch: string;
  modelMatch: string;
  confidence: string | null;
  riskFlags: JsonValue;
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

export interface TrialGrantAuditRecord {
  userId: string;
  videoJobId: string;
  emailHash?: string | null;
  oauthProvider?: string | null;
  oauthAccountIdHash?: string | null;
  ipHash?: string | null;
  deviceFingerprintHash?: string | null;
  userAgentHash?: string | null;
  eventType: "trial_granted";
  decision: "allow";
  riskScore: number;
  reasonCodes: string[];
  metadata?: JsonValue | null;
  createdAt: Date;
}

export interface UserAccessEventRecord {
  id: string;
  userId: string | null;
  eventType: "trial_granted";
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
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
  findConsistencyAnalysis(input: {
    jobId: string;
    analysisKind: string;
  }): Promise<StoryboardConfirmConsistencyRecord | null>;
  confirmStoryboard(input: {
    storyboardId: string;
    finalPromptSnapshot: JsonValue;
  }): Promise<StoryboardRecord>;
  setReservedLedgerId(input: {
    jobId: string;
    reservedLedgerId: string;
  }): Promise<void>;
  setPostQaMode(input: {
    jobId: string;
    mode: "strict";
    reason: "template_requires_strict_review";
  }): Promise<void>;
  listSegmentsForStoryboard(input: {
    storyboardId: string;
    jobId: string;
  }): Promise<VideoSegmentRecord[]>;
  createVideoSegments(input: NewVideoSegmentRecord[]): Promise<VideoSegmentRecord[]>;
  grantFreeTrialUsageIfNeeded(input: {
    job: StoryboardConfirmJobRecord;
    usedAt: Date;
    resolution: string;
    provider: string;
    model: string;
  }): Promise<FreeTrialUsageRecord | null>;
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
  hasModelFront: boolean;
  hasModelBack: boolean;
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
    subjectKind: string;
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
    hasModelFront: assetFactsSnapshot.hasModelFront,
    hasModelBack: assetFactsSnapshot.hasModelBack,
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
    ...parsed.segments.flatMap((segment) =>
      mvpShotTemplates.find(
        (template) => template.templateId === segment.templateId,
      )?.systemConstraints ?? [],
    ),
  ];

  return {
    version: COMPILED_PROMPT_VERSION,
    durationSeconds: parsed.durationSeconds,
    globalHardConstraints: [...new Set([...globalHardConstraints, ...systemConstraints])],
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
      subjectKind: asset.subjectKind,
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
    case "product_front":
      return ["front"];
    case "product_side":
    case "model_side":
      return ["side"];
    case "product_back":
    case "model_back":
      return ["back"];
  }
}

function subjectForRequiredAsset(kind: RequiredAssetKind) {
  if (kind.startsWith("product_")) {
    return "product";
  }

  if (kind.startsWith("model_")) {
    return "human_model";
  }

  return null;
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

  const selected = template.requiredAssets.map((requiredAsset) => {
    const allowedRoles = new Set(rolesForRequiredAsset(requiredAsset));
    const requiredSubject = subjectForRequiredAsset(requiredAsset);

    return assets.find(
      (asset) =>
        allowedRoles.has(asset.role) &&
        (requiredSubject === null || asset.subjectKind === requiredSubject),
    );
  });

  if (
    template.requiredAssets.some((kind) => kind.startsWith("product_")) &&
    selected.some((asset) => !asset)
  ) {
    throw new Error("Product rotation is missing a verified product view.");
  }

  return [
    ...new Map(
      selected
        .filter((asset): asset is StoryboardConfirmJobAssetRecord => Boolean(asset))
        .map((asset) => [asset.assetId, asset]),
    ).values(),
  ];
}

function assetSnapshotForSegment({
  segment,
  assets,
  finalPromptSnapshot,
  consistencyAnalyses,
}: {
  segment: ParsedStoryboard["segments"][number];
  assets: StoryboardConfirmJobAssetRecord[];
  finalPromptSnapshot: FinalPromptSnapshot;
  consistencyAnalyses: StoryboardConfirmConsistencyRecord[];
}) {
  const segmentAssets = assetsForSegmentTemplate({ segment, assets });
  const template = mvpShotTemplates.find(
    (item) => item.templateId === segment.templateId,
  );
  const consistencyKind =
    template?.subjectKind === "product"
      ? "product_views"
      : template?.subjectKind === "human_model"
        ? "model_views"
        : null;
  const consistency = consistencyKind
    ? consistencyAnalyses.find(
        (analysis) => analysis.analysisKind === consistencyKind,
      ) ?? null
    : null;

  return {
    segmentIndex: segment.index,
    templateId: segment.templateId,
    assets: segmentAssets.map((asset) => ({
      assetId: asset.assetId,
      role: asset.role,
      subjectKind: asset.subjectKind,
      sortOrder: asset.sortOrder,
    })),
    ...(consistency
      ? {
          consistency: {
            analysisKind: consistency.analysisKind,
            status: consistency.status,
            garmentMatch: consistency.garmentMatch,
            modelMatch: consistency.modelMatch,
            confidence: consistency.confidence,
            riskFlags: consistency.riskFlags,
          },
        }
      : {}),
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
  storyboardStatus,
  generationParameters,
  consistencyAnalyses,
}: {
  storyboardStore: StoryboardConfirmationStore;
  storyboardId: string;
  jobId: string;
  parsed: ParsedStoryboard;
  assets: StoryboardConfirmJobAssetRecord[];
  finalPromptSnapshot: FinalPromptSnapshot;
  job: StoryboardConfirmJobRecord;
  storyboardStatus: StoryboardRecord["status"];
  generationParameters: ReturnType<typeof generationParametersForProfile>;
  consistencyAnalyses: StoryboardConfirmConsistencyRecord[];
}) {
  const existingSegments = await storyboardStore.listSegmentsForStoryboard({
    storyboardId,
    jobId,
  });
  const expectedIndexes = new Set(parsed.segments.map((segment) => segment.index));
  const completeExistingSegments = completeSegmentsForExpectedIndexes({
    existingSegments,
    expectedIndexes,
  });

  if (existingSegments.length > 0) {
    if (completeExistingSegments) {
      return completeExistingSegments;
    }

    throw new Error(
      storyboardStatus === "confirmed"
        ? "Confirmed storyboard is missing complete video segments."
        : "Existing storyboard segments are incomplete.",
    );
  }

  if (storyboardStatus === "confirmed") {
    throw new Error("Confirmed storyboard is missing complete video segments.");
  }

  const newSegments = parsed.segments.map((segment) => ({
    videoJobId: jobId,
    storyboardId,
    segmentIndex: segment.index,
    templateId: segment.templateId,
    prompt: segment.prompt,
    inputAssetSnapshot: assetSnapshotForSegment({
      segment,
      assets,
      finalPromptSnapshot,
      consistencyAnalyses,
    }),
    generationProfile: job.generationProfile,
    resolution: generationParameters.resolution,
    audioEnabled: generationParameters.audioEnabled,
    watermarkEnabled: job.watermarkEnabled,
    isTest: job.isTest,
  }));

  let createdSegments: VideoSegmentRecord[];
  try {
    createdSegments = await storyboardStore.createVideoSegments(newSegments);
  } catch (error) {
    if (!isUniqueViolation(error)) {
      throw error;
    }

    createdSegments = [];
  }

  const completeCreatedSegments = completeSegmentsForExpectedIndexes({
    existingSegments: createdSegments,
    expectedIndexes,
  });
  if (completeCreatedSegments) {
    return completeCreatedSegments;
  }

  const reloadedSegments = await storyboardStore.listSegmentsForStoryboard({
    storyboardId,
    jobId,
  });
  const completeReloadedSegments = completeSegmentsForExpectedIndexes({
    existingSegments: reloadedSegments,
    expectedIndexes,
  });
  if (completeReloadedSegments) {
    return completeReloadedSegments;
  }

  throw new Error("Existing storyboard segments are incomplete.");
}

function completeSegmentsForExpectedIndexes({
  existingSegments,
  expectedIndexes,
}: {
  existingSegments: VideoSegmentRecord[];
  expectedIndexes: Set<number>;
}) {
  if (existingSegments.length !== expectedIndexes.size) {
    return null;
  }

  const byIndex = new Map<number, VideoSegmentRecord>();
  for (const segment of existingSegments) {
    if (!expectedIndexes.has(segment.segmentIndex)) {
      return null;
    }
    if (byIndex.has(segment.segmentIndex)) {
      return null;
    }
    byIndex.set(segment.segmentIndex, segment);
  }

  if (byIndex.size !== expectedIndexes.size) {
    return null;
  }

  return Array.from(byIndex.values()).sort(
    (a, b) => a.segmentIndex - b.segmentIndex,
  );
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; cause?: unknown };
  return (
    record.code === "23505" ||
    (typeof record.cause === "object" &&
      record.cause !== null &&
      (record.cause as { code?: unknown }).code === "23505")
  );
}

function assertDraftStoryboard(storyboard: StoryboardRecord) {
  if (storyboard.status !== "draft" && storyboard.status !== "confirmed") {
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

async function transitionToSegmentFailedIfPossible({
  jobStore,
  jobId,
  reason,
  eventSnapshot,
}: {
  jobStore: JobStore;
  jobId: string;
  reason: string;
  eventSnapshot?: JsonValue;
}) {
  const status = await currentJobStatus({ jobStore, jobId });
  if (status === "segment_failed") {
    return;
  }

  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "segment_failed",
    reason,
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

function nullableString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function trialGrantAuditFromJob({
  job,
  usedAt,
}: {
  job: StoryboardConfirmJobRecord;
  usedAt: Date;
}): TrialGrantAuditRecord {
  const snapshot = asRecord(job.trialEligibilitySnapshot);
  const signals = asRecord(snapshot.signals);
  const oauthAccounts = Array.isArray(signals.oauthAccounts)
    ? signals.oauthAccounts
    : [];
  const firstOauth = asRecord(oauthAccounts[0]);
  const reasonCodes = readStringArray(snapshot.reasonCodes);

  return {
    userId: job.userId,
    videoJobId: job.id,
    emailHash: nullableString(signals.emailHash),
    oauthProvider: nullableString(firstOauth.provider),
    oauthAccountIdHash: nullableString(firstOauth.accountHash),
    ipHash: nullableString(signals.ipHash),
    deviceFingerprintHash: nullableString(signals.deviceFingerprintHash),
    userAgentHash: nullableString(signals.userAgentHash),
    eventType: "trial_granted",
    decision: "allow",
    riskScore:
      typeof snapshot.riskScore === "number" ? snapshot.riskScore : 0,
    reasonCodes,
    metadata: {
      ...(snapshot ? { trialEligibilitySnapshot: job.trialEligibilitySnapshot } : {}),
      videoJobId: job.id,
      durationSeconds: job.durationSeconds,
      generationProfile: job.generationProfile,
    },
    createdAt: usedAt,
  };
}

function trialGrantAccessEventMetadata({
  job,
  resolution,
}: {
  job: StoryboardConfirmJobRecord;
  resolution: string;
}) {
  return {
    videoJobId: job.id,
    durationSeconds: job.durationSeconds,
    generationProfile: job.generationProfile,
    resolution,
    watermarkEnabled: job.watermarkEnabled,
  } satisfies JsonValue;
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
  funnelEventStore,
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
  funnelEventStore?: FunnelEventStore;
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
    selectedTemplateIds: Array.isArray(storyboard.selectedTemplateIds)
      ? storyboard.selectedTemplateIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
  });
  if (job.billingMode === "free_trial") {
    assertTrialAllowedTemplates(parsed);
  }
  const assets = await storyboardStore.listJobAssets(jobId);
  const selectedTemplates = parsed.segments.map((segment) =>
    mvpShotTemplates.find(
      (template) => template.templateId === segment.templateId,
    ),
  );
  if (selectedTemplates.some((template) => !template)) {
    throw new Error("Selected template snapshot is missing.");
  }
  const requiresProductConsistency = selectedTemplates.some(
    (template) =>
      template?.subjectKind === "product" &&
      template.consistencyRequirements.includes("same_garment"),
  );
  const requiresModelConsistency = selectedTemplates.some(
    (template) =>
      template?.subjectKind === "human_model" &&
      (template.consistencyRequirements.includes("same_garment") ||
        template.consistencyRequirements.includes("same_model")),
  );
  const productConsistency = requiresProductConsistency
    ? await storyboardStore.findConsistencyAnalysis({
        jobId,
        analysisKind: "product_views",
      })
    : null;
  const modelConsistency = requiresModelConsistency
    ? await storyboardStore.findConsistencyAnalysis({
        jobId,
        analysisKind: "model_views",
      })
    : null;
  if (
    requiresProductConsistency &&
    (productConsistency?.status !== "passed" ||
      productConsistency.garmentMatch !== "pass" ||
      productConsistency.modelMatch !== "not_applicable")
  ) {
    throw new Error("Product rotation requires matching verified product views.");
  }
  if (
    requiresModelConsistency &&
    (modelConsistency?.status !== "passed" ||
      modelConsistency.garmentMatch !== "pass" ||
      modelConsistency.modelMatch !== "pass")
  ) {
    throw new Error("Model turn requires matching verified model views.");
  }
  const consistencyAnalyses = [productConsistency, modelConsistency].filter(
    (analysis): analysis is StoryboardConfirmConsistencyRecord =>
      analysis !== null,
  );
  for (const segment of parsed.segments) {
    assetsForSegmentTemplate({ segment, assets });
  }
  if (
    selectedTemplates.some((template) => template?.requiresStrictReview) &&
    job.postQaMode !== "strict"
  ) {
    await storyboardStore.setPostQaMode({
      jobId,
      mode: "strict",
      reason: "template_requires_strict_review",
    });
  }
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
    storyboardStatus: storyboard.status,
    generationParameters,
    consistencyAnalyses,
  });

  const confirmedStoryboard =
    storyboard.status === "confirmed"
      ? storyboard
      : await storyboardStore.confirmStoryboard({
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

  if (job.billingMode === "free_trial") {
    try {
      await storyboardStore.grantFreeTrialUsageIfNeeded({
        job,
        usedAt: new Date(),
        resolution: generationParameters.resolution,
        provider: "apimart",
        model: "pixverse-v6",
      });
    } catch (error) {
      await transitionToSegmentFailedIfPossible({
        jobStore,
        jobId,
        reason:
          error instanceof Error &&
          error.message === "Free trial is not available."
            ? "free_trial_unavailable_after_queue"
            : "free_trial_grant_failed_after_queue",
        eventSnapshot: { storyboardId },
      });

      throw error;
    }
  }

  if (funnelEventStore) {
    const metadata = {
      jobId,
      billingMode: job.billingMode,
      durationSeconds: job.durationSeconds,
      status: "segments_queued",
    };
    await recordFunnelEventSafely({
      store: funnelEventStore,
      eventName: "storyboard_confirmed",
      source: "server",
      userId,
      metadata,
    });
    await recordFunnelEventSafely({
      store: funnelEventStore,
      eventName:
        job.billingMode === "free_trial"
          ? "trial_generation_started"
          : "paid_generation_started",
      source: "server",
      userId,
      metadata,
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

type InMemoryConfirmJobInput = Omit<
  StoryboardConfirmJobRecord,
  "postQaMode" | "postQaReason"
> &
  Partial<
    Pick<StoryboardConfirmJobRecord, "postQaMode" | "postQaReason">
  >;
type InMemoryConfirmAssetInput = Omit<
  StoryboardConfirmJobAssetRecord,
  "subjectKind"
> &
  Partial<Pick<StoryboardConfirmJobAssetRecord, "subjectKind">>;

export function createInMemoryStoryboardConfirmationStore({
  jobs,
  jobAssets,
  consistencyAnalyses = [],
  storyboards: initialStoryboards,
  trialUsages: initialTrialUsages = [],
}: {
  jobs: InMemoryConfirmJobInput[];
  jobAssets: InMemoryConfirmAssetInput[];
  consistencyAnalyses?: StoryboardConfirmConsistencyRecord[];
  storyboards: StoryboardRecord[];
  trialUsages?: Array<{
    userId: string;
    videoJobId: string;
    usedAt: Date;
  }>;
}): StoryboardConfirmationStore & {
  listJobs: () => StoryboardConfirmJobRecord[];
  listStoryboards: () => StoryboardRecord[];
  listSegments: () => VideoSegmentRecord[];
  listTrialUsages: () => FreeTrialUsageRecord[];
  listTrialAbuseSignals: () => TrialGrantAuditRecord[];
  listAccessEvents: () => UserAccessEventRecord[];
} {
  const jobRecords = new Map<string, StoryboardConfirmJobRecord>(
    jobs.map((job) => [
      job.id,
      {
        ...job,
        postQaMode: job.postQaMode ?? "standard",
        postQaReason: job.postQaReason ?? null,
      },
    ]),
  );
  const storyboardRecords = new Map(
    initialStoryboards.map((storyboard) => [storyboard.id, { ...storyboard }]),
  );
  const segments: VideoSegmentRecord[] = [];
  const trialUsages: FreeTrialUsageRecord[] = initialTrialUsages.map((usage) => ({
    id: randomUUID(),
    userId: usage.userId,
    videoJobId: usage.videoJobId,
    usedAt: usage.usedAt,
    durationSeconds: 8,
    generationProfile: "trial_540p_watermarked",
    resolution: "540p",
    watermarkEnabled: true,
    provider: "apimart",
    model: "pixverse-v6",
  }));
  const trialAbuseSignalRecords: TrialGrantAuditRecord[] = [];
  const accessEvents: UserAccessEventRecord[] = [];

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
        .map((asset) => ({
          ...asset,
          subjectKind: asset.subjectKind ?? "unknown",
        }));
    },
    async findConsistencyAnalysis({ jobId: id, analysisKind }) {
      return (
        consistencyAnalyses.find(
          (analysis) =>
            analysis.videoJobId === id &&
            analysis.analysisKind === analysisKind,
        ) ?? null
      );
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
    async setPostQaMode({ jobId: id, mode, reason }) {
      const job = jobRecords.get(id);
      if (!job) {
        throw new Error(`Video job not found: ${id}.`);
      }
      if (job.postQaMode === "strict") {
        return;
      }
      jobRecords.set(id, {
        ...job,
        postQaMode: mode,
        postQaReason: reason,
      });
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
    async grantFreeTrialUsageIfNeeded({ job, usedAt, resolution, provider, model }) {
      const existing = trialUsages.find((usage) => usage.videoJobId === job.id);
      if (existing) {
        return null;
      }
      if (trialUsages.some((usage) => usage.userId === job.userId)) {
        throw new Error("Free trial is not available.");
      }

      const usage: FreeTrialUsageRecord = {
        id: randomUUID(),
        userId: job.userId,
        videoJobId: job.id,
        usedAt,
        durationSeconds: job.durationSeconds,
        generationProfile: job.generationProfile,
        resolution,
        watermarkEnabled: job.watermarkEnabled,
        provider,
        model,
      };
      trialUsages.push(usage);
      trialAbuseSignalRecords.push(
        trialGrantAuditFromJob({
          job,
          usedAt,
        }),
      );
      accessEvents.push({
        id: randomUUID(),
        userId: job.userId,
        eventType: "trial_granted",
        ipAddress: null,
        userAgent: null,
        path: null,
        metadata: trialGrantAccessEventMetadata({ job, resolution }),
        createdAt: usedAt,
      });

      return { ...usage };
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
    listTrialUsages() {
      return trialUsages.map((usage) => ({ ...usage }));
    },
    listTrialAbuseSignals() {
      return trialAbuseSignalRecords.map((signal) => ({ ...signal }));
    },
    listAccessEvents() {
      return accessEvents.map((event) => ({ ...event }));
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
          postQaMode: videoJobs.postQaMode,
          postQaReason: videoJobs.postQaReason,
          trialEligibilitySnapshot: videoJobs.trialEligibilitySnapshot,
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
      const jobAssetRows = await db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
        })
        .from(videoJobAssets)
        .where(eq(videoJobAssets.videoJobId, jobId))
        .orderBy(asc(videoJobAssets.sortOrder));
      const assetIds = jobAssetRows.map((asset) => asset.assetId);
      const analysisRows =
        assetIds.length > 0
          ? await db
              .select({
                assetId: assetAnalyses.assetId,
                subjectKind: assetAnalyses.subjectKind,
                createdAt: assetAnalyses.createdAt,
              })
              .from(assetAnalyses)
              .where(inArray(assetAnalyses.assetId, assetIds))
              .orderBy(desc(assetAnalyses.createdAt))
          : [];
      const subjectByAssetId = new Map<
        string,
        StoryboardConfirmJobAssetRecord["subjectKind"]
      >();
      for (const analysis of analysisRows) {
        if (!subjectByAssetId.has(analysis.assetId)) {
          subjectByAssetId.set(analysis.assetId, analysis.subjectKind);
        }
      }

      return jobAssetRows.map((asset) => ({
        ...asset,
        subjectKind: subjectByAssetId.get(asset.assetId) ?? "unknown",
      }));
    },
    async findConsistencyAnalysis({ jobId, analysisKind }) {
      const [record] = await db
        .select({
          videoJobId: assetConsistencyAnalyses.videoJobId,
          analysisKind: assetConsistencyAnalyses.analysisKind,
          status: assetConsistencyAnalyses.status,
          garmentMatch: assetConsistencyAnalyses.garmentMatch,
          modelMatch: assetConsistencyAnalyses.modelMatch,
          confidence: assetConsistencyAnalyses.confidence,
          riskFlags: assetConsistencyAnalyses.riskFlags,
        })
        .from(assetConsistencyAnalyses)
        .where(
          and(
            eq(assetConsistencyAnalyses.videoJobId, jobId),
            eq(assetConsistencyAnalyses.analysisKind, analysisKind),
          ),
        )
        .limit(1);

      return record ?? null;
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
    async setPostQaMode({ jobId, mode, reason }) {
      await db
        .update(videoJobs)
        .set({ postQaMode: mode, postQaReason: reason })
        .where(
          and(eq(videoJobs.id, jobId), ne(videoJobs.postQaMode, "strict")),
        );
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
    async grantFreeTrialUsageIfNeeded({ job, usedAt, resolution, provider, model }) {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`free_trial:${job.userId}`}))`,
        );

        const [existingForJob] = await tx
          .select()
          .from(freeTrialUsages)
          .where(eq(freeTrialUsages.videoJobId, job.id))
          .limit(1);

        if (existingForJob) {
          return null;
        }

        const [existingForUser] = await tx
          .select({ id: freeTrialUsages.id })
          .from(freeTrialUsages)
          .where(eq(freeTrialUsages.userId, job.userId))
          .limit(1);

        if (existingForUser) {
          throw new Error("Free trial is not available.");
        }

        const [usage] = await tx
          .insert(freeTrialUsages)
          .values({
            userId: job.userId,
            videoJobId: job.id,
            usedAt,
            durationSeconds: job.durationSeconds,
            generationProfile: job.generationProfile,
            resolution,
            watermarkEnabled: job.watermarkEnabled,
            provider,
            model,
          })
          .returning();

        if (!usage) {
          throw new Error("Failed to create free trial usage.");
        }

        const grantSignal = trialGrantAuditFromJob({ job, usedAt });
        await tx.insert(trialAbuseSignals).values({
          userId: grantSignal.userId,
          videoJobId: grantSignal.videoJobId,
          emailHash: grantSignal.emailHash ?? null,
          oauthProvider: grantSignal.oauthProvider ?? null,
          oauthAccountIdHash: grantSignal.oauthAccountIdHash ?? null,
          ipHash: grantSignal.ipHash ?? null,
          deviceFingerprintHash: grantSignal.deviceFingerprintHash ?? null,
          userAgentHash: grantSignal.userAgentHash ?? null,
          eventType: grantSignal.eventType,
          decision: grantSignal.decision,
          riskScore: grantSignal.riskScore,
          reasonCodes: grantSignal.reasonCodes,
          metadata: grantSignal.metadata ?? null,
          createdAt: grantSignal.createdAt,
        });
        await tx.insert(userAccessEvents).values({
          userId: job.userId,
          eventType: "trial_granted",
          ipAddress: null,
          userAgent: null,
          path: null,
          metadata: trialGrantAccessEventMetadata({ job, resolution }),
          createdAt: usedAt,
        });

        return usage as FreeTrialUsageRecord;
      });
    },
  };
}
