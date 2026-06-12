import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  confirmStoryboard,
  createDrizzleStoryboardConfirmationStore,
} from "@/server/storyboard/confirm";
import {
  createDrizzleVideoSegmentStore,
  kickQueuedSegmentsForJob,
  type GenerationKickResult,
} from "@/server/video/segments";

type ConfirmSession = {
  user?: {
    id?: string;
  };
} | null;

interface ConfirmStoryboardResult {
  jobId: string;
  storyboardId: string;
  status: "segments_queued" | "segment_generating";
  reservedLedgerId: string | null;
  segmentCount: number;
  alreadyConfirmed?: boolean;
  generationKick?: GenerationKickResult;
}

interface ConfirmStoryboardDeps {
  getSession?: () => Promise<ConfirmSession>;
  confirmStoryboard?: (input: {
    jobId: string;
    userId: string;
    storyboardId: string;
  }) => Promise<ConfirmStoryboardResult>;
  kickGeneration?: (input: { jobId: string }) => Promise<GenerationKickResult>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const storyboardId =
    typeof record.storyboardId === "string" ? record.storyboardId.trim() : "";

  if (!storyboardId) {
    throw new Error("invalid_confirm_input");
  }

  return { storyboardId };
}

function defaultConfirmStoryboard(input: {
  jobId: string;
  userId: string;
  storyboardId: string;
}) {
  return confirmStoryboard({
    storyboardStore: createDrizzleStoryboardConfirmationStore(),
    ...input,
  });
}

function defaultKickGeneration(input: { jobId: string }) {
  return kickQueuedSegmentsForJob({
    segmentStore: createDrizzleVideoSegmentStore(),
    jobId: input.jobId,
  });
}

export async function handleConfirmStoryboardRequest(
  request: Request,
  context: { params: { id: string } },
  deps: ConfirmStoryboardDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_confirm_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.confirmStoryboard ?? defaultConfirmStoryboard)({
      jobId: context.params.id,
      userId,
      storyboardId: input.storyboardId,
    });

    const generationKick = await (deps.kickGeneration ?? defaultKickGeneration)({
      jobId: result.jobId,
    });
    const responseBody = {
      ...result,
      status:
        generationKick.status === "submitted"
          ? "segment_generating"
          : result.status,
      generationKick,
    } satisfies ConfirmStoryboardResult;

    if (generationKick.status === "failed") {
      return NextResponse.json(
        {
          error: "generation_submit_failed",
          message:
            generationKick.errorMessage ?? "Immediate video generation submit failed.",
          ...responseBody,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Video job not found for user." ||
        error.message === "Storyboard not found for job.")
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "Final prompt moderation blocked video generation."
    ) {
      return NextResponse.json(
        { error: "prompt_moderation_blocked" },
        { status: 403 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Final prompt moderation unavailable for video generation."
    ) {
      return NextResponse.json(
        { error: "prompt_moderation_unavailable" },
        { status: 503 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Insufficient available credits."
    ) {
      return NextResponse.json(
        { error: "insufficient_credits" },
        { status: 402 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Storyboard is not confirmable."
    ) {
      return NextResponse.json(
        { error: "storyboard_not_confirmable" },
        { status: 409 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Storyboard is already confirmed."
    ) {
      return NextResponse.json({
        jobId: context.params.id,
        storyboardId: input.storyboardId,
        status: "segments_queued",
        reservedLedgerId: null,
        segmentCount: 0,
        alreadyConfirmed: true,
      } satisfies ConfirmStoryboardResult);
    }

    return NextResponse.json(
      { error: "storyboard_confirmation_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleConfirmStoryboardRequest(request, {
    params: await context.params,
  });
}
