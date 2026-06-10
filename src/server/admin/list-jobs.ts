import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";

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
        })
        .from(videoJobs)
        .orderBy(desc(videoJobs.createdAt));
    },
  };
}

export async function listAdminJobs({
  store,
}: {
  store: AdminJobListStore;
}) {
  return store.listJobs();
}
