import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createInMemoryStitchStore,
  createStitchJobForVideo,
  getQueuedStitchJobPayloadForVideo,
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

function createStores(
  segmentCount = 2,
  durationSeconds = segmentCount * 8,
  segmentIndexes = Array.from({ length: segmentCount }, (_, index) => index),
  generationProfile: "trial_540p_watermarked" | "paid_720p_audio" | "paid_1080p_audio" = "paid_720p_audio",
) {
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
        durationSeconds,
        isTest: false,
        postQaMode: "standard",
        aspectRatio: "9:16",
        generationProfile,
      },
    ],
    segments: segmentIndexes.map((segmentIndex) => ({
      id: `segment-${segmentIndex + 1}`,
      videoJobId: jobId,
      segmentIndex,
      status: "succeeded",
      videoKey: `jobs/job-1/segments/segment-${segmentIndex + 1}/video.mp4`,
    })),
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
      expectedAspectRatio: "9:16",
      minimumShortSide: 720,
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

  it("requires a 1080-pixel short side for the paid 1080p profile", async () => {
    const result = await createStitchJobForVideo({
      ...createStores(2, 16, [0, 1], "paid_1080p_audio"),
      jobId,
    });

    expect(result.minimumShortSide).toBe(1080);
  });

  it("keeps all four 32-second segment keys in the stitch payload", async () => {
    const result = await createStitchJobForVideo({
      ...createStores(4),
      jobId,
    });

    expect(result.segmentCount).toBe(4);
    expect(result.segmentKeys).toEqual([
      "jobs/job-1/segments/segment-1/video.mp4",
      "jobs/job-1/segments/segment-2/video.mp4",
      "jobs/job-1/segments/segment-3/video.mp4",
      "jobs/job-1/segments/segment-4/video.mp4",
    ]);
  });

  it("rejects a 32-second stitch job when one of four segments is missing", async () => {
    await expect(
      createStitchJobForVideo({
        ...createStores(3, 32),
        jobId,
      }),
    ).rejects.toThrow(
      "Video job requires exactly 4 contiguous segments for 32 seconds.",
    );
  });

  it("rejects four 32-second segments when their indexes are not contiguous", async () => {
    await expect(
      createStitchJobForVideo({
        ...createStores(4, 32, [0, 1, 2, 4]),
        jobId,
      }),
    ).rejects.toThrow(
      "Video job requires exactly 4 contiguous segments for 32 seconds.",
    );
  });

  it("rejects an incomplete queued 32-second stitch job on retry", async () => {
    const stores = createStores(4, 32);
    await stores.stitchStore.createStitchJob({
      videoJobId: jobId,
      segmentKeys: [
        "jobs/job-1/segments/segment-1/video.mp4",
        "jobs/job-1/segments/segment-2/video.mp4",
        "jobs/job-1/segments/segment-3/video.mp4",
      ],
      isTest: false,
    });

    await expect(
      getQueuedStitchJobPayloadForVideo({
        stitchStore: stores.stitchStore,
        jobId,
      }),
    ).rejects.toThrow(
      "Video job requires exactly 4 segments for 32 seconds.",
    );
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
