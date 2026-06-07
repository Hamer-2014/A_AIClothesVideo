import { NextResponse } from "next/server";

import {
  getInternalWorkerSecret,
  isInternalWorkerAuthorized,
} from "@/server/internal/auth";
import {
  createDrizzleVideoSegmentStore,
  defaultStoreProviderOutput,
  pollSubmittedSegment,
} from "@/server/video/segments";

interface PollSegmentDeps {
  expectedSecret?: string | null;
  pollSegment?: (input: {
    jobId: string;
    segmentId: string;
  }) => Promise<{
    jobId: string;
    segmentId: string;
    status: "generating" | "succeeded" | "failed";
    videoKey: string | null;
  }>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";

  if (!jobId) {
    throw new Error("invalid_segment_input");
  }

  return { jobId };
}

function defaultPollSegment(input: { jobId: string; segmentId: string }) {
  return pollSubmittedSegment({
    segmentStore: createDrizzleVideoSegmentStore(),
    storeProviderOutput: defaultStoreProviderOutput,
    ...input,
  });
}

export async function handlePollSegmentRequest(
  request: Request,
  context: { params: { id: string } },
  deps: PollSegmentDeps = {},
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
      { error: "invalid_segment_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.pollSegment ?? defaultPollSegment)({
      jobId: input.jobId,
      segmentId: context.params.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Video segment not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "segment_poll_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handlePollSegmentRequest(request, {
    params: await context.params,
  });
}
