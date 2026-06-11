import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";

const ATTENTION_FAILURE_STATUSES = new Set([
  "segment_failed",
  "stitching_failed",
  "post_qa_failed",
  "failed_released",
  "failed_refunded",
  "prompt_moderation_blocked",
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
  creditCost: number;
  failureReason: string | null;
  isTest: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminJobListFilters {
  attention?: boolean;
  isTest?: boolean;
  status?: string;
  query?: string;
}

export interface AdminJobListStore {
  listJobs(): Promise<AdminJobListItem[]>;
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

export function isAttentionJob(job: AdminJobListItem, now: Date) {
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
  filters,
  now = new Date(),
}: {
  store: AdminJobListStore;
  filters?: AdminJobListFilters;
  now?: Date;
}) {
  const jobs = await store.listJobs();
  const normalizedQuery = filters?.query?.trim().toLowerCase();

  return jobs.filter((job) => {
    if (filters?.attention && !isAttentionJob(job, now)) {
      return false;
    }

    if (typeof filters?.isTest === "boolean" && job.isTest !== filters.isTest) {
      return false;
    }

    if (filters?.status && job.status !== filters.status) {
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
