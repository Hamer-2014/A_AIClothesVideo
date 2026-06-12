import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  createDrizzleVideoJobReadStore,
} from "@/server/jobs/get-job";
import { createDrizzleJobStore } from "@/server/jobs/state-machine";
import {
  createDrizzleStoryboardStore,
  generateStoryboardDraft,
  type StoryboardRecord,
} from "@/server/storyboard/generate";
import type { ParsedStoryboard } from "@/server/storyboard/schema";

type StoryboardSession = {
  user?: {
    id?: string;
  };
} | null;

interface StoryboardRouteResult {
  storyboard: StoryboardRecord;
  parsed: ParsedStoryboard;
}

interface GenerateStoryboardDeps {
  getSession?: () => Promise<StoryboardSession>;
  generateStoryboard?: (input: {
    jobId: string;
    userId: string;
    selectedTemplateIds: string[];
    userPrompt: string;
  }) => Promise<StoryboardRouteResult>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const selectedTemplateIds = stringArray(record.selectedTemplateIds);
  const userPrompt = typeof record.userPrompt === "string" ? record.userPrompt : "";

  if (selectedTemplateIds.length === 0 || userPrompt.trim().length === 0) {
    throw new Error("invalid_storyboard_input");
  }

  return {
    selectedTemplateIds,
    userPrompt,
  };
}

function defaultGenerateStoryboard(input: {
  jobId: string;
  userId: string;
  selectedTemplateIds: string[];
  userPrompt: string;
}) {
  return generateStoryboardDraft({
    jobReadStore: createDrizzleVideoJobReadStore(),
    jobStore: createDrizzleJobStore(),
    storyboardStore: createDrizzleStoryboardStore(),
    jobId: input.jobId,
    userId: input.userId,
    selectedTemplateIds: input.selectedTemplateIds,
    userPrompt: input.userPrompt,
    templates: mvpShotTemplates,
  });
}

export async function handleGenerateStoryboardRequest(
  request: Request,
  context: { params: { id: string } },
  deps: GenerateStoryboardDeps = {},
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
      { error: "invalid_storyboard_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.generateStoryboard ?? defaultGenerateStoryboard)({
      jobId: context.params.id,
      userId,
      ...input,
    });

    return NextResponse.json({
      storyboardId: result.storyboard.id,
      status: result.storyboard.status,
      segments: result.parsed.segments,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Video job not found for user.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Selected template is not available")
    ) {
      return NextResponse.json(
        { error: "template_unavailable" },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Prompt moderation blocked storyboard generation."
    ) {
      return NextResponse.json(
        { error: "prompt_moderation_blocked" },
        { status: 403 },
      );
    }

    if (
      error instanceof Error &&
      error.message === "Prompt moderation unavailable for storyboard generation."
    ) {
      return NextResponse.json(
        { error: "prompt_moderation_unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "storyboard_generation_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleGenerateStoryboardRequest(request, {
    params: await context.params,
  });
}
