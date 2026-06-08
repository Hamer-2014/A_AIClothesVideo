import type { JobLockStore, LockableJobRecord } from "@/server/jobs/locks";
import { acquireNextJobLock } from "@/server/jobs/locks";
import type { JobStore, JobStatus } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";

export interface PostQaWorkerTickHandlers {
  checkPostQa: (job: LockableJobRecord) => Promise<void>;
}

const eligibleStatuses: JobStatus[] = ["post_qa_queued"];

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown post QA worker error.";
}

export async function runPostQaWorkerTick({
  workerId,
  limit = 5,
  lockStore,
  jobStore,
  checkPostQa,
  now = new Date(),
  eligibleJobStatuses = eligibleStatuses,
}: {
  workerId: string;
  limit?: number;
  lockStore: JobLockStore;
  jobStore: JobStore;
  checkPostQa: PostQaWorkerTickHandlers["checkPostQa"];
  now?: Date;
  eligibleJobStatuses?: JobStatus[];
}) {
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (let index = 0; index < limit; index += 1) {
    const job = await acquireNextJobLock({
      store: lockStore,
      workerId,
      eligibleStatuses: eligibleJobStatuses,
      now,
    });

    if (!job) {
      break;
    }

    const currentJob = await jobStore.findJob(job.id);
    if (!currentJob || currentJob.status !== job.status) {
      continue;
    }

    processed += 1;

    try {
      await transitionJobStatus({
        store: jobStore,
        jobId: job.id,
        toStatus: "post_qa_running",
        reason: "post_qa_worker_tick",
        eventSnapshot: { workerId },
      });
      await checkPostQa(job);
      const afterHandler = await jobStore.findJob(job.id);
      if (afterHandler?.lockedBy || afterHandler?.lockedUntil) {
        await jobStore.updateJobStatus(job.id, {
          status: afterHandler.status,
          clearLock: true,
        });
      }
      succeeded += 1;
    } catch (error) {
      await transitionJobStatus({
        store: jobStore,
        jobId: job.id,
        toStatus: "post_qa_failed",
        reason: "post_qa_worker_tick_failed",
        errorMessage: errorMessage(error),
        clearLock: true,
        eventSnapshot: { workerId },
      });
      failed += 1;
    }
  }

  return {
    processed,
    succeeded,
    failed,
  };
}
