import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import {
  captureReservedCredits,
  releaseReservedCredits,
} from "@/lib/credits/ledger";
import type { CreditLedgerStore, CreditLedgerType } from "@/lib/credits/types";
import { getDb } from "@/lib/db/client";
import { postQaResults, videoJobs } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { postQaModeValues, postQaStatusValues } from "@/lib/db/schema/jobs";
import {
  recordFunnelEventSafely,
  type FunnelEventStore,
} from "@/server/analytics/funnel-events";
import {
  createDrizzleJobStore,
  type JobStore,
  transitionJobStatus,
} from "@/server/jobs/state-machine";

type PostQaMode = (typeof postQaModeValues)[number];
type PostQaStatus = (typeof postQaStatusValues)[number];

export interface PostQaJobRecord {
  id: string;
  userId: string;
  status: string;
  creditCost: number;
  reservedLedgerId: string | null;
}

export interface PostQaResultRecord {
  id: string;
  videoJobId: string;
  stitchJobId: string;
  status: PostQaStatus;
  mode: PostQaMode;
  frameKeys: JsonValue;
  resultJson: JsonValue | null;
  failureCategory: string | null;
  providerCallLogId: string | null;
  isTest: boolean;
  lockedBy: string | null;
  lockedUntil: Date | null;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostQaStore {
  findJob(jobId: string): Promise<PostQaJobRecord | null>;
  createResult(input: {
    videoJobId: string;
    stitchJobId?: string | null;
    status: PostQaStatus;
    mode: PostQaMode;
    frameKeys: string[];
    resultJson?: JsonValue | null;
    failureCategory?: string | null;
  }): Promise<PostQaResultRecord>;
}

export async function resolvePostQaResult({
  jobStore = createDrizzleJobStore(),
  postQaStore,
  creditStore = createDrizzleCreditLedgerStore(),
  jobId,
  status,
  mode,
  frameKeys,
  resultJson,
  failureCategory,
  funnelEventStore,
}: {
  jobStore?: JobStore;
  postQaStore: PostQaStore;
  creditStore?: CreditLedgerStore;
  jobId: string;
  status: "passed" | "failed";
  mode: PostQaMode;
  frameKeys: string[];
  resultJson?: JsonValue | null;
  failureCategory?: string | null;
  funnelEventStore?: FunnelEventStore;
}) {
  const job = await postQaStore.findJob(jobId);
  if (!job) {
    throw new Error("Video job not found.");
  }

  const currentJob = await jobStore.findJob(jobId);
  const currentStatus = currentJob?.status ?? job.status;

  if (currentStatus === "deliverable" && status === "passed") {
    return {
      jobId,
      status: "deliverable" as const,
      ledgerType: null,
    };
  }

  if (
    (currentStatus === "failed_released" || currentStatus === "failed_refunded") &&
    status === "failed"
  ) {
    return {
      jobId,
      status: "failed_released" as const,
      ledgerType: null,
    };
  }

  await postQaStore.createResult({
    videoJobId: jobId,
    stitchJobId: null,
    status,
    mode,
    frameKeys,
    resultJson: resultJson ?? null,
    failureCategory: failureCategory ?? null,
  });

  const failureMessage = failureCategory ?? "post_qa_failed";

  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: status === "passed" ? "post_qa_passed" : "post_qa_failed",
    reason: status === "passed" ? "post_qa_passed" : "post_qa_failed",
    errorMessage: status === "failed" ? failureMessage : null,
    failureReason: status === "failed" ? failureMessage : null,
    userVisibleStatus: status === "failed" ? "failed" : "quality_checking",
    eventSnapshot: {
      mode,
      frameKeys,
      failureCategory: failureCategory ?? null,
    },
  });

  let ledgerType: CreditLedgerType | null = null;
  if (status === "passed") {
    if (job.creditCost > 0) {
      await captureReservedCredits({
        store: creditStore,
        userId: job.userId,
        amount: job.creditCost,
        reason: "capture credits after post QA passed",
        idempotencyKey: `capture:job:${jobId}`,
        relatedJobId: jobId,
        metadata: { reservedLedgerId: job.reservedLedgerId },
      });
      ledgerType = "capture";
    }
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "deliverable",
      reason: "video_deliverable",
      userVisibleStatus: "downloadable",
    });
    if (funnelEventStore) {
      await recordFunnelEventSafely({
        store: funnelEventStore,
        eventName: "generation_deliverable",
        source: "server",
        userId: job.userId,
        metadata: {
          jobId,
          status: "deliverable",
        },
      });
    }
  } else {
    if (job.creditCost > 0) {
      await releaseReservedCredits({
        store: creditStore,
        userId: job.userId,
        amount: job.creditCost,
        reason: "release credits after post QA failed",
        idempotencyKey: `release:job:${jobId}:post_qa_failed`,
        relatedJobId: jobId,
        metadata: {
          reservedLedgerId: job.reservedLedgerId,
          failureCategory: failureCategory ?? null,
        },
      });
      ledgerType = "release";
    }
    await transitionJobStatus({
      store: jobStore,
      jobId,
      toStatus: "failed_released",
      reason: "post_qa_failed_released",
      errorMessage: failureMessage,
      failureReason: failureMessage,
      userVisibleStatus: "failed",
      eventSnapshot: { failureCategory: failureCategory ?? null },
    });
    if (funnelEventStore) {
      await recordFunnelEventSafely({
        store: funnelEventStore,
        eventName: "generation_failed",
        source: "server",
        userId: job.userId,
        metadata: {
          jobId,
          status: "failed_released",
          reasonCategory: failureCategory ?? "post_qa_failed",
        },
      });
    }
  }

  return {
    jobId,
    status: status === "passed" ? "deliverable" : "failed_released",
    ledgerType,
  };
}

export function createInMemoryPostQaStore({
  jobs,
}: {
  jobs: PostQaJobRecord[];
}): PostQaStore & {
  listResults: () => PostQaResultRecord[];
} {
  const jobRecords = new Map(jobs.map((job) => [job.id, { ...job }]));
  const results: PostQaResultRecord[] = [];

  return {
    async findJob(jobId) {
      const job = jobRecords.get(jobId);
      return job ? { ...job } : null;
    },
    async createResult(input) {
      const now = new Date();
      const result: PostQaResultRecord = {
        id: randomUUID(),
        videoJobId: input.videoJobId,
        stitchJobId: input.stitchJobId ?? "00000000-0000-4000-8000-000000000000",
        status: input.status,
        mode: input.mode,
        frameKeys: input.frameKeys,
        resultJson: input.resultJson ?? null,
        failureCategory: input.failureCategory ?? null,
        providerCallLogId: null,
        isTest: false,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: now,
        updatedAt: now,
      };
      results.push(result);
      return { ...result };
    },
    listResults() {
      return results.map((result) => ({ ...result }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzlePostQaStore(db: DbClient = getDb()): PostQaStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          creditCost: videoJobs.creditCost,
          reservedLedgerId: videoJobs.reservedLedgerId,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as PostQaJobRecord | undefined) ?? null;
    },
    async createResult(input) {
      const [result] = await db
        .insert(postQaResults)
        .values({
          videoJobId: input.videoJobId,
          stitchJobId:
            input.stitchJobId ?? "00000000-0000-4000-8000-000000000000",
          status: input.status,
          mode: input.mode,
          frameKeys: input.frameKeys,
          resultJson: input.resultJson ?? null,
          failureCategory: input.failureCategory ?? null,
        })
        .returning();

      if (!result) {
        throw new Error("Failed to create post QA result.");
      }

      return result as PostQaResultRecord;
    },
  };
}
