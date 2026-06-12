import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assetAnalyses,
  storyboards,
  videoJobAssets,
  videoJobs,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { BillingMode, GenerationProfile } from "@/server/jobs/create-job";
import type { ShotTemplateDefinition } from "@/lib/templates/types";
import { buildRecommendationsFromAnalyses } from "@/server/assets/analyze";
import { parseAssetAnalysisJson } from "@/server/assets/analysis-schema";

export interface VideoJobSummary {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  lastError: string | null;
  failureReason: string | null;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  billingMode: BillingMode;
  generationProfile: GenerationProfile;
  watermarkEnabled: boolean;
}

export interface VideoJobAssetSummary {
  assetId: string;
  role: string;
  sortOrder: number;
}

export interface VideoJobAnalysisSummary {
  assetId: string;
  analysisJson: JsonValue;
}

export interface VideoJobStoryboardSummary {
  id: string;
  videoJobId: string;
  status: string;
  selectedTemplateIds: JsonValue;
  storyboardJson: JsonValue;
  createdAt: Date;
}

export interface VideoJobReadStore {
  findJob(input: { jobId: string; userId: string }): Promise<VideoJobSummary | null>;
  listJobAssets(jobId: string): Promise<VideoJobAssetSummary[]>;
  listAnalyses(assetIds: string[]): Promise<VideoJobAnalysisSummary[]>;
  findLatestStoryboard(jobId: string): Promise<VideoJobStoryboardSummary | null>;
}

export function createInMemoryVideoJobReadStore({
  jobs,
  assets,
  analyses,
  storyboards,
}: {
  jobs: VideoJobSummary[];
  assets: VideoJobAssetSummary[];
  analyses: VideoJobAnalysisSummary[];
  storyboards?: VideoJobStoryboardSummary[];
}): VideoJobReadStore {
  return {
    async findJob({ jobId, userId }) {
      return jobs.find((job) => job.id === jobId && job.userId === userId) ?? null;
    },
    async listJobAssets() {
      return [...assets].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async listAnalyses(assetIds) {
      return analyses.filter((analysis) => assetIds.includes(analysis.assetId));
    },
    async findLatestStoryboard(jobId) {
      return (
        [...(storyboards ?? [])]
          .filter((storyboard) => storyboard.videoJobId === jobId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
        null
      );
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleVideoJobReadStore(
  db: DbClient = getDb(),
): VideoJobReadStore {
  return {
    async findJob({ jobId, userId }) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          lastError: videoJobs.lastError,
          failureReason: videoJobs.failureReason,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          creditCost: videoJobs.creditCost,
          billingMode: videoJobs.billingMode,
          generationProfile: videoJobs.generationProfile,
          watermarkEnabled: videoJobs.watermarkEnabled,
        })
        .from(videoJobs)
        .where(
          and(
            eq(videoJobs.id, jobId),
            eq(videoJobs.userId, userId),
            isNull(videoJobs.deletedAt),
          ),
        )
        .limit(1);

      return (job as VideoJobSummary | undefined) ?? null;
    },
    async listJobAssets(jobId) {
      return db
        .select({
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
        })
        .from(videoJobAssets)
        .where(eq(videoJobAssets.videoJobId, jobId))
        .orderBy(asc(videoJobAssets.sortOrder));
    },
    async listAnalyses(assetIds) {
      if (assetIds.length === 0) {
        return [];
      }

      return db
        .select({
          assetId: assetAnalyses.assetId,
          analysisJson: assetAnalyses.analysisJson,
        })
        .from(assetAnalyses)
        .where(inArray(assetAnalyses.assetId, assetIds));
    },
    async findLatestStoryboard(jobId) {
      const [storyboard] = await db
        .select({
          id: storyboards.id,
          videoJobId: storyboards.videoJobId,
          status: storyboards.status,
          selectedTemplateIds: storyboards.selectedTemplateIds,
          storyboardJson: storyboards.storyboardJson,
          createdAt: storyboards.createdAt,
        })
        .from(storyboards)
        .where(eq(storyboards.videoJobId, jobId))
        .orderBy(desc(storyboards.createdAt))
        .limit(1);

      return (storyboard as VideoJobStoryboardSummary | undefined) ?? null;
    },
  };
}

export async function getVideoJobDetail({
  store,
  jobId,
  userId,
  templates,
}: {
  store: VideoJobReadStore;
  jobId: string;
  userId: string;
  templates: ShotTemplateDefinition[];
}) {
  const job = await store.findJob({ jobId, userId });
  if (!job) {
    return null;
  }

  const assets = await store.listJobAssets(jobId);
  const analyses = await store.listAnalyses(assets.map((asset) => asset.assetId));
  const latestStoryboard = await store.findLatestStoryboard(jobId);
  const parsedAnalyses = analyses.map((analysis) =>
    parseAssetAnalysisJson(analysis.analysisJson),
  );
  const recommendationResult = buildRecommendationsFromAnalyses({
    analyses: parsedAnalyses,
    templates,
    isTrial: job.billingMode === "free_trial",
  });

  return {
    job,
    assets,
    analyses,
    latestStoryboard,
    ...recommendationResult,
  };
}
