import { describe, expect, it } from "vitest";

import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import {
  createInMemoryVideoSegmentStore,
  type VideoSegmentAssetRecord,
  type VideoSegmentJobRecord,
} from "./segments";
import { refreshGenerationForJob } from "./job-refresh";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const otherJobId = "44444444-4444-4444-8444-444444444444";

function createSegment({
  id,
  videoJobId,
  status,
  providerTaskId = null,
}: {
  id: string;
  videoJobId: string;
  status: "queued" | "generating";
  providerTaskId?: string | null;
}) {
  return {
    id,
    videoJobId,
    storyboardId: "storyboard-1",
    segmentIndex: 0,
    status,
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
    provider: providerTaskId ? "apimart" : null,
    model: providerTaskId ? "pixverse-v6" : null,
    providerTaskId,
    providerCallLogId: null,
    videoKey: null,
    costEstimate: "0",
    generationProfile: "paid_720p_audio" as const,
    resolution: "720p",
    audioEnabled: true,
    watermarkEnabled: false,
    isTest: false,
    lockedBy: null,
    lockedUntil: null,
    attemptCount: providerTaskId ? 1 : 0,
    lastError: null,
    nextRetryAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createStores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "segment_generating",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
    {
      id: otherJobId,
      userId,
      status: "segment_generating",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  ]);
  const jobs: VideoSegmentJobRecord[] = [
    {
      id: jobId,
      userId,
      status: "segment_generating",
      aspectRatio: "9:16",
      creditCost: 70,
    },
    {
      id: otherJobId,
      userId,
      status: "segment_generating",
      aspectRatio: "9:16",
      creditCost: 70,
    },
  ];
  const assets: VideoSegmentAssetRecord[] = [
    {
      id: "asset-front",
      userId,
      originalKey: "users/user-1/assets/asset-front/original.jpg",
    },
  ];
  const segmentStore = createInMemoryVideoSegmentStore({
    jobs,
    assets,
    segments: [
      createSegment({
        id: "segment-1",
        videoJobId: jobId,
        status: "generating",
        providerTaskId: "task-apimart",
      }),
      createSegment({
        id: "segment-other",
        videoJobId: otherJobId,
        status: "generating",
        providerTaskId: "task-other",
      }),
    ],
  });

  return { jobStore, segmentStore };
}

describe("refreshGenerationForJob", () => {
  it("polls only the requested generating job and stores provider output", async () => {
    const stores = createStores();

    const result = await refreshGenerationForJob({
      ...stores,
      jobId,
      pollSegment: async ({ segmentId, storeProviderOutput }) => {
        const videoKey = await storeProviderOutput({
          jobId,
          segmentId,
          outputUrl: "https://provider.example/video.mp4",
        });
        await stores.segmentStore.updateSegment(segmentId, {
          status: "succeeded",
          videoKey,
        });
        await stores.jobStore.updateJobStatus(jobId, {
          status: "segment_succeeded",
        });
        return {
          jobId,
          segmentId,
          status: "succeeded" as const,
          videoKey,
        };
      },
      storeProviderOutput: async ({ segmentId }) => `stored/${segmentId}.mp4`,
    });

    expect(result).toEqual({
      jobId,
      submittedCount: 0,
      polledCount: 1,
    });
    expect(stores.segmentStore.listSegments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "segment-1",
          status: "succeeded",
          videoKey: "stored/segment-1.mp4",
        }),
        expect.objectContaining({
          id: "segment-other",
          status: "generating",
          videoKey: null,
        }),
      ]),
    );
    expect(stores.jobStore.listJobs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: jobId, status: "segment_succeeded" }),
        expect.objectContaining({
          id: otherJobId,
          status: "segment_generating",
        }),
      ]),
    );
  });

  it("polls a failed job when a provider segment is still generating", async () => {
    const stores = createStores();
    await stores.jobStore.updateJobStatus(jobId, {
      status: "segment_failed",
      lastError: "EvoLink task polling failed with status 404.",
    });

    const result = await refreshGenerationForJob({
      ...stores,
      jobId,
      pollSegment: async ({ segmentId, storeProviderOutput }) => {
        const videoKey = await storeProviderOutput({
          jobId,
          segmentId,
          outputUrl: "https://provider.example/video.mp4",
        });
        await stores.segmentStore.updateSegment(segmentId, {
          status: "succeeded",
          videoKey,
        });
        await stores.jobStore.updateJobStatus(jobId, {
          status: "segment_succeeded",
          lastError: null,
        });
        return {
          jobId,
          segmentId,
          status: "succeeded" as const,
          videoKey,
        };
      },
      storeProviderOutput: async ({ segmentId }) => `stored/${segmentId}.mp4`,
    });

    expect(result).toEqual({
      jobId,
      submittedCount: 0,
      polledCount: 1,
    });
    expect(stores.jobStore.listJobs()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: jobId,
          status: "segment_succeeded",
          lastError: null,
        }),
      ]),
    );
  });
});
