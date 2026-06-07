import { describe, expect, it } from "vitest";

import { createInMemoryJobLockStore } from "@/server/jobs/locks";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { runWorkerTick } from "./tick";

const userId = "22222222-2222-4222-8222-222222222222";

function queuedJob(id: string, status: "lite_check_queued" | "asset_analysis_queued") {
  return {
    id,
    userId,
    status,
    lockedBy: null,
    lockedUntil: null,
    attemptCount: 0,
    lastError: null,
    createdAt: new Date("2026-06-07T00:00:00.000Z"),
  };
}

describe("worker tick", () => {
  it("processes eligible analysis jobs up to the limit", async () => {
    const lockStore = createInMemoryJobLockStore([
      queuedJob("job-1", "lite_check_queued"),
      queuedJob("job-2", "asset_analysis_queued"),
      queuedJob("job-3", "asset_analysis_queued"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const handled: string[] = [];

    const result = await runWorkerTick({
      workerId: "worker-1",
      limit: 2,
      lockStore,
      jobStore,
      handlers: {
        liteCheck: async (job) => {
          handled.push(`lite:${job.id}`);
        },
        assetAnalysis: async (job) => {
          handled.push(`analysis:${job.id}`);
        },
      },
      now: new Date("2026-06-07T00:01:00.000Z"),
    });

    expect(result).toEqual({
      processed: 2,
      succeeded: 2,
      failed: 0,
    });
    expect(handled).toEqual(["lite:job-1", "analysis:job-2"]);
    expect(jobStore.listJobs().find((job) => job.id === "job-1")?.status).toBe(
      "lite_check_passed",
    );
    expect(jobStore.listJobs().find((job) => job.id === "job-2")?.status).toBe(
      "asset_analysis_passed",
    );
    expect(jobStore.listJobs().find((job) => job.id === "job-3")?.status).toBe(
      "asset_analysis_queued",
    );
  });

  it("marks a failed analysis job without stopping the whole tick", async () => {
    const lockStore = createInMemoryJobLockStore([
      queuedJob("job-1", "asset_analysis_queued"),
      queuedJob("job-2", "lite_check_queued"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());

    const result = await runWorkerTick({
      workerId: "worker-1",
      limit: 2,
      lockStore,
      jobStore,
      handlers: {
        liteCheck: async () => undefined,
        assetAnalysis: async () => {
          throw new Error("vision unavailable");
        },
      },
      now: new Date("2026-06-07T00:01:00.000Z"),
    });

    expect(result).toEqual({
      processed: 2,
      succeeded: 1,
      failed: 1,
    });
    expect(jobStore.listJobs().find((job) => job.id === "job-1")).toMatchObject({
      status: "asset_analysis_failed",
      lastError: "vision unavailable",
      lockedBy: null,
      lockedUntil: null,
    });
    expect(jobStore.listJobs().find((job) => job.id === "job-2")?.status).toBe(
      "lite_check_passed",
    );
  });

  it("does not reprocess a completed job after its original lock expires", async () => {
    const lockStore = createInMemoryJobLockStore([
      queuedJob("job-1", "asset_analysis_queued"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const handled: string[] = [];

    await runWorkerTick({
      workerId: "worker-1",
      limit: 1,
      lockStore,
      jobStore,
      handlers: {
        liteCheck: async () => undefined,
        assetAnalysis: async (job) => {
          handled.push(job.id);
        },
      },
      now: new Date("2026-06-07T00:01:00.000Z"),
    });
    const result = await runWorkerTick({
      workerId: "worker-1",
      limit: 1,
      lockStore,
      jobStore,
      handlers: {
        liteCheck: async () => undefined,
        assetAnalysis: async (job) => {
          handled.push(job.id);
        },
      },
      now: new Date("2026-06-07T00:03:00.000Z"),
    });

    expect(result.processed).toBe(0);
    expect(handled).toEqual(["job-1"]);
  });
});
