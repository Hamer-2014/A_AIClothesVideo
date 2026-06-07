import { NextResponse } from "next/server";

import {
  getInternalWorkerSecret,
  isInternalWorkerAuthorized,
} from "@/server/internal/auth";
import {
  createDrizzleStitchStore,
  createStitchJobForVideo,
} from "@/server/stitch/jobs";

interface CreateStitchJobDeps {
  expectedSecret?: string | null;
  createStitchJob?: (input: { jobId: string }) => Promise<{
    jobId: string;
    stitchJobId: string;
    status: "queued";
    segmentCount: number;
  }>;
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
  return createStitchJobForVideo({
    stitchStore: createDrizzleStitchStore(),
    ...input,
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
    return NextResponse.json(result);
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
