import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createRuntimeFunnelEventStore,
  recordFunnelEventSafely,
  type FunnelEventStore,
} from "@/server/analytics/funnel-events";
import {
  createDrizzleJobDownloadStore,
  createJobDownloadUrl,
} from "@/server/files/job-download";

type DownloadSession = {
  user?: {
    id?: string;
  };
} | null;

interface DownloadJobDeps {
  getSession?: () => Promise<DownloadSession>;
  createDownload?: (input: {
    jobId: string;
    userId: string;
    filename?: string;
  }) => Promise<{ url: string; expiresIn: number }>;
  funnelEventStore?: FunnelEventStore;
}

function defaultCreateDownload(input: {
  jobId: string;
  userId: string;
  filename?: string;
}) {
  return createJobDownloadUrl({
    store: createDrizzleJobDownloadStore(),
    ...input,
  });
}

function filenameFrom(request: Request) {
  const value = new URL(request.url).searchParams.get("filename")?.trim();
  return value || undefined;
}

export async function handleJobDownloadRequest(
  request: Request,
  context: { params: { id: string } },
  deps: DownloadJobDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const download = await (deps.createDownload ?? defaultCreateDownload)({
      jobId: context.params.id,
      userId,
      filename: filenameFrom(request),
    });
    await recordFunnelEventSafely({
      store: deps.funnelEventStore ?? createRuntimeFunnelEventStore(),
      eventName: "video_downloaded",
      source: "server",
      userId,
      path: new URL(request.url).pathname,
      metadata: {
        jobId: context.params.id,
      },
    });
    return NextResponse.redirect(download.url);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Video job not found for user."
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (
      error instanceof Error &&
      error.message === "Video job is not downloadable."
    ) {
      return NextResponse.json({ error: "not_downloadable" }, { status: 409 });
    }

    return NextResponse.json({ error: "download_failed" }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleJobDownloadRequest(request, { params: await context.params });
}
