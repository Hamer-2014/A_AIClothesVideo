import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleVideoJobCreationStore,
  createVideoJobWithAssets,
  type CreatedVideoJob,
  type CreatedVideoJobAsset,
} from "@/server/jobs/create-job";

type JobSession = {
  user?: {
    id?: string;
  };
} | null;

interface CreateJobRouteDeps {
  getSession?: () => Promise<JobSession>;
  createJob?: (input: {
    userId: string;
    assetIds: string[];
    durationSeconds: number;
    aspectRatio: string;
    isTrial: boolean;
    isTest?: boolean;
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
  const isTrial = input.isTrial === true;
  const isTest = input.isTest === true;
  const createJob =
    deps.createJob ??
    ((jobInput) =>
      createVideoJobWithAssets({
        store: createDrizzleVideoJobCreationStore(),
        ...jobInput,
      }));

  try {
    const result = await createJob({
      userId,
      assetIds,
      durationSeconds,
      aspectRatio,
      isTrial,
      isTest,
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

    return NextResponse.json(
      { error: "job_creation_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleCreateJobRequest(request);
}
