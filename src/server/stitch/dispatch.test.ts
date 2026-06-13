import { describe, expect, it, vi } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createStitchJobForVideo,
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
    jobs: [
      {
        id: jobId,
        status: "segment_succeeded",
        isTest: false,
        postQaMode: "standard",
      },
    ],
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
    const calls: string[] = [];

    const result = await createAndTriggerStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
      triggerCloudRun: async (payload) => {
        calls.push(stitchStore.listStitchJobs()[0]?.status ?? "missing");
        triggered.push(payload);
        return { accepted: true, stitchJobId: payload.stitchJobId };
      },
    });

    expect(result.cloudRun.accepted).toBe(true);
    expect(triggered).toHaveLength(1);
    expect(triggered[0]).toMatchObject({ postQaMode: "standard" });
    expect(stitchStore.listStitchJobs()[0]?.status).toBe("running");
    expect(jobStore.listJobs()[0]?.status).toBe("stitching_running");
    expect(calls).toEqual(["running"]);
  });

  it("can trigger an existing queued stitch job without creating a duplicate", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    const { jobStore, stitchStore } = stores();
    await createStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
    });

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

  it("can create a fresh stitch job when the video is already stitching_queued after a failed attempt", async () => {
    vi.stubEnv("APP_URL", "https://app.example.com");
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId: "22222222-2222-4222-8222-222222222222",
        status: "stitching_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const stitchStore = createInMemoryStitchStore({
      jobs: [
        {
          id: jobId,
          status: "stitching_queued",
          isTest: false,
          postQaMode: "lite",
        },
      ],
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
    const failed = await stitchStore.createStitchJob({
      videoJobId: jobId,
      segmentKeys: ["jobs/job/segments/1.mp4"],
      isTest: false,
    });
    await stitchStore.updateStitchJob(failed.id, { status: "failed" });

    const result = await createAndTriggerStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
      triggerCloudRun: async (payload) => ({
        accepted: true,
        stitchJobId: payload.stitchJobId,
      }),
    });

    expect(result.cloudRun.accepted).toBe(true);
    expect(stitchStore.listStitchJobs()).toHaveLength(2);
    expect(stitchStore.listStitchJobs().some((job) => job.status === "running")).toBe(true);
    expect(jobStore.listJobs()[0]?.status).toBe("stitching_running");
  });
});
