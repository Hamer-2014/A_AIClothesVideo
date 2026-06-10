import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  confirmStoryboard,
  createDrizzleStoryboardConfirmationStore,
} from "@/server/storyboard/confirm";

type ConfirmSession = {
  user?: {
    id?: string;
  };
} | null;

interface ConfirmStoryboardResult {
  jobId: string;
  storyboardId: string;
  status: "segments_queued";
  reservedLedgerId: string | null;
  segmentCount: number;
}

interface ConfirmStoryboardDeps {
  getSession?: () => Promise<ConfirmSession>;
  confirmStoryboard?: (input: {
    jobId: string;
    userId: string;
    storyboardId: string;
  }) => Promise<ConfirmStoryboardResult>;
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

    return NextResponse.json(result);
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
