import { and, desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { stitchJobs, videoJobs } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { postQaModeValues } from "@/lib/db/schema/jobs";

export type PostQaMode = Exclude<(typeof postQaModeValues)[number], "off">;

export interface PostQaJobInput {
  jobId: string;
  userId: string;
  mode: PostQaMode;
  frameKeys: string[];
}

export interface PostQaJobRecord {
  id: string;
  userId: string;
  postQaMode: string;
}

export interface PostQaStitchJobRecord {
  id: string;
  videoJobId: string;
  status: string;
  frameKeys: JsonValue;
  createdAt: Date;
}

export interface PostQaJobInputStore {
  findJob(jobId: string): Promise<PostQaJobRecord | null>;
  findLatestSucceededStitchJob(
    jobId: string,
  ): Promise<PostQaStitchJobRecord | null>;
}

function asFrameKeys(value: JsonValue) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function asMode(value: string): PostQaMode {
  return value === "lite" || value === "strict" ? value : "standard";
}

export async function getPostQaJobInput({
  store,
  jobId,
}: {
  store: PostQaJobInputStore;
  jobId: string;
}): Promise<PostQaJobInput> {
  const job = await store.findJob(jobId);
  if (!job) {
    throw new Error("Video job not found.");
  }

  const stitchJob = await store.findLatestSucceededStitchJob(jobId);
  if (!stitchJob) {
    throw new Error("Succeeded stitch job not found.");
  }

  return {
    jobId,
    userId: job.userId,
    mode: asMode(job.postQaMode),
    frameKeys: asFrameKeys(stitchJob.frameKeys),
  };
}

export function createInMemoryPostQaJobStore({
  jobs,
  stitchJobs,
}: {
  jobs: PostQaJobRecord[];
  stitchJobs: PostQaStitchJobRecord[];
}): PostQaJobInputStore {
  return {
    async findJob(jobId) {
      const job = jobs.find((item) => item.id === jobId);
      return job ? { ...job } : null;
    },
    async findLatestSucceededStitchJob(jobId) {
      const stitchJob = [...stitchJobs]
        .filter((item) => item.videoJobId === jobId && item.status === "succeeded")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      return stitchJob ? { ...stitchJob } : null;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzlePostQaJobStore(
  db: DbClient = getDb(),
): PostQaJobInputStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          postQaMode: videoJobs.postQaMode,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as PostQaJobRecord | undefined) ?? null;
    },
    async findLatestSucceededStitchJob(jobId) {
      const [stitchJob] = await db
        .select({
          id: stitchJobs.id,
          videoJobId: stitchJobs.videoJobId,
          status: stitchJobs.status,
          frameKeys: stitchJobs.frameKeys,
          createdAt: stitchJobs.createdAt,
        })
        .from(stitchJobs)
        .where(
          and(
            eq(stitchJobs.videoJobId, jobId),
            eq(stitchJobs.status, "succeeded"),
          ),
        )
        .orderBy(desc(stitchJobs.createdAt))
        .limit(1);

      if (!stitchJob) {
        return null;
      }

      return stitchJob as PostQaStitchJobRecord;
    },
  };
}
