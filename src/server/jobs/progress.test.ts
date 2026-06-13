import { describe, expect, it } from "vitest";

import { createInMemoryJobProgressStore, getVideoJobProgress } from "./progress";

function jobFixture(overrides: Partial<Parameters<typeof createInMemoryJobProgressStore>[0]["jobs"][number]> = {}) {
  return {
    id: "job-1",
    userId: "user-1",
    status: "segment_generating",
    userVisibleStatus: "generating",
    lastError: null,
    failureReason: null,
    finalVideoKey: null,
    coverKey: null,
    creditCost: 70,
    billingMode: "paid",
    reservedLedgerId: null,
    ...overrides,
  };
}

describe("video job progress", () => {
  it("aggregates segment, stitch, and post-QA progress for the owner", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        jobFixture(),
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
      message: null,
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
      creditCost: 70,
      billingMode: "paid",
      creditStatus: "reserved",
      downloadReady: false,
      finalVideoKey: null,
      coverKey: null,
    });
  });

  it("returns null when the job does not belong to the user", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        jobFixture({
          userId: "user-2",
          status: "deliverable",
          userVisibleStatus: "ready",
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          reservedLedgerId: "ledger-1",
        }),
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
        jobFixture({
          status: "segments_queued",
          reservedLedgerId: "ledger-1",
        }),
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
      message: null,
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
      creditCost: 70,
      billingMode: "paid",
      creditStatus: "reserved",
      downloadReady: false,
      finalVideoKey: null,
      coverKey: null,
    });
  });

  it("returns the stored failure reason so the job page can explain failed generation", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        jobFixture({
          status: "segment_failed",
          lastError: "Provider task failed.",
          failureReason:
            "EvoLink failed: Service busy. Allocating resources, please retry later.",
          reservedLedgerId: "ledger-1",
        }),
      ],
      segments: [{ videoJobId: "job-1", status: "failed" }],
      stitchJobs: [],
      postQaResults: [],
    });

    await expect(
      getVideoJobProgress({ store, jobId: "job-1", userId: "user-1" }),
    ).resolves.toMatchObject({
      status: "segment_failed",
      phase: "failed",
      message:
        "EvoLink failed: Service busy. Allocating resources, please retry later.",
      segmentProgress: {
        failed: 1,
      },
    });
  });

  it("keeps polling when the job failed but a provider segment is still generating", async () => {
    const store = createInMemoryJobProgressStore({
      jobs: [
        jobFixture({
          status: "segment_failed",
          lastError: "EvoLink task polling failed with status 404.",
          reservedLedgerId: "ledger-1",
        }),
      ],
      segments: [{ videoJobId: "job-1", status: "generating" }],
      stitchJobs: [],
      postQaResults: [],
    });

    await expect(
      getVideoJobProgress({ store, jobId: "job-1", userId: "user-1" }),
    ).resolves.toMatchObject({
      status: "segment_failed",
      phase: "generation",
      segmentProgress: {
        generating: 1,
        failed: 0,
      },
    });
  });
});
