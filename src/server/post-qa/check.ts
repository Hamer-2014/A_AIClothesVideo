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
  createDrizzlePostQaStore,
  resolvePostQaResult,
  type PostQaStore,
} from "./resolve";

export interface PostQaVisionInput {
  mode: VisionAnalysisMode;
  frameUrls: string[];
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
}: PostQaVisionInput): Promise<PostQaVisionResult> {
  const result = await createVisionPostQaCheck({ mode, frameUrls });

  return {
    provider: result.provider,
    model: result.model,
    qaJson: result.qaJson,
    raw: result.raw,
  };
}

export async function runPostQaCheck({
  jobStore = createDrizzleJobStore(),
  postQaStore = createDrizzlePostQaStore(),
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  creditStore,
  jobId,
  userId,
  mode,
  frameKeys,
  createSignedUrl = ({ key }) => createDownloadSignedUrl({ key }),
  visionProvider = defaultPostQaVisionProvider,
}: {
  jobStore?: JobStore;
  postQaStore?: PostQaStore;
  providerCallLogStore?: ProviderCallLogStore;
  creditStore?: CreditLedgerStore;
  jobId: string;
  userId: string;
  mode: VisionAnalysisMode;
  frameKeys: string[];
  createSignedUrl?: (input: { key: string }) => Promise<string>;
  visionProvider?: PostQaVisionProvider;
}) {
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

  const startedAt = Date.now();
  const frameUrls = await Promise.all(
    frameKeys.map((key) => createSignedUrl({ key })),
  );
  const requestSnapshot: JsonValue = {
    mode,
    frameCount: frameKeys.length,
  };

  let visionResult: PostQaVisionResult;
  try {
    visionResult = await visionProvider({ mode, frameUrls });
  } catch (error) {
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
      errorMessage: errorMessage(error),
    });

    return resolvePostQaResult({
      jobStore,
      postQaStore,
      ...(creditStore ? { creditStore } : {}),
      jobId,
      status: "failed",
      mode,
      frameKeys,
      resultJson: { passed: false, error: errorMessage(error) },
      failureCategory: "provider_unavailable",
    });
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

    return resolvePostQaResult({
      jobStore,
      postQaStore,
      ...(creditStore ? { creditStore } : {}),
      jobId,
      status: "failed",
      mode,
      frameKeys,
      resultJson: visionResult.qaJson,
      failureCategory: "provider_schema_error",
    });
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

  return resolvePostQaResult({
    jobStore,
    postQaStore,
    ...(creditStore ? { creditStore } : {}),
    jobId,
    status: parsed.passed ? "passed" : "failed",
    mode,
    frameKeys,
    resultJson: visionResult.qaJson,
    failureCategory: parsed.failureCategory,
  });
}
