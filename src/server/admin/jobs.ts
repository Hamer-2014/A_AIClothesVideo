import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  creditLedger,
  postQaResults,
  promptModerationResults,
  providerCallLogs,
  stitchJobs,
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
}

export type AdminRelatedRecord = Record<string, unknown>;

export interface AdminJobStore {
  findJob(jobId: string): Promise<AdminJobRecord | null>;
  listSegments(jobId: string): Promise<AdminSegmentRecord[]>;
  listProviderLogs(jobId: string): Promise<AdminRelatedRecord[]>;
  listModerationResults(jobId: string): Promise<AdminRelatedRecord[]>;
  listLedger(jobId: string): Promise<AdminRelatedRecord[]>;
  listStitchJobs(jobId: string): Promise<AdminRelatedRecord[]>;
  listPostQaResults(jobId: string): Promise<AdminRelatedRecord[]>;
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
    segments,
    providerLogs,
    moderationResults,
    ledger,
    stitchJobRecords,
    postQaResultRecords,
  ] = await Promise.all([
    store.listSegments(jobId),
    store.listProviderLogs(jobId),
    store.listModerationResults(jobId),
    store.listLedger(jobId),
    store.listStitchJobs(jobId),
    store.listPostQaResults(jobId),
  ]);

  return {
    job,
    segments,
    providerLogs,
    moderationResults,
    ledger,
    stitchJobs: stitchJobRecords,
    postQaResults: postQaResultRecords,
  };
}

export function createInMemoryAdminJobStore(input: {
  jobs: AdminJobRecord[];
  segments: AdminSegmentRecord[];
  providerLogs: AdminRelatedRecord[];
  moderationResults: AdminRelatedRecord[];
  ledger: AdminRelatedRecord[];
  stitchJobs: AdminRelatedRecord[];
  postQaResults: AdminRelatedRecord[];
}): AdminJobStore {
  return {
    async findJob(jobId) {
      return input.jobs.find((job) => job.id === jobId) ?? null;
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
          createdAt: videoJobs.createdAt,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as AdminJobRecord | undefined) ?? null;
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
  };
}
