import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import type { VisionAnalysisMode } from "@/lib/providers/vision/client";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  analyzeVideoJobAssets,
  createDrizzleVideoJobAssetStore,
} from "@/server/assets/job-analysis";
import { createDrizzleJobStore } from "@/server/jobs/state-machine";

type AnalyzeSession = {
  user?: {
    id?: string;
  };
} | null;

interface AnalyzeJobResult {
  jobId: string;
  userId: string;
  availableTemplateIds: string[];
}

interface AnalyzeJobRouteDeps {
  getSession?: () => Promise<AnalyzeSession>;
  analyzeJob?: (input: {
    jobId: string;
    userId: string;
    mode: VisionAnalysisMode;
    isTrial: boolean;
  }) => Promise<AnalyzeJobResult>;
}

async function defaultAnalyzeJob(): Promise<AnalyzeJobResult> {
  throw new Error("Analyze job runtime requires input.");
}

async function analyzeJobWithDrizzle(input: {
  jobId: string;
  userId: string;
  mode: VisionAnalysisMode;
  isTrial: boolean;
}): Promise<AnalyzeJobResult> {
  const result = await analyzeVideoJobAssets({
    jobStore: createDrizzleJobStore(),
    jobAssetStore: createDrizzleVideoJobAssetStore(),
    jobId: input.jobId,
    userId: input.userId,
    mode: input.mode,
    templates: mvpShotTemplates,
    isTrial: input.isTrial,
  });

  return {
    jobId: input.jobId,
    userId: input.userId,
    availableTemplateIds: result.recommendations.availableTemplateIds,
  };
}

function parseMode(value: unknown): VisionAnalysisMode {
  return value === "lite" || value === "strict" ? value : "standard";
}

export async function handleAnalyzeJobRequest(
  request: Request,
  context: { params: { id: string } },
  deps: AnalyzeJobRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = request.body ? await request.json().catch(() => ({})) : {};
  const analyzeJob = deps.analyzeJob ?? analyzeJobWithDrizzle ?? defaultAnalyzeJob;

  try {
    const result = await analyzeJob({
      jobId: context.params.id,
      userId,
      mode: parseMode((body as Record<string, unknown>).mode),
      isTrial: (body as Record<string, unknown>).isTrial === true,
    });

    return NextResponse.json({
      jobId: result.jobId,
      availableTemplateIds: result.availableTemplateIds,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Video job not found for user.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const body = {
      error: "asset_analysis_failed",
      message:
        error instanceof Error
          ? error.message
          : "素材分析失败，请稍后重试。",
    };

    return NextResponse.json(
      body,
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleAnalyzeJobRequest(request, { params: await context.params });
}
