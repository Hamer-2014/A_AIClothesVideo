import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  createDrizzleVideoJobReadStore,
  getVideoJobDetail,
  type VideoJobReadStore,
} from "@/server/jobs/get-job";

type JobDetailSession = {
  user?: {
    id?: string;
  };
} | null;

type JobDetailResult = Awaited<ReturnType<typeof getVideoJobDetail>>;

interface GetJobRouteDeps {
  getSession?: () => Promise<JobDetailSession>;
  getJob?: (input: {
    jobId: string;
    userId: string;
  }) => Promise<JobDetailResult>;
  store?: VideoJobReadStore;
}

async function defaultGetJob({
  jobId,
  userId,
  store = createDrizzleVideoJobReadStore(),
}: {
  jobId: string;
  userId: string;
  store?: VideoJobReadStore;
}) {
  return getVideoJobDetail({
    store,
    jobId,
    userId,
    templates: mvpShotTemplates,
  });
}

export async function handleGetJobRequest(
  request: Request,
  context: { params: { id: string } },
  deps: GetJobRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const getJob =
    deps.getJob ??
    ((input: { jobId: string; userId: string }) =>
      defaultGetJob({ ...input, store: deps.store }));
  const detail = await getJob({
    jobId: context.params.id,
    userId,
  });

  if (!detail) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    job: {
      id: detail.job.id,
      status: detail.job.status,
      userVisibleStatus: detail.job.userVisibleStatus,
      lastError: detail.job.lastError,
      failureReason: detail.job.failureReason,
      durationSeconds: detail.job.durationSeconds,
      aspectRatio: detail.job.aspectRatio,
      creditCost: detail.job.creditCost,
      billingMode: detail.job.billingMode,
      generationProfile: detail.job.generationProfile,
      watermarkEnabled: detail.job.watermarkEnabled,
    },
    assetCount: detail.assets.length,
    assets: detail.assets,
    analyses: detail.analyses,
    acceptable: detail.acceptable,
    assetCompleteness: detail.assetCompleteness,
    recommendations: detail.recommendations,
    latestStoryboard: detail.latestStoryboard
      ? {
          id: detail.latestStoryboard.id,
          status: detail.latestStoryboard.status,
          selectedTemplateIds: detail.latestStoryboard.selectedTemplateIds,
          storyboardJson: detail.latestStoryboard.storyboardJson,
        }
      : null,
  });
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleGetJobRequest(request, { params: await context.params });
}
