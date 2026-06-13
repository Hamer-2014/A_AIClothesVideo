import { and, eq, isNull } from "drizzle-orm";

import { createDownloadSignedUrl } from "@/lib/storage/presign";
import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";

export interface JobCoverRecord {
  id: string;
  userId: string;
  status: string;
  coverKey: string | null;
}

export interface JobCoverStore {
  findJob(input: {
    jobId: string;
    userId: string;
  }): Promise<JobCoverRecord | null>;
}

export function createInMemoryJobCoverStore(
  jobs: JobCoverRecord[],
): JobCoverStore {
  return {
    async findJob({ jobId, userId }) {
      return jobs.find((job) => job.id === jobId && job.userId === userId) ?? null;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobCoverStore(
  db: DbClient = getDb(),
): JobCoverStore {
  return {
    async findJob({ jobId, userId }) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          coverKey: videoJobs.coverKey,
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

      return (job as JobCoverRecord | undefined) ?? null;
    },
  };
}

export async function createJobCoverUrl({
  store,
  jobId,
  userId,
}: {
  store: JobCoverStore;
  jobId: string;
  userId: string;
}) {
  const job = await store.findJob({ jobId, userId });
  if (!job) {
    throw new Error("Video job not found for user.");
  }

  if (job.status !== "deliverable" || !job.coverKey) {
    throw new Error("Video job cover is not available.");
  }

  const expiresIn = 900;
  const url = await createDownloadSignedUrl({
    key: job.coverKey,
    expiresIn,
  });

  return {
    url,
    expiresIn,
  };
}
