import { describe, expect, it } from "vitest";

import {
  createInMemoryJobLockStore,
  type LockableJobRecord,
} from "@/server/jobs/locks";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { runGenerationWorkerTick } from "./generation-tick";

const userId = "22222222-2222-4222-8222-222222222222";

function job(id: string, status: LockableJobRecord["status"]): LockableJobRecord {
  return {
    id,
    userId,
    status,
    lockedBy: null,
    lockedUntil: null,
    attemptCount: 0,
    lastError: null,
    createdAt: new Date("2026-06-08T00:00:00.000Z"),
  };
}

describe("generation worker tick", () => {
  it("submits queued video segments", async () => {
    const lockStore = createInMemoryJobLockStore([job("job-1", "segments_queued")]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const submitted: string[] = [];

    const result = await runGenerationWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      handlers: {
        submitSegments: async (lockedJob) => {
          submitted.push(lockedJob.id);
        },
        pollSegments: async () => undefined,
        createStitchJob: async () => undefined,
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(submitted).toEqual(["job-1"]);
    expect(jobStore.listJobs()[0]?.status).toBe("segment_generating");
  });

  it("polls generating video segments", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-1", "segment_generating"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const polled: string[] = [];

    const result = await runGenerationWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      handlers: {
        submitSegments: async () => undefined,
        pollSegments: async (lockedJob) => {
          polled.push(lockedJob.id);
        },
        createStitchJob: async () => undefined,
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(polled).toEqual(["job-1"]);
  });

  it("creates stitch jobs for completed segments", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-1", "segment_succeeded"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const stitched: string[] = [];

    const result = await runGenerationWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      handlers: {
        submitSegments: async () => undefined,
        pollSegments: async () => undefined,
        createStitchJob: async (lockedJob) => {
          stitched.push(lockedJob.id);
        },
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(stitched).toEqual(["job-1"]);
    expect(jobStore.listJobs()[0]?.status).toBe("stitching_queued");
  });

  it("does not force a failure transition when a handler already moved the job", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-1", "segment_succeeded"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());

    const result = await runGenerationWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      handlers: {
        submitSegments: async () => undefined,
        pollSegments: async () => undefined,
        createStitchJob: async (lockedJob) => {
          await jobStore.updateJobStatus(lockedJob.id, {
            status: "stitching_queued",
          });
          throw new Error("Cloud Run unavailable");
        },
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "stitching_queued",
      lockedBy: null,
      lockedUntil: null,
      lastError: "Cloud Run unavailable",
    });
  });

  it("records the submission error on segments_queued jobs without forcing an invalid failure transition", async () => {
    const lockStore = createInMemoryJobLockStore([job("job-1", "segments_queued")]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());

    const result = await runGenerationWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      handlers: {
        submitSegments: async () => {
          throw new Error("EvoLink video generation failed with status 404.");
        },
        pollSegments: async () => undefined,
        createStitchJob: async () => undefined,
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "segments_queued",
      lockedBy: null,
      lockedUntil: null,
      lastError: "EvoLink video generation failed with status 404.",
    });
  });
});
