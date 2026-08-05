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
    const retryJob = {
      ...job("job-1", "post_qa_queued"),
      nextRetryAt: new Date("2026-06-08T00:00:00.000Z"),
    };
    const lockStore = createInMemoryJobLockStore([retryJob]);
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
      resumePostQa: async () => {
        throw new Error("must not resume a queued job");
      },
    });

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(checked).toEqual(["job-1"]);
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "deliverable",
      lockedBy: null,
      lockedUntil: null,
      nextRetryAt: null,
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
      resumePostQa: async () => {
        throw new Error("must not resume a queued job");
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

  it("resumes persisted Post-QA outcomes without rerunning visual QA", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-passed", "post_qa_passed"),
      job("job-failed", "post_qa_failed"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const resumed: string[] = [];

    const result = await runPostQaWorkerTick({
      workerId: "worker-1",
      lockStore,
      jobStore,
      checkPostQa: async () => {
        throw new Error("must not rerun visual QA");
      },
      resumePostQa: async (lockedJob) => {
        resumed.push(lockedJob.id);
        await jobStore.updateJobStatus(lockedJob.id, {
          status:
            lockedJob.status === "post_qa_passed"
              ? "deliverable"
              : "failed_released",
          clearLock: true,
        });
      },
    });

    expect(result).toEqual({ processed: 2, succeeded: 2, failed: 0 });
    expect(resumed).toEqual(["job-passed", "job-failed"]);
  });

  it("keeps an interrupted resolution recoverable when resume fails", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-passed", "post_qa_passed"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());

    const result = await runPostQaWorkerTick({
      workerId: "worker-1",
      limit: 1,
      lockStore,
      jobStore,
      checkPostQa: async () => {
        throw new Error("must not rerun visual QA");
      },
      resumePostQa: async () => {
        throw new Error("ledger store unavailable");
      },
      now: new Date("2026-08-05T00:00:00.000Z"),
    });

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "post_qa_passed",
      lastError: "ledger store unavailable",
      lockedBy: null,
      lockedUntil: null,
    });
  });

  it("uses the latest job state when a queued handler fails after settlement", async () => {
    const lockStore = createInMemoryJobLockStore([
      job("job-passed", "post_qa_queued"),
    ]);
    const jobStore = createInMemoryJobStore(lockStore.listJobs());
    const now = new Date("2026-08-05T00:00:00.000Z");

    const result = await runPostQaWorkerTick({
      workerId: "worker-1",
      limit: 1,
      lockStore,
      jobStore,
      checkPostQa: async (lockedJob) => {
        await jobStore.updateJobStatus(lockedJob.id, {
          status: "post_qa_passed",
        });
        throw new Error("terminal state write failed");
      },
      resumePostQa: async () => {
        throw new Error("must not use resume handler in the same attempt");
      },
      now,
    });

    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "post_qa_passed",
      lastError: "terminal state write failed",
      nextRetryAt: new Date("2026-08-05T00:00:30.000Z"),
      lockedBy: null,
      lockedUntil: null,
    });
  });
});
