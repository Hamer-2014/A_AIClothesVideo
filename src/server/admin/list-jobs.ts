import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { creditLedger, videoJobs } from "@/lib/db/schema";

const ATTENTION_FAILURE_STATUSES = new Set([
  "segment_failed",
  "stitching_failed",
  "post_qa_failed",
  "failed_released",
  "failed_refunded",
  "prompt_moderation_blocked",
  "asset_analysis_failed",
]);

const FAILURE_QUEUE_STATUSES = new Set([
  "failed_released",
  "failed_refunded",
  "post_qa_failed",
  "prompt_moderation_blocked",
  "segment_failed",
  "asset_analysis_failed",
]);

const ATTENTION_STALE_STATUSES = new Set([
  "post_qa_queued",
  "post_qa_running",
  "stitching_queued",
  "stitching_running",
  "segment_generating",
]);

const ATTENTION_STALE_THRESHOLD_MS = 10 * 60 * 1000;

export interface AdminJobListItem {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  billingMode: string;
  presetId: string | null;
  creditCost: number;
  failureReason: string | null;
  isTest: boolean;
  hasCapture?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminJobListFilters {
  attention?: boolean;
  failureQueue?: boolean;
  isTest?: boolean;
  status?: string;
  billingMode?: string;
  presetId?: string;
  query?: string;
}

export interface AdminJobListStore {
  listJobs(): Promise<AdminJobListItem[]>;
}

export interface AdminJobLedgerSummaryStore {
  listCapturedJobIds(): Promise<Set<string>>;
}

export function createInMemoryAdminJobListStore(
  jobs: AdminJobListItem[],
): AdminJobListStore {
  return {
    async listJobs() {
      return [...jobs]
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .map((job) => ({ ...job }));
    },
  };
}

export function createInMemoryAdminJobLedgerSummaryStore(
  capturedJobIds: string[],
): AdminJobLedgerSummaryStore {
  return {
    async listCapturedJobIds() {
      return new Set(capturedJobIds);
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminJobListStore(
  db: DbClient = getDb(),
): AdminJobListStore {
  return {
    async listJobs() {
      return db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          billingMode: videoJobs.billingMode,
          presetId: videoJobs.presetId,
          creditCost: videoJobs.creditCost,
          failureReason: videoJobs.failureReason,
          isTest: videoJobs.isTest,
          createdAt: videoJobs.createdAt,
          updatedAt: videoJobs.updatedAt,
        })
        .from(videoJobs)
        .orderBy(desc(videoJobs.createdAt));
    },
  };
}

export function createDrizzleAdminJobLedgerSummaryStore(
  db: DbClient = getDb(),
): AdminJobLedgerSummaryStore {
  return {
    async listCapturedJobIds() {
      const rows = await db
        .select({
          relatedJobId: creditLedger.relatedJobId,
        })
        .from(creditLedger)
        .where(eq(creditLedger.type, "capture"));

      return new Set(
        rows
          .map((row) => row.relatedJobId)
          .filter((jobId): jobId is string => typeof jobId === "string"),
      );
    },
  };
}

function isDeliveredWithoutCapture(job: AdminJobListItem) {
  return (
    job.status === "deliverable" &&
    job.creditCost > 0 &&
    job.hasCapture === false
  );
}

export function isAttentionJob(job: AdminJobListItem, now: Date) {
  if (isDeliveredWithoutCapture(job)) {
    return true;
  }

  if (ATTENTION_FAILURE_STATUSES.has(job.status)) {
    return true;
  }

  if (!ATTENTION_STALE_STATUSES.has(job.status)) {
    return false;
  }

  return now.getTime() - job.updatedAt.getTime() > ATTENTION_STALE_THRESHOLD_MS;
}

export async function listAdminJobs({
  store,
  ledgerSummaryStore,
  filters,
  now = new Date(),
}: {
  store: AdminJobListStore;
  ledgerSummaryStore?: AdminJobLedgerSummaryStore;
  filters?: AdminJobListFilters;
  now?: Date;
}) {
  const [jobs, capturedJobIds] = await Promise.all([
    store.listJobs(),
    ledgerSummaryStore?.listCapturedJobIds(),
  ]);
  const normalizedQuery = filters?.query?.trim().toLowerCase();
  const jobsWithLedger = capturedJobIds
    ? jobs.map((job) => ({
        ...job,
        hasCapture: capturedJobIds.has(job.id),
      }))
    : jobs;

  return jobsWithLedger.filter((job) => {
    if (filters?.attention && !isAttentionJob(job, now)) {
      return false;
    }

    if (filters?.failureQueue && !FAILURE_QUEUE_STATUSES.has(job.status)) {
      return false;
    }

    if (typeof filters?.isTest === "boolean" && job.isTest !== filters.isTest) {
      return false;
    }

    if (filters?.status && job.status !== filters.status) {
      return false;
    }

    if (filters?.billingMode && job.billingMode !== filters.billingMode) {
      return false;
    }

    if (filters?.presetId && job.presetId !== filters.presetId) {
      return false;
    }

    if (normalizedQuery) {
      const matchesQuery =
        job.id.toLowerCase().includes(normalizedQuery) ||
        job.userId.toLowerCase().includes(normalizedQuery);

      if (!matchesQuery) {
        return false;
      }
    }

    return true;
  });
}
