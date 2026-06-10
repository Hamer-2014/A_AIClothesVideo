import { describe, expect, it } from "vitest";

import { createInMemoryJobProgressStore, getVideoJobProgress } from "./progress";

describe("video job progress", () => {
  it("aggregates segment, stitch, and post-QA progress for the owner", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          status: "segment_generating",
          userVisibleStatus: "generating",
          finalVideoKey: null,
          coverKey: null,
        },
      ],
      segments: [
        { videoJobId: "job-1", status: "succeeded" },
        { videoJobId: "job-1", status: "generating" },
        { videoJobId: "job-1", status: "queued" },
      ],
      stitchJobs: [{ videoJobId: "job-1", status: "queued" }],
      postQaResults: [],
    });

    await expect(
      getVideoJobProgress({ store, jobId: "job-1", userId: "user-1" }),
    ).resolves.toEqual({
      jobId: "job-1",
      status: "segment_generating",
      userVisibleStatus: "generating",
      phase: "generation",
      segmentProgress: {
        total: 3,
        queued: 1,
        generating: 1,
        succeeded: 1,
        failed: 0,
      },
      stitching: { status: "queued" },
      postQa: { status: "not_started" },
      downloadReady: false,
      finalVideoKey: null,
      coverKey: null,
    });
  });

  it("returns null when the job does not belong to the user", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-2",
          status: "deliverable",
          userVisibleStatus: "ready",
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
        },
      ],
      segments: [],
      stitchJobs: [],
      postQaResults: [],
    });

    await expect(
      getVideoJobProgress({ store, jobId: "job-1", userId: "user-1" }),
    ).resolves.toBeNull();
  });

  it("treats segments_queued as generation phase and reports queued segments", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          status: "segments_queued",
          userVisibleStatus: "generating",
          finalVideoKey: null,
          coverKey: null,
        },
      ],
      segments: [
        { videoJobId: "job-1", status: "queued" },
      ],
      stitchJobs: [],
      postQaResults: [],
    });

    await expect(
      getVideoJobProgress({ store, jobId: "job-1", userId: "user-1" }),
    ).resolves.toEqual({
      jobId: "job-1",
      status: "segments_queued",
      userVisibleStatus: "generating",
      phase: "generation",
      segmentProgress: {
        total: 1,
        queued: 1,
        generating: 0,
        succeeded: 0,
        failed: 0,
      },
      stitching: { status: "not_started" },
      postQa: { status: "not_started" },
      downloadReady: false,
      finalVideoKey: null,
      coverKey: null,
    });
  });
});
