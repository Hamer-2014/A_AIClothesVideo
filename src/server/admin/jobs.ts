import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  assets,
  assetAnalyses,
  creditLedger,
  jobStateEvents,
  postQaResults,
  promptModerationResults,
  providerCallLogs,
  stitchJobs,
  storyboards,
  videoJobAssets,
  videoJobs,
  videoSegments,
} from "@/lib/db/schema";

export interface AdminJobRecord {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  reservedLedgerId: string | null;
  finalVideoKey: string | null;
  coverKey: string | null;
  isTest: boolean;
  failureReason: string | null;
  createdAt: Date;
}

export interface AdminSegmentRecord {
  id: string;
  videoJobId: string;
  segmentIndex: number;
  status: string;
  templateId: string;
  provider: string | null;
  model: string | null;
  providerTaskId: string | null;
  videoKey: string | null;
  prompt?: string;
}

export type AdminRelatedRecord = Record<string, unknown>;

export interface AdminAssetRecord {
  videoJobId: string;
  assetId: string;
  role: string;
  sortOrder: number;
  fileName?: string;
  originalKey?: string;
  detectedRole?: string | null;
}

export interface AdminAnalysisRecord {
  videoJobId: string;
  assetId: string;
  analysisJson: unknown;
  mode?: string;
}

export interface AdminStoryboardRecord {
  id: string;
  videoJobId: string;
  status: string;
  selectedTemplateIds: unknown;
  storyboardJson: unknown;
  finalPromptSnapshot?: unknown;
  createdAt: Date;
}

export interface AdminStateEventRecord {
  id: string;
  videoJobId: string;
  segmentId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
  actorId: string | null;
  eventSnapshot: unknown;
  createdAt: Date;
}

export interface AdminJobStore {
  findJob(jobId: string): Promise<AdminJobRecord | null>;
  listAssets(jobId: string): Promise<AdminAssetRecord[]>;
  listAnalyses(jobId: string): Promise<AdminAnalysisRecord[]>;
  findLatestStoryboard(jobId: string): Promise<AdminStoryboardRecord | null>;
  listSegments(jobId: string): Promise<AdminSegmentRecord[]>;
  listProviderLogs(jobId: string): Promise<AdminRelatedRecord[]>;
  listModerationResults(jobId: string): Promise<AdminRelatedRecord[]>;
  listLedger(jobId: string): Promise<AdminRelatedRecord[]>;
  listStitchJobs(jobId: string): Promise<AdminRelatedRecord[]>;
  listPostQaResults(jobId: string): Promise<AdminRelatedRecord[]>;
  listStateEvents(jobId: string): Promise<AdminStateEventRecord[]>;
}

export async function getAdminJobDetail({
  store,
  jobId,
}: {
  store: AdminJobStore;
  jobId: string;
}) {
  const job = await store.findJob(jobId);
  if (!job) {
    return null;
  }

  const [
    assets,
    analyses,
    latestStoryboard,
    segments,
    providerLogs,
    moderationResults,
    ledger,
    stitchJobRecords,
    postQaResultRecords,
    stateEvents,
  ] = await Promise.all([
    store.listAssets(jobId),
    store.listAnalyses(jobId),
    store.findLatestStoryboard(jobId),
    store.listSegments(jobId),
    store.listProviderLogs(jobId),
    store.listModerationResults(jobId),
    store.listLedger(jobId),
    store.listStitchJobs(jobId),
    store.listPostQaResults(jobId),
    store.listStateEvents(jobId),
  ]);

  return {
    job,
    assets,
    analyses,
    latestStoryboard,
    segments,
    providerLogs,
    moderationResults,
    ledger,
    stitchJobs: stitchJobRecords,
    postQaResults: postQaResultRecords,
    stateEvents,
  };
}

export function createInMemoryAdminJobStore(input: {
  jobs: AdminJobRecord[];
  assets?: AdminAssetRecord[];
  analyses?: AdminAnalysisRecord[];
  storyboards?: AdminStoryboardRecord[];
  segments: AdminSegmentRecord[];
  providerLogs: AdminRelatedRecord[];
  moderationResults: AdminRelatedRecord[];
  ledger: AdminRelatedRecord[];
  stitchJobs: AdminRelatedRecord[];
  postQaResults: AdminRelatedRecord[];
  stateEvents?: AdminStateEventRecord[];
}): AdminJobStore {
  return {
    async findJob(jobId) {
      return input.jobs.find((job) => job.id === jobId) ?? null;
    },
    async listAssets(jobId) {
      return (input.assets ?? []).filter((asset) => asset.videoJobId === jobId);
    },
    async listAnalyses(jobId) {
      return (input.analyses ?? []).filter((analysis) => analysis.videoJobId === jobId);
    },
    async findLatestStoryboard(jobId) {
      return (
        [...(input.storyboards ?? [])]
          .filter((storyboard) => storyboard.videoJobId === jobId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async listSegments(jobId) {
      return input.segments.filter((segment) => segment.videoJobId === jobId);
    },
    async listProviderLogs(jobId) {
      return input.providerLogs.filter((log) => log.videoJobId === jobId);
    },
    async listModerationResults(jobId) {
      return input.moderationResults.filter((result) => result.videoJobId === jobId);
    },
    async listLedger(jobId) {
      return input.ledger.filter((entry) => entry.relatedJobId === jobId);
    },
    async listStitchJobs(jobId) {
      return input.stitchJobs.filter((job) => job.videoJobId === jobId);
    },
    async listPostQaResults(jobId) {
      return input.postQaResults.filter((result) => result.videoJobId === jobId);
    },
    async listStateEvents(jobId) {
      return (input.stateEvents ?? []).filter((event) => event.videoJobId === jobId);
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminJobStore(db: DbClient = getDb()): AdminJobStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          creditCost: videoJobs.creditCost,
          reservedLedgerId: videoJobs.reservedLedgerId,
          finalVideoKey: videoJobs.finalVideoKey,
          coverKey: videoJobs.coverKey,
          isTest: videoJobs.isTest,
          failureReason: videoJobs.failureReason,
          createdAt: videoJobs.createdAt,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as AdminJobRecord | undefined) ?? null;
    },
    async listAssets(jobId) {
      return db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
          fileName: assets.fileName,
          originalKey: assets.originalKey,
          detectedRole: assets.detectedRole,
        })
        .from(videoJobAssets)
        .innerJoin(assets, eq(videoJobAssets.assetId, assets.id))
        .where(eq(videoJobAssets.videoJobId, jobId));
    },
    async listAnalyses(jobId) {
      return db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: assetAnalyses.assetId,
          analysisJson: assetAnalyses.analysisJson,
          mode: assetAnalyses.mode,
        })
        .from(assetAnalyses)
        .innerJoin(videoJobAssets, eq(assetAnalyses.assetId, videoJobAssets.assetId))
        .where(eq(videoJobAssets.videoJobId, jobId));
    },
    async findLatestStoryboard(jobId) {
      const [storyboard] = await db
        .select({
          id: storyboards.id,
          videoJobId: storyboards.videoJobId,
          status: storyboards.status,
          selectedTemplateIds: storyboards.selectedTemplateIds,
          storyboardJson: storyboards.storyboardJson,
          finalPromptSnapshot: storyboards.finalPromptSnapshot,
          createdAt: storyboards.createdAt,
        })
        .from(storyboards)
        .where(eq(storyboards.videoJobId, jobId))
        .orderBy(desc(storyboards.createdAt))
        .limit(1);

      return (storyboard as AdminStoryboardRecord | undefined) ?? null;
    },
    async listSegments(jobId) {
      return db
        .select({
          id: videoSegments.id,
          videoJobId: videoSegments.videoJobId,
          segmentIndex: videoSegments.segmentIndex,
          status: videoSegments.status,
          templateId: videoSegments.templateId,
          provider: videoSegments.provider,
          model: videoSegments.model,
          providerTaskId: videoSegments.providerTaskId,
          videoKey: videoSegments.videoKey,
          prompt: videoSegments.prompt,
        })
        .from(videoSegments)
        .where(eq(videoSegments.videoJobId, jobId));
    },
    async listProviderLogs(jobId) {
      return db
        .select()
        .from(providerCallLogs)
        .where(eq(providerCallLogs.videoJobId, jobId));
    },
    async listModerationResults(jobId) {
      return db
        .select()
        .from(promptModerationResults)
        .where(eq(promptModerationResults.videoJobId, jobId));
    },
    async listLedger(jobId) {
      return db
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.relatedJobId, jobId));
    },
    async listStitchJobs(jobId) {
      return db.select().from(stitchJobs).where(eq(stitchJobs.videoJobId, jobId));
    },
    async listPostQaResults(jobId) {
      return db
        .select()
        .from(postQaResults)
        .where(eq(postQaResults.videoJobId, jobId));
    },
    async listStateEvents(jobId) {
      return db
        .select({
          id: jobStateEvents.id,
          videoJobId: jobStateEvents.videoJobId,
          segmentId: jobStateEvents.segmentId,
          fromStatus: jobStateEvents.fromStatus,
          toStatus: jobStateEvents.toStatus,
          reason: jobStateEvents.reason,
          actorType: jobStateEvents.actorType,
          actorId: jobStateEvents.actorId,
          eventSnapshot: jobStateEvents.eventSnapshot,
          createdAt: jobStateEvents.createdAt,
        })
        .from(jobStateEvents)
        .where(eq(jobStateEvents.videoJobId, jobId));
    },
  };
}
