import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assetAnalyses,
  videoJobAssets,
  videoJobs,
} from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { ShotTemplateDefinition } from "@/lib/templates/types";
import { buildRecommendationsFromAnalyses } from "@/server/assets/analyze";
import { parseAssetAnalysisJson } from "@/server/assets/analysis-schema";

export interface VideoJobSummary {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
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

export interface VideoJobReadStore {
  findJob(input: { jobId: string; userId: string }): Promise<VideoJobSummary | null>;
  listJobAssets(jobId: string): Promise<VideoJobAssetSummary[]>;
  listAnalyses(assetIds: string[]): Promise<VideoJobAnalysisSummary[]>;
}

export function createInMemoryVideoJobReadStore({
  jobs,
  assets,
  analyses,
}: {
  jobs: VideoJobSummary[];
  assets: VideoJobAssetSummary[];
  analyses: VideoJobAnalysisSummary[];
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
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          creditCost: videoJobs.creditCost,
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
  };
}

export async function getVideoJobDetail({
  store,
  jobId,
  userId,
  templates,
  isTrial,
}: {
  store: VideoJobReadStore;
  jobId: string;
  userId: string;
  templates: ShotTemplateDefinition[];
  isTrial: boolean;
}) {
  const job = await store.findJob({ jobId, userId });
  if (!job) {
    return null;
  }

  const assets = await store.listJobAssets(jobId);
  const analyses = await store.listAnalyses(assets.map((asset) => asset.assetId));
  const parsedAnalyses = analyses.map((analysis) =>
    parseAssetAnalysisJson(analysis.analysisJson),
  );
  const recommendationResult = buildRecommendationsFromAnalyses({
    analyses: parsedAnalyses,
    templates,
    isTrial,
  });

  return {
    job,
    assets,
    analyses,
    ...recommendationResult,
  };
}
