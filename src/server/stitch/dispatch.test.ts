import { describe, expect, it, vi } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createAndTriggerStitchJobForVideo,
  createInMemoryStitchStore,
  triggerQueuedStitchJobForVideo,
} from "./jobs";

const jobId = "11111111-1111-4111-8111-111111111111";

function stores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId: "22222222-2222-4222-8222-222222222222",
      status: "segment_succeeded",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  ]);
  const stitchStore = createInMemoryStitchStore({
    jobs: [{ id: jobId, status: "segment_succeeded", isTest: false }],
    segments: [
      {
        id: "segment-1",
        videoJobId: jobId,
        segmentIndex: 0,
        status: "succeeded",
        videoKey: "jobs/job/segments/1.mp4",
      },
    ],
  });

  return { jobStore, stitchStore };
}

describe("stitch dispatch", () => {
  it("creates a stitch job, triggers Cloud Run, and marks it running", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { jobStore, stitchStore } = stores();
    const triggered: unknown[] = [];

    const result = await createAndTriggerStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
      triggerCloudRun: async (payload) => {
        triggered.push(payload);
        return { accepted: true, stitchJobId: payload.stitchJobId };
      },
    });

    expect(result.cloudRun.accepted).toBe(true);
    expect(triggered).toHaveLength(1);
    expect(stitchStore.listStitchJobs()[0]?.status).toBe("running");
    expect(jobStore.listJobs()[0]?.status).toBe("stitching_running");
  });

  it("can trigger an existing queued stitch job without creating a duplicate", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { jobStore, stitchStore } = stores();
    await createAndTriggerStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
      triggerCloudRun: async () => {
        throw new Error("Cloud Run unavailable");
      },
    }).catch(() => undefined);
    await jobStore.updateJobStatus(jobId, { status: "stitching_queued" });

    const existingCount = stitchStore.listStitchJobs().length;
    const result = await triggerQueuedStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
      triggerCloudRun: async (payload) => ({
        accepted: true,
        stitchJobId: payload.stitchJobId,
      }),
    });

    expect(result.cloudRun.accepted).toBe(true);
    expect(stitchStore.listStitchJobs()).toHaveLength(existingCount);
    expect(stitchStore.listStitchJobs()[0]?.status).toBe("running");
  });
});
