import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createInMemoryVideoSegmentStore,
  pollSubmittedSegment,
  submitQueuedSegment,
} from "./segments";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const segmentId = "55555555-5555-4555-8555-555555555555";

function createStores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "segments_queued",
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
        status: "segments_queued",
        aspectRatio: "9:16",
      },
    ],
    segments: [
      {
        id: segmentId,
        videoJobId: jobId,
        storyboardId: "storyboard-1",
        segmentIndex: 0,
        status: "queued",
        templateId: "front_push_in",
        prompt: "Slow front push-in.",
        inputAssetSnapshot: {
          assets: [
            {
              assetId: "asset-front",
              role: "front",
              sortOrder: 0,
            },
          ],
        },
        provider: null,
        model: null,
        providerTaskId: null,
        providerCallLogId: null,
        videoKey: null,
        costEstimate: "0",
        isTest: false,
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
        nextRetryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    assets: [
      {
        id: "asset-front",
        userId,
        originalKey: "users/user-1/assets/asset-front/original.jpg",
      },
    ],
  });
  const providerCallLogStore = createInMemoryProviderCallLogStore();

  return { jobStore, segmentStore, providerCallLogStore };
}

describe("video segment services", () => {
  it("submits a queued segment and stores provider task metadata", async () => {
    const stores = createStores();

    const result = await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => ({
        provider: "evolink",
        model: "veo3.1-pro-beta",
        providerTaskId: "task-1",
        raw: {
          receivedPrompt: input.prompt,
          imageUrls: input.imageUrls,
        },
      }),
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "generating",
      providerTaskId: "task-1",
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      provider: "evolink",
      model: "veo3.1-pro-beta",
      providerTaskId: "task-1",
      providerCallLogId: expect.any(String),
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segment_generating");
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "evolink",
      model: "veo3.1-pro-beta",
      purpose: "video_generation",
      status: "succeeded",
      providerTaskId: "task-1",
    });
  });

  it("marks a generating segment succeeded when provider output is ready", async () => {
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "evolink",
      model: "veo3.1-pro-beta",
      providerTaskId: "task-1",
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      pollTask: async () => ({
        provider: "evolink",
        model: "veo3.1-pro-beta",
        providerTaskId: "task-1",
        status: "succeeded",
        outputUrl: "https://provider.example/video.mp4",
        raw: { status: "succeeded" },
      }),
      storeProviderOutput: async ({ segmentId: id }) =>
        `jobs/${jobId}/segments/${id}/video.mp4`,
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "succeeded",
      videoKey: `jobs/${jobId}/segments/${segmentId}/video.mp4`,
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "succeeded",
      videoKey: `jobs/${jobId}/segments/${segmentId}/video.mp4`,
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segment_succeeded");
  });
});
