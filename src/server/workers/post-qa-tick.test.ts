import { describe, expect, it } from "vitest";

import {
  createInMemoryJobLockStore,
  type LockableJobRecord,
} from "@/server/jobs/locks";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import { runPostQaWorkerTick } from "./post-qa-tick";

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

describe("post QA worker tick", () => {
  it("runs QA checks for queued post-QA jobs", async () => {
    const lockStore = createInMemoryJobLockStore([job("job-1", "post_qa_queued")]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const checked: string[] = [];

    const result = await runPostQaWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      checkPostQa: async (lockedJob) => {
        checked.push(lockedJob.id);
        await jobStore.updateJobStatus(lockedJob.id, {
          status: "deliverable",
          clearLock: true,
        });
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(checked).toEqual(["job-1"]);
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "deliverable",
      lockedBy: null,
      lockedUntil: null,
    });
  });

  it("marks QA failures without leaving the job locked", async () => {
    const lockStore = createInMemoryJobLockStore([job("job-1", "post_qa_queued")]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());

    const result = await runPostQaWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      checkPostQa: async () => {
        throw new Error("qa crashed");
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "post_qa_failed",
      lastError: "qa crashed",
      lockedBy: null,
      lockedUntil: null,
    });
  });
});
