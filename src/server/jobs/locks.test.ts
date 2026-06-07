import { describe, expect, it } from "vitest";

import { acquireNextJobLock, createInMemoryJobLockStore } from "./locks";

const userId = "22222222-2222-4222-8222-222222222222";

describe("job locks", () => {
  it("locks the oldest eligible unlocked job", async () => {
    const now = new Date("2026-06-07T00:00:00.000Z");
    const store = createInMemoryJobLockStore([
      {
        id: "job-newer",
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        createdAt: new Date("2026-06-07T00:02:00.000Z"),
      },
      {
        id: "job-older",
        userId,
        status: "lite_check_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        createdAt: new Date("2026-06-07T00:01:00.000Z"),
      },
    ]);

    const job = await acquireNextJobLock({
      store,
      workerId: "worker-1",
      eligibleStatuses: ["lite_check_queued", "asset_analysis_queued"],
      now,
      lockMs: 60_000,
    });

    expect(job?.id).toBe("job-older");
    expect(job?.lockedBy).toBe("worker-1");
    expect(job?.lockedUntil?.toISOString()).toBe("2026-06-07T00:01:00.000Z");
  });

  it("does not lock a job held by another active worker", async () => {
    const now = new Date("2026-06-07T00:00:00.000Z");
    const store = createInMemoryJobLockStore([
      {
        id: "job-locked",
        userId,
        status: "lite_check_queued",
        lockedBy: "worker-other",
        lockedUntil: new Date("2026-06-07T00:01:00.000Z"),
        attemptCount: 0,
        lastError: null,
        createdAt: now,
      },
    ]);

    const job = await acquireNextJobLock({
      store,
      workerId: "worker-1",
      eligibleStatuses: ["lite_check_queued"],
      now,
    });

    expect(job).toBeNull();
  });

  it("recovers an expired lock and increments attempts", async () => {
    const now = new Date("2026-06-07T00:02:00.000Z");
    const store = createInMemoryJobLockStore([
      {
        id: "job-expired",
        userId,
        status: "asset_analysis_queued",
        lockedBy: "worker-old",
        lockedUntil: new Date("2026-06-07T00:01:00.000Z"),
        attemptCount: 2,
        lastError: null,
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ]);

    const job = await acquireNextJobLock({
      store,
      workerId: "worker-1",
      eligibleStatuses: ["asset_analysis_queued"],
      now,
      lockMs: 120_000,
    });

    expect(job).toMatchObject({
      id: "job-expired",
      lockedBy: "worker-1",
      attemptCount: 3,
    });
    expect(job?.lockedUntil?.toISOString()).toBe("2026-06-07T00:04:00.000Z");
  });
});
