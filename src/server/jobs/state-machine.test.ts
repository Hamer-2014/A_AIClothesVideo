import { describe, expect, it } from "vitest";

import {
  createInMemoryJobStore,
  transitionJobStatus,
} from "./state-machine";

const jobId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

describe("job state machine", () => {
  it("transitions a job and records an audit event", async () => {
    const store = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "draft_uploaded",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    const job = await transitionJobStatus({
      store,
      jobId,
      toStatus: "lite_check_queued",
      reason: "upload_complete",
      actorType: "system",
      eventSnapshot: { source: "presign" },
    });

    expect(job.status).toBe("lite_check_queued");
    expect(store.listEvents()).toEqual([
      expect.objectContaining({
        videoJobId: jobId,
        fromStatus: "draft_uploaded",
        toStatus: "lite_check_queued",
        reason: "upload_complete",
        actorType: "system",
        eventSnapshot: { source: "presign" },
      }),
    ]);
  });

  it("rejects invalid status transitions", async () => {
    const store = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "draft_uploaded",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    await expect(
      transitionJobStatus({
        store,
        jobId,
        toStatus: "segments_queued",
        reason: "skip_analysis",
      }),
    ).rejects.toThrow(
      "Invalid job status transition: draft_uploaded -> segments_queued.",
    );

    expect(store.listEvents()).toHaveLength(0);
  });

  it("records failure status and error reason", async () => {
    const store = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_running",
        lockedBy: "worker-1",
        lockedUntil: new Date(Date.now() + 60_000),
        attemptCount: 1,
        lastError: null,
      },
    ]);

    const job = await transitionJobStatus({
      store,
      jobId,
      toStatus: "asset_analysis_failed",
      reason: "vision_provider_error",
      errorMessage: "Vision provider failed with status 400.",
    });

    expect(job.status).toBe("asset_analysis_failed");
    expect(job.lastError).toBe("Vision provider failed with status 400.");
    expect(store.listEvents()[0]).toMatchObject({
      fromStatus: "asset_analysis_running",
      toStatus: "asset_analysis_failed",
      reason: "vision_provider_error",
    });
  });

  it("touches the job updatedAt timestamp on every status transition", async () => {
    let capturedUpdatedAt: Date | undefined;
    const baseStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "draft_uploaded",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const store = {
      ...baseStore,
      async updateJobStatus(
        jobIdToUpdate: string,
        changes: Parameters<typeof baseStore.updateJobStatus>[1],
      ) {
        capturedUpdatedAt = changes.updatedAt;
        return baseStore.updateJobStatus(jobIdToUpdate, changes);
      },
    };

    await transitionJobStatus({
      store,
      jobId,
      toStatus: "lite_check_queued",
      reason: "upload_complete",
    });

    expect(capturedUpdatedAt).toBeInstanceOf(Date);
  });

  it("allows retrying asset analysis directly from a failed state", async () => {
    const store = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_failed",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 1,
        lastError: "previous failure",
      },
    ]);

    const job = await transitionJobStatus({
      store,
      jobId,
      toStatus: "asset_analysis_running",
      reason: "asset_analysis_restarted",
    });

    expect(job.status).toBe("asset_analysis_running");
    expect(store.listEvents()[0]).toMatchObject({
      fromStatus: "asset_analysis_failed",
      toStatus: "asset_analysis_running",
      reason: "asset_analysis_restarted",
    });
  });

  it("restores the previous job state when event persistence fails", async () => {
    const lockedUntil = new Date("2026-06-10T10:00:00.000Z");
    const baseStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_running",
        userVisibleStatus: "analyzing_assets",
        failureReason: "previous failure",
        lockedBy: "worker-1",
        lockedUntil,
        attemptCount: 1,
        lastError: "vision timeout",
      },
    ]);
    const store = {
      ...baseStore,
      async createStateEvent() {
        throw new Error("job state event unavailable");
      },
    };

    await expect(
      transitionJobStatus({
        store,
        jobId,
        toStatus: "asset_analysis_passed",
        reason: "asset_analysis_completed",
        clearLock: true,
        errorMessage: null,
        userVisibleStatus: "assets_ready",
        failureReason: null,
      }),
    ).rejects.toThrow("job state event unavailable");

    const restored = await store.findJob(jobId);
    expect(restored).toMatchObject({
      status: "asset_analysis_running",
      userVisibleStatus: "analyzing_assets",
      failureReason: "previous failure",
      lastError: "vision timeout",
      lockedBy: "worker-1",
    });
    expect(restored?.lockedUntil?.toISOString()).toBe(lockedUntil.toISOString());
  });
});
