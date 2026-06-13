import type { JobLockStore, LockableJobRecord } from "@/server/jobs/locks";
import { acquireNextJobLock } from "@/server/jobs/locks";
import type { JobStore, JobStatus } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";

export interface WorkerTickHandlers {
  liteCheck: (job: LockableJobRecord) => Promise<void>;
  assetAnalysis: (job: LockableJobRecord) => Promise<void>;
}

const eligibleStatuses: JobStatus[] = [
  "lite_check_queued",
  "asset_analysis_queued",
];

function runningStatusFor(status: JobStatus): JobStatus {
  switch (status) {
    case "lite_check_queued":
      return "lite_check_running";
    case "asset_analysis_queued":
      return "asset_analysis_running";
    default:
      throw new Error(`Worker cannot run status: ${status}.`);
  }
}

function passedStatusFor(status: JobStatus): JobStatus {
  switch (status) {
    case "lite_check_queued":
      return "lite_check_passed";
    case "asset_analysis_queued":
      return "asset_analysis_passed";
    default:
      throw new Error(`Worker cannot pass status: ${status}.`);
  }
}

function failedStatusFor(status: JobStatus): JobStatus {
  switch (status) {
    case "lite_check_queued":
      return "lite_check_failed";
    case "asset_analysis_queued":
      return "asset_analysis_failed";
    default:
      throw new Error(`Worker cannot fail status: ${status}.`);
  }
}

function visibleStatusForPassed(status: JobStatus) {
  switch (status) {
    case "asset_analysis_queued":
      return "assets_ready";
    case "lite_check_queued":
      return "lite_check_passed";
  }
}

function handlerFor(status: JobStatus, handlers: WorkerTickHandlers) {
  switch (status) {
    case "lite_check_queued":
      return handlers.liteCheck;
    case "asset_analysis_queued":
      return handlers.assetAnalysis;
    default:
      throw new Error(`Worker has no handler for status: ${status}.`);
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown worker error.";
}

export async function runWorkerTick({
  workerId,
  limit = 5,
  lockStore,
  jobStore,
  handlers,
  now = new Date(),
  eligibleJobStatuses = eligibleStatuses,
}: {
  workerId: string;
  limit?: number;
  lockStore: JobLockStore;
  jobStore: JobStore;
  handlers: WorkerTickHandlers;
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
    await transitionJobStatus({
      store: jobStore,
      jobId: job.id,
      toStatus: runningStatusFor(job.status),
      reason: "worker_tick",
      eventSnapshot: { workerId },
    });

    try {
      await handlerFor(job.status, handlers)(job);
      await transitionJobStatus({
        store: jobStore,
        jobId: job.id,
        toStatus: passedStatusFor(job.status),
        reason: "worker_tick_succeeded",
        userVisibleStatus: visibleStatusForPassed(job.status),
        clearLock: true,
      });
      succeeded += 1;
    } catch (error) {
      await transitionJobStatus({
        store: jobStore,
        jobId: job.id,
        toStatus: failedStatusFor(job.status),
        reason: "worker_tick_failed",
        errorMessage: errorMessage(error),
        clearLock: true,
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
