import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { createRuntimeFunnelEventStore } from "@/server/analytics/funnel-events";
import {
  createDrizzleVideoJobCreationStore,
  createVideoJobWithAssets,
  type CreatedVideoJob,
  type CreatedVideoJobAsset,
} from "@/server/jobs/create-job";

type JobSession = {
  user?: {
    id?: string;
    email?: string | null;
    emailVerified?: boolean | null;
  };
} | null;

interface CreateJobRouteDeps {
  getSession?: () => Promise<JobSession>;
  createJob?: (input: {
    userId: string;
    assetIds: string[];
    durationSeconds: number;
    aspectRatio: string;
    useFreeTrialIfAvailable?: boolean;
    isTest?: boolean;
    presetId?: string | null;
    requestContext?: {
      ipAddress: string | null;
      userAgent: string | null;
      path: string | null;
    };
    email?: string | null;
    emailVerified?: boolean | null;
    deviceFingerprint?: string | null;
  }) => Promise<{
    job: CreatedVideoJob;
    jobAssets: CreatedVideoJobAsset[];
  }>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function handleCreateJobRequest(
  request: Request,
  deps: CreateJobRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = body as Record<string, unknown>;
  const assetIds = stringArray(input.assetIds);
  const durationSeconds = numberValue(input.durationSeconds);
  const aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : "";
  const useFreeTrialIfAvailable =
    typeof input.useFreeTrialIfAvailable === "boolean"
      ? input.useFreeTrialIfAvailable
      : undefined;
  const isTest = input.isTest === true;
  const presetId =
    typeof input.presetId === "string" ? input.presetId : null;
  const deviceFingerprint =
    typeof input.deviceFingerprint === "string" ? input.deviceFingerprint : null;
  const createJob =
    deps.createJob ??
    ((jobInput) =>
      createVideoJobWithAssets({
        store: createDrizzleVideoJobCreationStore(),
        funnelEventStore: createRuntimeFunnelEventStore(),
        ...jobInput,
      }));

  try {
    const result = await createJob({
      userId,
      assetIds,
      durationSeconds,
      aspectRatio,
      useFreeTrialIfAvailable,
      isTest,
      presetId,
      email: session?.user?.email ?? null,
      emailVerified: session?.user?.emailVerified ?? null,
      deviceFingerprint,
      requestContext: {
        ipAddress: requestIp(request),
        userAgent: request.headers.get("user-agent"),
        path: new URL(request.url).pathname,
      },
    });

    return NextResponse.json(
      {
        jobId: result.job.id,
        status: result.job.status,
        userVisibleStatus: result.job.userVisibleStatus,
        assetCount: result.jobAssets.length,
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        [
          "At least one asset is required to create a video job.",
          "Unsupported video duration.",
          "Unsupported video aspect ratio.",
        ] as string[]
      ).includes(error.message)
    ) {
      return NextResponse.json(
        { error: "invalid_job_input" },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "One or more assets were not found for user."
    ) {
      return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "Free trial is not available."
    ) {
      return NextResponse.json(
        {
          error: "free_trial_unavailable",
          message: "当前环境暂时无法使用免费试用，可购买点数继续生成。",
        },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Rights attestation is required for all assets."
    ) {
      return NextResponse.json(
        { error: "rights_attestation_required" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        error: "job_creation_failed",
        message:
          error instanceof Error
            ? error.message
            : "Video job creation failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleCreateJobRequest(request);
}
