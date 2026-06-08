import type { CreditLedgerStore } from "@/lib/credits/types";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
} from "@/lib/providers/log-call";
import {
  createVisionAssetAnalysis,
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
  const passed = record.passed;
  const failureCategory = record.failure_category;

  if (typeof passed !== "boolean") {
    throw new Error("Post QA provider response is missing boolean passed.");
  }

  return {
    passed,
    failureCategory:
      typeof failureCategory === "string" ? failureCategory : null,
  };
}

async function defaultPostQaVisionProvider({
  mode,
  frameUrls,
}: PostQaVisionInput): Promise<PostQaVisionResult> {
  const result = await createVisionAssetAnalysis({ mode, imageUrls: frameUrls });

  return {
    provider: result.provider,
    model: result.model,
    qaJson: result.analysisJson,
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
