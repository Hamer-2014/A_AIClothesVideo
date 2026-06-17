import { createDownloadSignedUrl as createR2DownloadSignedUrl } from "@/lib/storage/presign";
import { getDb } from "@/lib/db/client";
import { and, asc, eq, isNull } from "drizzle-orm";
import { assets, videoJobAssets } from "@/lib/db/schema";
import { buildRecommendationsFromAnalyses } from "@/server/assets/analyze";
import {
  analyzeAssetWithVisionProvider,
  createDrizzleAssetAnalysisStore,
  userVisibleAssetAnalysisError,
  type AssetAnalysisStore,
  type VisionAssetAnalysisProvider,
} from "@/server/assets/analyze";
import type { ProviderCallLogStore } from "@/lib/providers/log-call";
import { createDrizzleProviderCallLogStore } from "@/lib/providers/log-call";
import type { VisionAnalysisMode } from "@/lib/providers/vision/client";
import type { ShotTemplateDefinition } from "@/lib/templates/types";
import {
  recordFunnelEventSafely,
  type FunnelEventStore,
} from "@/server/analytics/funnel-events";
import type { AssetRole } from "@/server/assets/analysis-schema";
import type { JobStore } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";

export interface VideoJobAssetRecord {
  assetId: string;
  originalKey: string;
  role: AssetRole | string;
  sortOrder: number;
}

export interface VideoJobAssetStore {
  listJobAssets(input: {
    jobId: string;
    userId: string;
  }): Promise<VideoJobAssetRecord[]>;
}

export function createInMemoryVideoJobAssetStore(
  assets: VideoJobAssetRecord[],
): VideoJobAssetStore {
  return {
    async listJobAssets() {
      return [...assets].sort((a, b) => a.sortOrder - b.sortOrder);
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleVideoJobAssetStore(
  db: DbClient = getDb(),
): VideoJobAssetStore {
  return {
    async listJobAssets({ jobId, userId }) {
      const rows = await db
        .select({
          assetId: videoJobAssets.assetId,
          originalKey: assets.originalKey,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
        })
        .from(videoJobAssets)
        .innerJoin(assets, eq(videoJobAssets.assetId, assets.id))
        .where(
          and(
            eq(videoJobAssets.videoJobId, jobId),
            eq(assets.userId, userId),
            isNull(assets.deletedAt),
          ),
        )
        .orderBy(asc(videoJobAssets.sortOrder));

      return rows;
    },
  };
}

function errorMessage(error: unknown) {
  return userVisibleAssetAnalysisError(error);
}

function declaredRoleFromJobAsset(role: string): AssetRole | null {
  return [
    "front",
    "back",
    "side",
    "detail",
    "scene",
    "logo",
    "unknown",
  ].includes(role)
    ? (role as AssetRole)
    : null;
}

async function failAnalysisJob({
  jobStore,
  jobId,
  message,
}: {
  jobStore: JobStore;
  jobId: string;
  message: string;
}) {
  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "asset_analysis_failed",
    reason: "asset_analysis_failed",
    errorMessage: message,
    userVisibleStatus: "failed",
    failureReason: message,
    clearLock: true,
  });
}

async function ensureAnalysisRunning({
  jobStore,
  jobId,
}: {
  jobStore: JobStore;
  jobId: string;
}) {
  const job = await jobStore.findJob(jobId);
  if (!job) {
    throw new Error(`Video job not found: ${jobId}.`);
  }

  if (job.status === "asset_analysis_running") {
    return;
  }

  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "asset_analysis_running",
    reason: "asset_analysis_started",
    errorMessage: null,
    userVisibleStatus: "analyzing_assets",
    failureReason: null,
  });
}

export async function analyzeVideoJobAssets({
  jobStore,
  jobAssetStore,
  analysisStore = createDrizzleAssetAnalysisStore(),
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  jobId,
  userId,
  mode,
  templates,
  isTrial,
  createDownloadSignedUrl = ({ key }) =>
    createR2DownloadSignedUrl({ key, expiresIn: 900 }),
  visionProvider,
  manageJobStatus = true,
  funnelEventStore,
}: {
  jobStore: JobStore;
  jobAssetStore: VideoJobAssetStore;
  analysisStore?: AssetAnalysisStore;
  providerCallLogStore?: ProviderCallLogStore;
  jobId: string;
  userId: string;
  mode: VisionAnalysisMode;
  templates: ShotTemplateDefinition[];
  isTrial: boolean;
  createDownloadSignedUrl?: (input: { key: string }) => Promise<string>;
  visionProvider?: VisionAssetAnalysisProvider;
  manageJobStatus?: boolean;
  funnelEventStore?: FunnelEventStore;
}) {
  const job = await jobStore.findJob(jobId);
  if (!job || job.userId !== userId) {
    throw new Error("Video job not found for user.");
  }

  try {
    if (manageJobStatus) {
      await ensureAnalysisRunning({ jobStore, jobId });
    }
    const jobAssets = await jobAssetStore.listJobAssets({ jobId, userId });
    if (jobAssets.length === 0) {
      throw new Error("Video job has no attached assets.");
    }

    const analyses = [];
    const records = [];
    const declaredRoles = jobAssets
      .map((asset) => declaredRoleFromJobAsset(asset.role))
      .filter((role): role is AssetRole => Boolean(role) && role !== "unknown");

    for (const asset of jobAssets) {
      const signedUrl = await createDownloadSignedUrl({ key: asset.originalKey });
      const result = await analyzeAssetWithVisionProvider({
        analysisStore,
        providerCallLogStore,
        assetId: asset.assetId,
        userId,
        videoJobId: jobId,
        mode,
        imageUrls: [signedUrl],
        templates,
        isTrial,
        visionProvider,
      });

      analyses.push(result.analysis);
      records.push(result.record);
    }

    const recommendationResult = buildRecommendationsFromAnalyses({
      analyses,
      templates,
      isTrial,
      declaredRoles,
    });

    if (manageJobStatus) {
      await transitionJobStatus({
        store: jobStore,
        jobId,
        toStatus: "asset_analysis_passed",
        reason: "asset_analysis_completed",
        errorMessage: null,
        userVisibleStatus: "assets_ready",
        failureReason: null,
        eventSnapshot: {
          assetCount: jobAssets.length,
          availableTemplateIds:
            recommendationResult.recommendations.availableTemplateIds,
        },
        clearLock: true,
      });
    }
    if (funnelEventStore) {
      await recordFunnelEventSafely({
        store: funnelEventStore,
        eventName: "asset_analysis_passed",
        source: "server",
        userId,
        metadata: {
          jobId,
          status: "asset_analysis_passed",
        },
      });
    }

    return {
      analyses,
      records,
      ...recommendationResult,
    };
  } catch (error) {
    if (manageJobStatus) {
      const currentJob = await jobStore.findJob(jobId);
      if (currentJob?.status === "asset_analysis_passed") {
        throw error;
      }

      await failAnalysisJob({
        jobStore,
        jobId,
        message: errorMessage(error),
      });
      if (funnelEventStore) {
        await recordFunnelEventSafely({
          store: funnelEventStore,
          eventName: "asset_analysis_failed",
          source: "server",
          userId,
          metadata: {
            jobId,
            status: "asset_analysis_failed",
            reasonCategory: "asset_analysis",
          },
        });
      }
    }
    throw error;
  }
}
