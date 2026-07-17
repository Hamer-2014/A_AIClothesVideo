import type { CreditLedgerStore } from "@/lib/credits/types";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
} from "@/lib/providers/log-call";
import {
  createVisionPostQaCheck,
  type VisionAnalysisMode,
} from "@/lib/providers/vision/client";
import { createDownloadSignedUrl } from "@/lib/storage/presign";
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
  createDrizzlePostQaStore,
  resolvePostQaResult,
  type PostQaStore,
} from "./resolve";
import {
  buildPostQaFrameBatches,
  type PostQaFrameBatch,
  type QaFrameLocation,
} from "./frame-batches";
import { retryLocalizedPostQaSegment } from "./retry-localized-segment";

export interface PostQaVisionInput {
  mode: VisionAnalysisMode;
  frameUrls: string[];
  qaRequirements: string[];
}

export interface PostQaVisionResult {
  provider: string;
  model: string;
  qaJson: JsonValue;
  raw: JsonValue;
}

export type PostQaVisionProvider = (
  input: PostQaVisionInput,
) => Promise<PostQaVisionResult>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown post QA provider error.";
}

function parseQaJson(value: JsonValue) {
  const record = asRecord(value);
  const passed = normalizeQaPassed(record);
  const failureCategory = record.failure_category;

  if (typeof passed !== "boolean") {
    throw new Error("Post QA provider response is missing boolean passed.");
  }

  return {
    passed,
    failureCategory: passed
      ? null
      : typeof failureCategory === "string"
        ? failureCategory
        : null,
  };
}

function normalizeQaPassed(record: Record<string, unknown>) {
  const passed = record.passed;
  if (passed !== false) {
    return passed;
  }

  const flags = Array.isArray(record.risk_flags)
    ? record.risk_flags.filter((flag): flag is string => typeof flag === "string")
    : [];
  const failureCategory =
    typeof record.failure_category === "string" ? record.failure_category : "";
  const summary = typeof record.summary === "string" ? record.summary : "";
  const text = `${failureCategory} ${summary}`.toLowerCase();
  const normalizedFlags = flags.map((flag) => flag.toLowerCase().trim());
  const softSuitabilityFlags = new Set([
    "minor_present",
    "child_present",
    "child_model",
    "children_present",
    "outdoor_scene",
    "outdoor_street_scene",
    "street_scene",
    "lifestyle_scene",
    "brand_policy_uncertainty",
    "policy_or_brand_suitability",
    "slight_motion_blur",
    "slightly_blurry",
    "minor_motion_blur",
  ]);
  const blockingFlags = [
    "unsafe",
    "sexualized",
    "adultized",
    "exploitation",
    "privacy",
    "garment_mismatch",
    "product_unrecognizable",
    "severe_blur",
    "severely_blurry",
    "severe_distortion",
    "distorted_body",
    "bad_frame",
    "black_frame",
  ];
  const hasOnlySoftSuitabilityFlags =
    normalizedFlags.length > 0 &&
    normalizedFlags.every((flag) => softSuitabilityFlags.has(flag));
  const hasBlockingFlag = normalizedFlags.some((flag) =>
    blockingFlags.some((blockingFlag) => flag.includes(blockingFlag)),
  );
  const hasBlockingText = blockingFlags.some((blockingFlag) =>
    text.includes(blockingFlag.replace(/_/g, " ")),
  );
  const isPolicyOrSuitabilityOnly =
    text.includes("brand policy") ||
    text.includes("policy uncertainty") ||
    text.includes("policy may vary") ||
    text.includes("policy_or_brand_suitability") ||
    text.includes("product-ad suitability") ||
    text.includes("marketing suitability") ||
    text.includes("ordinary product marketing");

  if (
    hasOnlySoftSuitabilityFlags &&
    isPolicyOrSuitabilityOnly &&
    !hasBlockingFlag &&
    !hasBlockingText &&
    checksDoNotContainBlockingFailure(record)
  ) {
    return true;
  }

  return false;
}

function checksDoNotContainBlockingFailure(record: Record<string, unknown>) {
  const checks = Array.isArray(record.checks) ? record.checks.map(asRecord) : [];
  const blockingCheckNames = [
    "garment",
    "consistency",
    "clarity",
    "quality",
    "safety",
    "appropriateness",
  ];

  return checks.every((check) => {
    if (check.passed !== false) {
      return true;
    }

    const name = typeof check.name === "string" ? check.name.toLowerCase() : "";
    const notes = typeof check.notes === "string" ? check.notes.toLowerCase() : "";
    const checkText = `${name} ${notes}`;
    const isSoftPolicyConcern =
      checkText.includes("brand policy") ||
      checkText.includes("policy may vary") ||
      checkText.includes("policy uncertainty") ||
      checkText.includes("child model present");

    if (isSoftPolicyConcern) {
      return true;
    }

    return !blockingCheckNames.some((blockingName) => name.includes(blockingName));
  });
}

async function defaultPostQaVisionProvider({
  mode,
  frameUrls,
  qaRequirements,
}: PostQaVisionInput): Promise<PostQaVisionResult> {
  const result = await createVisionPostQaCheck({
    mode,
    frameUrls,
    qaRequirements,
  });

  return {
    provider: result.provider,
    model: result.model,
    qaJson: result.qaJson,
    raw: result.raw,
  };
}

type PostQaBatchResult = {
  batchId: string;
  kind: PostQaFrameBatch["kind"];
  segmentIndex: number | null;
  frameLocations: QaFrameLocation[];
  passed: boolean;
  failureCategory: string | null;
  qaJson: JsonValue;
};

async function analyzeBatch({
  batch,
  mode,
  jobId,
  userId,
  createSignedUrl,
  visionProvider,
  providerCallLogStore,
  qaRequirements,
}: {
  batch: PostQaFrameBatch;
  mode: VisionAnalysisMode;
  jobId: string;
  userId: string;
  createSignedUrl: (input: { key: string }) => Promise<string>;
  visionProvider: PostQaVisionProvider;
  providerCallLogStore: ProviderCallLogStore;
  qaRequirements: string[];
}): Promise<PostQaBatchResult> {
  const startedAt = Date.now();
  const requestSnapshot = {
    mode,
    batchId: batch.batchId,
    kind: batch.kind,
    segmentIndex: batch.segmentIndex,
    frameCount: batch.frameKeys.length,
    frameLocations: batch.frameLocations,
    humanTurnReview: qaRequirements.length > 0,
  } as unknown as JsonValue;

  let visionResult: PostQaVisionResult;
  try {
    const frameUrls = await Promise.all(
      batch.frameKeys.map((key) => createSignedUrl({ key })),
    );
    visionResult = await visionProvider({ mode, frameUrls, qaRequirements });
  } catch (error) {
    const message = errorMessage(error);
    await providerCallLogStore.createCallLog({
      provider: "vision",
      model: "unknown",
      purpose: "post_qa",
      userId,
      videoJobId: jobId,
      requestSnapshot,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "post_qa_provider_error",
      errorMessage: message,
    });
    return {
      batchId: batch.batchId,
      kind: batch.kind,
      segmentIndex: batch.segmentIndex,
      frameLocations: batch.frameLocations,
      passed: false,
      failureCategory: "provider_unavailable",
      qaJson: { passed: false, error: message },
    };
  }

  let parsed: ReturnType<typeof parseQaJson>;
  try {
    parsed = parseQaJson(visionResult.qaJson);
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: visionResult.provider,
      model: visionResult.model,
      purpose: "post_qa",
      userId,
      videoJobId: jobId,
      requestSnapshot,
      responseSummary: visionResult.qaJson,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "post_qa_schema_error",
      errorMessage: errorMessage(error),
    });
    return {
      batchId: batch.batchId,
      kind: batch.kind,
      segmentIndex: batch.segmentIndex,
      frameLocations: batch.frameLocations,
      passed: false,
      failureCategory: "provider_schema_error",
      qaJson: visionResult.qaJson,
    };
  }

  await providerCallLogStore.createCallLog({
    provider: visionResult.provider,
    model: visionResult.model,
    purpose: "post_qa",
    userId,
    videoJobId: jobId,
    requestSnapshot,
    responseSummary: visionResult.qaJson,
    durationMs: Date.now() - startedAt,
    status: parsed.passed ? "succeeded" : "blocked",
  });

  return {
    batchId: batch.batchId,
    kind: batch.kind,
    segmentIndex: batch.segmentIndex,
    frameLocations: batch.frameLocations,
    passed: parsed.passed,
    failureCategory: parsed.failureCategory,
    qaJson: visionResult.qaJson,
  };
}

export async function runPostQaCheck({
  jobStore = createDrizzleJobStore(),
  postQaStore = createDrizzlePostQaStore(),
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  segmentStore,
  creditStore,
  jobId,
  userId,
  mode,
  frameKeys,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  visionProvider = defaultPostQaVisionProvider,
  selectedTemplateIds = [],
}: {
  jobStore?: JobStore;
  postQaStore?: PostQaStore;
  providerCallLogStore?: ProviderCallLogStore;
  segmentStore?: VideoSegmentStore;
  creditStore?: CreditLedgerStore;
  jobId: string;
  userId: string;
  mode: VisionAnalysisMode;
  frameKeys: string[];
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  visionProvider?: PostQaVisionProvider;
  selectedTemplateIds?: string[];
}) {
  const hasHumanTurn = selectedTemplateIds.some((templateId) =>
    ["model_quarter_turn", "model_half_turn"].includes(templateId),
  );
  const qaRequirements = hasHumanTurn
    ? [
        "same visible person across relevant frames",
        "natural head, arm, hand, hip, and leg anatomy",
        "garment front/side/back consistency",
        "turn stops at the supported angle and never completes 360 degrees",
      ]
    : [];
  if (frameKeys.length === 0) {
    const currentJob = await jobStore.findJob(jobId);
    if (currentJob?.status === "post_qa_queued") {
      await transitionJobStatus({
        store: jobStore,
        jobId,
        toStatus: "post_qa_running",
        reason: "post_qa_started",
        eventSnapshot: { mode, frameCount: 0 },
      });
    }

    return resolvePostQaResult({
      jobStore,
      postQaStore,
      ...(creditStore ? { creditStore } : {}),
      jobId,
      status: "failed",
      mode,
      frameKeys,
      resultJson: { passed: false, error: "missing_frames" },
      failureCategory: "missing_frames",
    });
  }

  const currentJob = await jobStore.findJob(jobId);
  if (currentJob?.status === "post_qa_queued") {
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "post_qa_running",
      reason: "post_qa_started",
      eventSnapshot: { mode, frameCount: frameKeys.length },
    });
  }

  const batchResults: PostQaBatchResult[] = [];
  for (const batch of buildPostQaFrameBatches(frameKeys)) {
    batchResults.push(
      await analyzeBatch({
        batch,
        mode,
        jobId,
        userId,
        createSignedUrl,
        visionProvider,
        providerCallLogStore,
        qaRequirements,
      }),
    );
  }

  const failedSegmentIndexes = [
    ...new Set(
      batchResults
        .filter((batch) => !batch.passed && batch.kind === "segment")
        .flatMap((batch) =>
          batch.segmentIndex === null ? [] : [batch.segmentIndex],
        ),
    ),
  ].sort((left, right) => left - right);
  const failedTransitionLocations = batchResults
    .filter((batch) => !batch.passed && batch.kind === "transition")
    .flatMap((batch) => batch.frameLocations);
  const passed = batchResults.every((batch) => batch.passed);
  const failureCategory =
    batchResults.find((batch) => !batch.passed)?.failureCategory ?? null;
  const resultJson = {
    passed,
    batches: batchResults,
    failedSegmentIndexes,
    failedTransitionLocations,
  } as unknown as JsonValue;

  const isLocalizedSingleSegmentFailure =
    (frameKeys.length === 24 || frameKeys.length === 34) &&
    failedSegmentIndexes.length === 1 &&
    failedTransitionLocations.length === 0 &&
    batchResults.every(
      (batch) =>
        batch.passed ||
        (batch.kind === "segment" &&
          batch.failureCategory !== "provider_unavailable" &&
          batch.failureCategory !== "provider_schema_error"),
    );
  if (isLocalizedSingleSegmentFailure) {
    const retryResult = await retryLocalizedPostQaSegment({
      jobStore,
      segmentStore: segmentStore ?? createDrizzleVideoSegmentStore(),
      postQaStore,
      jobId,
      segmentIndex: failedSegmentIndexes[0] as number,
      mode,
      frameKeys,
      resultJson,
    });
    if (retryResult.requeued) {
      return {
        jobId,
        status: "segments_queued" as const,
        retriedSegmentIndex: retryResult.segmentIndex,
        ledgerType: null,
      };
    }
  }

  return resolvePostQaResult({
    jobStore,
    postQaStore,
    ...(creditStore ? { creditStore } : {}),
    jobId,
    status: passed ? "passed" : "failed",
    mode,
    frameKeys,
    resultJson,
    failureCategory,
  });
}
