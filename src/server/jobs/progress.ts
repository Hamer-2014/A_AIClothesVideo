import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { postQaResults, stitchJobs, videoJobs, videoSegments } from "@/lib/db/schema";

export interface JobProgressRecord {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  lastError: string | null;
  failureReason: string | null;
  finalVideoKey: string | null;
  coverKey: string | null;
}

export interface SegmentProgressRecord {
  videoJobId: string;
  status: string;
}

export interface RelatedStatusRecord {
  videoJobId: string;
  status: string;
}

export interface JobProgressStore {
  findJob(input: { jobId: string; userId: string }): Promise<JobProgressRecord | null>;
  listSegments(jobId: string): Promise<SegmentProgressRecord[]>;
  findLatestStitchJob(jobId: string): Promise<RelatedStatusRecord | null>;
  findLatestPostQaResult(jobId: string): Promise<RelatedStatusRecord | null>;
}

function phaseForStatus(status: string) {
  if (status.endsWith("_failed") || status.startsWith("failed")) {
    return "failed";
  }
  if (status.startsWith("asset_") || status.startsWith("lite_")) {
    return "asset_analysis";
  }
  if (status.startsWith("storyboard")) {
    return "storyboard";
  }
  if (status.startsWith("prompt_") || status === "credits_reserved") {
    return "pre_generation";
  }
  if (status === "segments_queued" || status.startsWith("segment")) {
    return "generation";
  }
  if (status.startsWith("stitch") || status === "stitched") {
    return "stitching";
  }
  if (status.startsWith("post_qa")) {
    return "post_qa";
  }
  if (status === "deliverable") {
    return "deliverable";
  }
  return "setup";
}

function countSegments(segments: SegmentProgressRecord[]) {
  return {
    total: segments.length,
    queued: segments.filter((segment) => segment.status === "queued").length,
    generating: segments.filter((segment) => segment.status === "generating").length,
    succeeded: segments.filter((segment) => segment.status === "succeeded").length,
    failed: segments.filter((segment) => segment.status === "failed").length,
  };
}

export async function getVideoJobProgress({
  store,
  jobId,
  userId,
}: {
  store: JobProgressStore;
  jobId: string;
  userId: string;
}) {
  const job = await store.findJob({ jobId, userId });
  if (!job) {
    return null;
  }

  const [segments, stitchJob, postQaResult] = await Promise.all([
    store.listSegments(jobId),
    store.findLatestStitchJob(jobId),
    store.findLatestPostQaResult(jobId),
  ]);

  return {
    jobId: job.id,
    status: job.status,
    userVisibleStatus: job.userVisibleStatus,
    message: job.failureReason ?? job.lastError,
    phase: phaseForStatus(job.status),
    segmentProgress: countSegments(segments),
    stitching: { status: stitchJob?.status ?? "not_started" },
    postQa: { status: postQaResult?.status ?? "not_started" },
    downloadReady: job.status === "deliverable" && Boolean(job.finalVideoKey),
    finalVideoKey: job.finalVideoKey,
    coverKey: job.coverKey,
  };
}

export function createInMemoryJobProgressStore({
  jobs,
  segments,
  stitchJobs,
  postQaResults,
}: {
  jobs: JobProgressRecord[];
  segments: SegmentProgressRecord[];
  stitchJobs: RelatedStatusRecord[];
  postQaResults: RelatedStatusRecord[];
}): JobProgressStore {
  return {
    async findJob({ jobId, userId }) {
      const job = jobs.find((item) => item.id === jobId && item.userId === userId);
      return job ? { ...job } : null;
    },
    async listSegments(jobId) {
      return segments
        .filter((segment) => segment.videoJobId === jobId)
        .map((segment) => ({ ...segment }));
    },
    async findLatestStitchJob(jobId) {
      const stitchJob = stitchJobs.find((item) => item.videoJobId === jobId);
      return stitchJob ? { ...stitchJob } : null;
    },
    async findLatestPostQaResult(jobId) {
      const result = postQaResults.find((item) => item.videoJobId === jobId);
      return result ? { ...result } : null;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleJobProgressStore(
  db: DbClient = getDb(),
): JobProgressStore {
  return {
    async findJob({ jobId, userId }) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          lastError: videoJobs.lastError,
          failureReason: videoJobs.failureReason,
          finalVideoKey: videoJobs.finalVideoKey,
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

      return (job as JobProgressRecord | undefined) ?? null;
    },
    async listSegments(jobId) {
      return db
        .select({
          videoJobId: videoSegments.videoJobId,
          status: videoSegments.status,
        })
        .from(videoSegments)
        .where(eq(videoSegments.videoJobId, jobId));
    },
    async findLatestStitchJob(jobId) {
      const [stitchJob] = await db
        .select({
          videoJobId: stitchJobs.videoJobId,
          status: stitchJobs.status,
        })
        .from(stitchJobs)
        .where(eq(stitchJobs.videoJobId, jobId))
        .orderBy(desc(stitchJobs.createdAt))
        .limit(1);

      return (stitchJob as RelatedStatusRecord | undefined) ?? null;
    },
    async findLatestPostQaResult(jobId) {
      const [result] = await db
        .select({
          videoJobId: postQaResults.videoJobId,
          status: postQaResults.status,
        })
        .from(postQaResults)
        .where(eq(postQaResults.videoJobId, jobId))
        .orderBy(desc(postQaResults.createdAt))
        .limit(1);

      return (result as RelatedStatusRecord | undefined) ?? null;
    },
  };
}
