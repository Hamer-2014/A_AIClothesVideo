import type { JobLockStore, LockableJobRecord } from "@/server/jobs/locks";
import { acquireNextJobLock } from "@/server/jobs/locks";
import type { JobStore, JobStatus } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";

export interface GenerationWorkerTickHandlers {
  submitSegments: (job: LockableJobRecord) => Promise<void>;
  pollSegments: (job: LockableJobRecord) => Promise<void>;
  createStitchJob: (job: LockableJobRecord) => Promise<void>;
}

const eligibleStatuses: JobStatus[] = [
  "segments_queued",
  "segment_generating",
  "segment_succeeded",
];

function handlerFor(status: JobStatus, handlers: GenerationWorkerTickHandlers) {
  switch (status) {
    case "segments_queued":
      return handlers.submitSegments;
    case "segment_generating":
      return handlers.pollSegments;
    case "segment_succeeded":
      return handlers.createStitchJob;
    default:
      throw new Error(`Generation worker has no handler for status: ${status}.`);
  }
}

function statusAfterSuccess(status: JobStatus): JobStatus | null {
  switch (status) {
    case "segments_queued":
      return "segment_generating";
    case "segment_succeeded":
      return "stitching_queued";
    default:
      return null;
  }
}

function statusAfterFailure(status: JobStatus): JobStatus {
  switch (status) {
    case "segments_queued":
    case "segment_generating":
      return "segment_failed";
    case "segment_succeeded":
      return "post_qa_failed";
    default:
      return "segment_failed";
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown generation worker error.";
}

export async function runGenerationWorkerTick({
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
  handlers: GenerationWorkerTickHandlers;
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
      await handlerFor(job.status, handlers)(job);
      const afterHandler = await jobStore.findJob(job.id);
      const nextStatus = statusAfterSuccess(job.status);
      if (afterHandler?.status === job.status && nextStatus) {
        await transitionJobStatus({
          store: jobStore,
          jobId: job.id,
          toStatus: nextStatus,
          reason: "generation_worker_tick_succeeded",
          clearLock: true,
          eventSnapshot: { workerId },
        });
      } else {
        await jobStore.updateJobStatus(job.id, {
          status: afterHandler?.status ?? job.status,
          clearLock: true,
        });
      }
      succeeded += 1;
    } catch (error) {
      const afterHandler = await jobStore.findJob(job.id);
      if (afterHandler?.status === job.status) {
        await transitionJobStatus({
          store: jobStore,
          jobId: job.id,
          toStatus: statusAfterFailure(job.status),
          reason: "generation_worker_tick_failed",
          errorMessage: errorMessage(error),
          clearLock: true,
          eventSnapshot: { workerId },
        });
      } else {
        await jobStore.updateJobStatus(job.id, {
          status: afterHandler?.status ?? job.status,
          lastError: errorMessage(error),
          clearLock: true,
        });
      }
      failed += 1;
    }
  }

  return {
    processed,
    succeeded,
    failed,
  };
}
