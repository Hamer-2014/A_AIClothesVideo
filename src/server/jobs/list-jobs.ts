import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";

export interface UserJobListItem {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  creditCost: number;
  finalVideoKey: string | null;
  coverKey: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserJobListStore {
  listJobsByUser(userId: string): Promise<UserJobListItem[]>;
}

export function createInMemoryUserJobListStore(
  jobs: UserJobListItem[],
): UserJobListStore {
  return {
    async listJobsByUser(userId) {
      return jobs
        .filter((job) => job.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((job) => ({ ...job }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleUserJobListStore(
  db: DbClient = getDb(),
): UserJobListStore {
  return {
    async listJobsByUser(userId) {
      return db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          creditCost: videoJobs.creditCost,
          finalVideoKey: videoJobs.finalVideoKey,
          coverKey: videoJobs.coverKey,
          failureReason: videoJobs.failureReason,
          createdAt: videoJobs.createdAt,
          updatedAt: videoJobs.updatedAt,
        })
        .from(videoJobs)
        .where(
          and(eq(videoJobs.userId, userId), isNull(videoJobs.deletedAt)),
        )
        .orderBy(desc(videoJobs.createdAt));
    },
  };
}

export async function listUserJobs({
  store,
  userId,
}: {
  store: UserJobListStore;
  userId: string;
}) {
  return store.listJobsByUser(userId);
}
