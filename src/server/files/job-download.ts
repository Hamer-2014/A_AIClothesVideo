import { and, eq, isNull } from "drizzle-orm";

import { createDownloadSignedUrl } from "@/lib/storage/presign";
import { getDb } from "@/lib/db/client";
import { videoJobs } from "@/lib/db/schema";

export interface JobDownloadRecord {
  id: string;
  userId: string;
  status: string;
  finalVideoKey: string | null;
}

export interface JobDownloadStore {
  findJob(input: {
    jobId: string;
    userId: string;
  }): Promise<JobDownloadRecord | null>;
}

export function createInMemoryJobDownloadStore(
  jobs: JobDownloadRecord[],
): JobDownloadStore {
  return {
    async findJob({ jobId, userId }) {
      return jobs.find((job) => job.id === jobId && job.userId === userId) ?? null;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobDownloadStore(
  db: DbClient = getDb(),
): JobDownloadStore {
  return {
    async findJob({ jobId, userId }) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          finalVideoKey: videoJobs.finalVideoKey,
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

      return (job as JobDownloadRecord | undefined) ?? null;
    },
  };
}

export async function createJobDownloadUrl({
  store,
  jobId,
  userId,
}: {
  store: JobDownloadStore;
  jobId: string;
  userId: string;
}) {
  const job = await store.findJob({ jobId, userId });
  if (!job) {
    throw new Error("Video job not found for user.");
  }

  if (job.status !== "deliverable" || !job.finalVideoKey) {
    throw new Error("Video job is not downloadable.");
  }

  const expiresIn = 900;
  const url = await createDownloadSignedUrl({
    key: job.finalVideoKey,
    expiresIn,
  });

  return {
    url,
    expiresIn,
  };
}
