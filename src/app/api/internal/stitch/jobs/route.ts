import { NextResponse } from "next/server";

import {
  getInternalWorkerSecret,
  isInternalWorkerAuthorized,
} from "@/server/internal/auth";
import {
  createAndTriggerStitchJobForVideo,
  createDrizzleStitchStore,
  markStitchJobRunning,
} from "@/server/stitch/jobs";
import {
  triggerCloudRunStitchJob,
  type CloudRunStitchPayload,
  type CloudRunStitchTriggerResult,
} from "@/server/stitch/trigger-cloud-run";

interface CreateStitchJobDeps {
  expectedSecret?: string | null;
  createStitchJob?: (input: { jobId: string }) => Promise<{
    jobId: string;
    stitchJobId: string;
    status: "queued";
    segmentCount: number;
    segmentKeys: string[];
    finalVideoKey: string;
    coverKey?: string | null;
    frameKeyPrefix?: string | null;
    callbackUrl: string;
    cloudRun?: CloudRunStitchTriggerResult;
  }>;
  triggerCloudRun?: (
    payload: CloudRunStitchPayload,
  ) => Promise<CloudRunStitchTriggerResult>;
  markRunning?: (input: { stitchJobId: string }) => Promise<void>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";

  if (!jobId) {
    throw new Error("invalid_stitch_input");
  }

  return { jobId };
}

function defaultCreateStitchJob(input: { jobId: string }) {
  return createAndTriggerStitchJobForVideo({
    stitchStore: createDrizzleStitchStore(),
    ...input,
  });
}

function defaultTriggerCloudRun(payload: CloudRunStitchPayload) {
  return triggerCloudRunStitchJob({ payload });
}

async function defaultMarkRunning(input: { stitchJobId: string }) {
  await markStitchJobRunning({
    stitchStore: createDrizzleStitchStore(),
    stitchJobId: input.stitchJobId,
  });
}

export async function handleCreateStitchJobRequest(
  request: Request,
  deps: CreateStitchJobDeps = {},
) {
  if (
    !isInternalWorkerAuthorized({
      request,
      expectedSecret: deps.expectedSecret ?? getInternalWorkerSecret(),
    })
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_stitch_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.createStitchJob ?? defaultCreateStitchJob)(input);
    let cloudRun: CloudRunStitchTriggerResult = result.cloudRun ?? {
      accepted: false,
    };
    if (deps.triggerCloudRun) {
      try {
        cloudRun = await (deps.triggerCloudRun ?? defaultTriggerCloudRun)({
          stitchJobId: result.stitchJobId,
          videoJobId: result.jobId,
          segmentKeys: result.segmentKeys,
          finalVideoKey: result.finalVideoKey,
          coverKey: result.coverKey,
          frameKeyPrefix: result.frameKeyPrefix,
          callbackUrl: result.callbackUrl,
        });
        await (deps.markRunning ?? defaultMarkRunning)({
          stitchJobId: result.stitchJobId,
        });
      } catch {
        return NextResponse.json(
          { error: "cloud_run_trigger_failed" },
          { status: 502 },
        );
      }
    } else if (!result.cloudRun) {
      try {
        cloudRun = await defaultTriggerCloudRun({
          stitchJobId: result.stitchJobId,
          videoJobId: result.jobId,
          segmentKeys: result.segmentKeys,
          finalVideoKey: result.finalVideoKey,
          coverKey: result.coverKey,
          frameKeyPrefix: result.frameKeyPrefix,
          callbackUrl: result.callbackUrl,
        });
        await defaultMarkRunning({ stitchJobId: result.stitchJobId });
      } catch {
        return NextResponse.json(
          { error: "cloud_run_trigger_failed" },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({
      jobId: result.jobId,
      stitchJobId: result.stitchJobId,
      status: result.status,
      segmentCount: result.segmentCount,
      cloudRun,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Video job not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "All video segments must be succeeded before stitching."
    ) {
      return NextResponse.json(
        { error: "segments_not_ready" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "stitch_job_creation_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleCreateStitchJobRequest(request);
}
