import { NextResponse } from "next/server";

import {
  isInternalWorkerAuthorized,
  getInternalWorkerSecret,
} from "@/server/internal/auth";
import {
  createDrizzleVideoSegmentStore,
  submitQueuedSegment,
} from "@/server/video/segments";

interface SubmitSegmentDeps {
  expectedSecret?: string | null;
  submitSegment?: (input: {
    jobId: string;
    segmentId: string;
  }) => Promise<{
    jobId: string;
    segmentId: string;
    status: "generating";
    providerTaskId: string;
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

function defaultSubmitSegment(input: { jobId: string; segmentId: string }) {
  return submitQueuedSegment({
    segmentStore: createDrizzleVideoSegmentStore(),
    ...input,
  });
}

export async function handleSubmitSegmentRequest(
  request: Request,
  context: { params: { id: string } },
  deps: SubmitSegmentDeps = {},
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
    const result = await (deps.submitSegment ?? defaultSubmitSegment)({
      jobId: input.jobId,
      segmentId: context.params.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Video job not found." ||
        error.message === "Video segment not found.")
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "Video segment is not queued."
    ) {
      return NextResponse.json(
        { error: "segment_not_queued" },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "segment_submit_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleSubmitSegmentRequest(request, {
    params: await context.params,
  });
}
