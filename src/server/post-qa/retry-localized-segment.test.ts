import { describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import type { VideoSegmentRecord } from "@/server/storyboard/confirm";
import { createInMemoryVideoSegmentStore } from "@/server/video/segments";

import { createInMemoryPostQaStore } from "./resolve";
import { retryLocalizedPostQaSegment } from "./retry-localized-segment";

const jobId = "33333333-3333-4333-8333-333333333333";
const userId = "22222222-2222-4222-8222-222222222222";

function segment(segmentIndex: number): VideoSegmentRecord {
  const now = new Date("2026-07-11T00:00:00.000Z");
  return {
    id: `00000000-0000-4000-8000-00000000000${segmentIndex}`,
    videoJobId: jobId,
    storyboardId: "11111111-1111-4111-8111-111111111111",
    segmentIndex,
    status: "succeeded",
    templateId: `template-${segmentIndex}`,
    prompt: `Segment ${segmentIndex}`,
    inputAssetSnapshot: {},
    provider: "apimart",
    model: "pixverse-v6",
    providerTaskId: `task-${segmentIndex}`,
    providerCallLogId: `call-${segmentIndex}`,
    videoKey: `jobs/${jobId}/segments/${segmentIndex}.mp4`,
    costEstimate: "1.00",
    generationProfile: "paid_720p_audio",
    resolution: "720p",
    audioEnabled: true,
    watermarkEnabled: false,
    isTest: true,
    lockedBy: "worker",
    lockedUntil: now,
    attemptCount: 1,
    lastError: "old error",
    nextRetryAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function stores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "post_qa_running",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  ]);
  const segmentStore = createInMemoryVideoSegmentStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "post_qa_running",
        aspectRatio: "9:16",
        creditCost: 310,
      },
    ],
    segments: Array.from({ length: 5 }, (_, index) => segment(index)),
    assets: [],
  });
  const postQaStore = createInMemoryPostQaStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "post_qa_running",
        creditCost: 310,
        reservedLedgerId: "reserve-1",
      },
    ],
  });
  return { jobStore, segmentStore, postQaStore };
}

describe("retryLocalizedPostQaSegment", () => {
  it("requeues only the localized segment and preserves credits for retry", async () => {
    const testStores = stores();

    const result = await retryLocalizedPostQaSegment({
      ...testStores,
      jobId,
      segmentIndex: 3,
      mode: "strict",
      frameKeys: ["jobs/job-1/qa/frames/segment-3-frame-0.jpg"],
      resultJson: { passed: false, failedSegmentIndexes: [3] },
    });

    expect(result).toEqual({
      requeued: true,
      segmentId: "00000000-0000-4000-8000-000000000003",
      segmentIndex: 3,
    });
    expect(testStores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
    expect(testStores.segmentStore.listSegments()[3]).toMatchObject({
      status: "queued",
      providerTaskId: null,
      providerCallLogId: null,
      videoKey: null,
      lockedBy: null,
      lockedUntil: null,
      lastError: null,
      nextRetryAt: null,
    });
    expect(testStores.segmentStore.listSegments()[2]?.status).toBe("succeeded");
    expect(testStores.postQaStore.listResults()[0]).toMatchObject({
      status: "failed",
      failureCategory: "localized_segment_retry",
    });
  });

  it("does not requeue after the localized retry has already been used", async () => {
    const testStores = stores();
    await testStores.postQaStore.createResult({
      videoJobId: jobId,
      status: "failed",
      mode: "strict",
      frameKeys: [],
      failureCategory: "localized_segment_retry",
    });

    await expect(
      retryLocalizedPostQaSegment({
        ...testStores,
        jobId,
        segmentIndex: 3,
        mode: "strict",
        frameKeys: [],
        resultJson: { passed: false },
      }),
    ).resolves.toEqual({ requeued: false, reason: "retry_exhausted" });
    expect(testStores.jobStore.listJobs()[0]?.status).toBe("post_qa_running");
  });
});
