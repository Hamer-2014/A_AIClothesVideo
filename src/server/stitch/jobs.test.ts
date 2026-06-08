import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createInMemoryStitchStore,
  createStitchJobForVideo,
  handleStitchCallback,
  markStitchJobRunning,
} from "./jobs";

const originalAppUrl = process.env.APP_URL;

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
});

afterEach(() => {
  process.env.APP_URL = originalAppUrl;
});

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";

function createStores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
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
      },
    ],
    segments: [
      {
        id: "segment-1",
        videoJobId: jobId,
        segmentIndex: 0,
        status: "succeeded",
        videoKey: "jobs/job-1/segments/segment-1/video.mp4",
      },
      {
        id: "segment-2",
        videoJobId: jobId,
        segmentIndex: 1,
        status: "succeeded",
        videoKey: "jobs/job-1/segments/segment-2/video.mp4",
      },
    ],
  });

  return { jobStore, stitchStore };
}

describe("stitch jobs", () => {
  it("creates a stitch job from succeeded segments and advances the video job", async () => {
    const stores = createStores();

    const result = await createStitchJobForVideo({
      ...stores,
      jobId,
    });

    expect(result).toMatchObject({
      jobId,
      stitchJobId: expect.any(String),
      status: "queued",
      segmentCount: 2,
      segmentKeys: [
        "jobs/job-1/segments/segment-1/video.mp4",
        "jobs/job-1/segments/segment-2/video.mp4",
      ],
      finalVideoKey: `jobs/${jobId}/stitched/final.mp4`,
      coverKey: `jobs/${jobId}/covers/cover.webp`,
      frameKeyPrefix: `jobs/${jobId}/qa/frames`,
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
    });
    expect(stores.stitchStore.listStitchJobs()[0]).toMatchObject({
      videoJobId: jobId,
      status: "queued",
      segmentKeys: [
        "jobs/job-1/segments/segment-1/video.mp4",
        "jobs/job-1/segments/segment-2/video.mp4",
      ],
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("stitching_queued");
  });

  it("handles successful Cloud Run callback and queues post QA", async () => {
    const stores = createStores();
    const created = await createStitchJobForVideo({
      ...stores,
      jobId,
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "stitching_running" });
    await stores.stitchStore.updateStitchJob(created.stitchJobId, {
      status: "running",
    });

    const result = await handleStitchCallback({
      ...stores,
      stitchJobId: created.stitchJobId,
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      callbackSnapshot: { cloudRunJob: "run-1" },
    });

    expect(result).toEqual({
      jobId,
      stitchJobId: created.stitchJobId,
      status: "post_qa_queued",
    });
    expect(stores.stitchStore.listStitchJobs()[0]).toMatchObject({
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("post_qa_queued");
  });

  it("marks a stitch job running after Cloud Run accepts the trigger", async () => {
    const stores = createStores();
    const created = await createStitchJobForVideo({
      ...stores,
      jobId,
    });

    const result = await markStitchJobRunning({
      ...stores,
      stitchJobId: created.stitchJobId,
    });

    expect(result).toEqual({
      jobId,
      stitchJobId: created.stitchJobId,
      status: "running",
    });
    expect(stores.stitchStore.listStitchJobs()[0]).toMatchObject({
      status: "running",
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("stitching_running");
  });
});
