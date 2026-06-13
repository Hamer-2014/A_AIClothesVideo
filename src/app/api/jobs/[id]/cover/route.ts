import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleJobCoverStore,
  createJobCoverUrl,
} from "@/server/files/job-cover";

type CoverSession = {
  user?: {
    id?: string;
  };
} | null;

interface CoverJobDeps {
  getSession?: () => Promise<CoverSession>;
  createCover?: (input: {
    jobId: string;
    userId: string;
  }) => Promise<{ url: string; expiresIn: number }>;
}

function defaultCreateCover(input: { jobId: string; userId: string }) {
  return createJobCoverUrl({
    store: createDrizzleJobCoverStore(),
    ...input,
  });
}

export async function handleJobCoverRequest(
  request: Request,
  context: { params: { id: string } },
  deps: CoverJobDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const cover = await (deps.createCover ?? defaultCreateCover)({
      jobId: context.params.id,
      userId,
    });
    return NextResponse.redirect(cover.url);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Video job not found for user."
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "Video job cover is not available."
    ) {
      return NextResponse.json({ error: "cover_not_available" }, { status: 409 });
    }

    return NextResponse.json({ error: "cover_failed" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleJobCoverRequest(request, { params: await context.params });
}
