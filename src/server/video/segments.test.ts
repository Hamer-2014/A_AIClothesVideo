import { afterEach, describe, expect, it, vi } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  createInMemoryVideoSegmentStore,
  kickQueuedSegmentsForJob,
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

function createStoresWithSegments(segmentIds: string[]) {
  const base = createStores();
  const now = new Date();
  const segmentStore = createInMemoryVideoSegmentStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "segments_queued",
        aspectRatio: "9:16",
      },
    ],
    segments: segmentIds.map((id, index) => ({
      id,
      videoJobId: jobId,
      storyboardId: "storyboard-1",
      segmentIndex: index,
      status: "queued" as const,
      templateId: `template-${index}`,
      prompt: `Prompt ${index}`,
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
      createdAt: now,
      updatedAt: now,
    })),
    assets: [
      {
        id: "asset-front",
        userId,
        originalKey: "users/user-1/assets/asset-front/original.jpg",
      },
    ],
  });

  return { ...base, segmentStore };
}

describe("video segment services", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("kicks all queued segments for a job concurrently", async () => {
    const stores = createStoresWithSegments(["segment-1", "segment-2", "segment-3"]);
    const started: string[] = [];
    let active = 0;
    let maxActive = 0;

    const result = await kickQueuedSegmentsForJob({
      ...stores,
      jobId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        started.push(input.prompt);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active -= 1;

        return {
          provider: "evolink",
          model: "veo3.1-fast-beta",
          providerTaskId: `task-${input.prompt.at(-1)}`,
          raw: { prompt: input.prompt },
        };
      },
    });

    expect(result).toEqual({
      status: "submitted",
      submittedCount: 3,
      failedCount: 0,
      segmentIds: ["segment-1", "segment-2", "segment-3"],
      providerTaskIds: ["task-0", "task-1", "task-2"],
    });
    expect(started).toEqual(["Prompt 0", "Prompt 1", "Prompt 2"]);
    expect(maxActive).toBeGreaterThan(1);
    expect(stores.segmentStore.listSegments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "segment-1", status: "generating" }),
        expect.objectContaining({ id: "segment-2", status: "generating" }),
        expect.objectContaining({ id: "segment-3", status: "generating" }),
      ]),
    );
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segment_generating");
  });

  it("marks the job failed when any immediate segment submission fails", async () => {
    const stores = createStoresWithSegments(["segment-1", "segment-2"]);

    const result = await kickQueuedSegmentsForJob({
      ...stores,
      jobId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => {
        if (input.prompt === "Prompt 1") {
          throw new Error("EvoLink submit failed.");
        }

        return {
          provider: "evolink",
          model: "veo3.1-fast-beta",
          providerTaskId: "task-0",
          raw: { prompt: input.prompt },
        };
      },
    });

    expect(result).toEqual({
      status: "failed",
      submittedCount: 1,
      failedCount: 1,
      segmentIds: ["segment-1", "segment-2"],
      providerTaskIds: ["task-0"],
      errorMessage: "EvoLink submit failed.",
    });
    expect(stores.segmentStore.listSegments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "segment-1", status: "generating" }),
        expect.objectContaining({
          id: "segment-2",
          status: "failed",
          lastError: "EvoLink submit failed.",
        }),
      ]),
    );
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segment_failed",
      lastError: "EvoLink submit failed.",
    });
  });

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

  it("uses the configured APIMart provider through the default generation router", async () => {
    vi.stubEnv("VIDEO_GENERATION_PROVIDER", "apimart");
    vi.stubEnv("VIDEO_GENERATION_MODEL", "pixverse-v6");
    vi.stubEnv("APIMART_API_KEY", "sk-test");
    vi.stubEnv("APIMART_BASE_URL", "https://api.apimart.example");
    const stores = createStores();
    const fetchImpl = vi.fn(async () =>
      Response.json({
        code: 200,
        data: [{ status: "submitted", task_id: "task-apimart" }],
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    const result = await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "generating",
      providerTaskId: "task-apimart",
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task-apimart",
    });
  });

  it("retries transient provider submission failures before marking submit failed", async () => {
    const stores = createStores();
    let attempts = 0;

    const result = await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      maxSubmitAttempts: 3,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("EvoLink temporarily unavailable.");
        }

        return {
          provider: "evolink",
          model: "veo3.1-fast-beta",
          providerTaskId: "task-retry-success",
          raw: { attempt: attempts },
        };
      },
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "generating",
      providerTaskId: "task-retry-success",
    });
    expect(attempts).toBe(2);
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      attemptCount: 2,
      providerTaskId: "task-retry-success",
    });
    expect(stores.providerCallLogStore.listCallLogs()).toEqual([
      expect.objectContaining({
        status: "failed",
        errorCode: "video_generation_submit_failed",
        errorMessage: "EvoLink temporarily unavailable.",
      }),
      expect.objectContaining({
        status: "succeeded",
        providerTaskId: "task-retry-success",
      }),
    ]);
  });

  it("records submit failures against the configured provider instead of always EvoLink", async () => {
    vi.stubEnv("VIDEO_GENERATION_PROVIDER", "apimart");
    vi.stubEnv("VIDEO_GENERATION_MODEL", "pixverse-v6");
    const stores = createStores();

    await expect(
      submitQueuedSegment({
        ...stores,
        jobId,
        segmentId,
        maxSubmitAttempts: 1,
        createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        createVideoGeneration: async () => {
          throw new Error("APIMart submit failed.");
        },
      }),
    ).rejects.toThrow("APIMart submit failed.");

    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "apimart",
      model: "pixverse-v6",
      status: "failed",
      errorCode: "video_generation_submit_failed",
      errorMessage: "APIMart submit failed.",
    });
  });

  it("prefers generic submit retry env over legacy EvoLink retry env", async () => {
    vi.stubEnv("VIDEO_GENERATION_SUBMIT_MAX_ATTEMPTS", "2");
    vi.stubEnv("EVOLINK_SUBMIT_MAX_ATTEMPTS", "4");
    const stores = createStores();
    let attempts = 0;

    await expect(
      submitQueuedSegment({
        ...stores,
        jobId,
        segmentId,
        createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        createVideoGeneration: async () => {
          attempts += 1;
          throw new Error(`submit failed ${attempts}`);
        },
      }),
    ).rejects.toThrow("submit failed 2");

    expect(attempts).toBe(2);
    expect(stores.segmentStore.listSegments()[0]?.attemptCount).toBe(2);
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
        errorMessage: null,
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

  it("polls using the provider persisted on the segment instead of the current env provider", async () => {
    vi.stubEnv("VIDEO_GENERATION_PROVIDER", "evolink");
    vi.stubEnv("APIMART_API_KEY", "sk-apimart");
    vi.stubEnv("APIMART_BASE_URL", "https://api.apimart.example");
    vi.stubEnv("EVOLINK_API_KEY", "sk-evolink");
    vi.stubEnv("EVOLINK_BASE_URL", "https://api.evolink.example");
    const stores = createStores();
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("evolink")) {
        return new Response(JSON.stringify({ error: "not found" }), {
          status: 404,
        });
      }

      return Response.json({
        code: 200,
        data: {
          id: "task-apimart",
          status: "completed",
          result: {
            videos: [{ url: ["https://provider.example/apimart.mp4"] }],
          },
        },
      });
    });
    vi.stubGlobal("fetch", fetchImpl);
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task-apimart",
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      storeProviderOutput: async ({ segmentId: id }) =>
        `jobs/${jobId}/segments/${id}/video.mp4`,
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "succeeded",
      videoKey: `jobs/${jobId}/segments/${segmentId}/video.mp4`,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.apimart.example/v1/tasks/task-apimart",
      expect.any(Object),
    );
  });

  it("repairs a failed job when provider output was stored and all segments succeeded", async () => {
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task-apimart",
    });
    await stores.jobStore.updateJobStatus(jobId, {
      status: "segment_failed",
      lastError: "EvoLink task polling failed with status 404.",
    });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      pollTask: async () => ({
        provider: "apimart",
        model: "pixverse-v6",
        providerTaskId: "task-apimart",
        status: "succeeded",
        outputUrl: "https://provider.example/apimart.mp4",
        errorMessage: null,
        raw: { status: "completed" },
      }),
      storeProviderOutput: async ({ segmentId: id }) =>
        `jobs/${jobId}/segments/${id}/video.mp4`,
    });

    expect(result.status).toBe("succeeded");
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "succeeded",
      videoKey: `jobs/${jobId}/segments/${segmentId}/video.mp4`,
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segment_succeeded",
      lastError: null,
    });
    expect(stores.jobStore.listEvents()[0]).toMatchObject({
      fromStatus: "segment_failed",
      toStatus: "segment_succeeded",
      reason: "repair_all_segments_succeeded_after_transition_conflict",
    });
  });

  it("regenerates a failed provider task before exhausting generation attempts", async () => {
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "evolink",
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      attemptCount: 1,
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      maxTaskRegenerations: 2,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      pollTask: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-1",
        status: "failed",
        outputUrl: null,
        errorMessage: "Provider capacity exhausted.",
        raw: { status: "failed" },
      }),
      createVideoGeneration: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-2",
        raw: { status: "processing" },
      }),
      storeProviderOutput: async () => {
        throw new Error("should not store failed provider output");
      },
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "generating",
      videoKey: null,
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      lastError: "Provider capacity exhausted.",
      attemptCount: 2,
      providerTaskId: "task-2",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segment_generating",
      lastError: null,
    });
  });

  it("uses generic task regeneration env before exhausting provider task failures", async () => {
    vi.stubEnv("VIDEO_GENERATION_TASK_MAX_REGENERATIONS", "3");
    vi.stubEnv("EVOLINK_TASK_MAX_REGENERATIONS", "1");
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "evolink",
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      attemptCount: 2,
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      pollTask: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-1",
        status: "failed",
        outputUrl: null,
        errorMessage: "Provider transient task failure.",
        raw: { status: "failed" },
      }),
      createVideoGeneration: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-3",
        raw: { status: "processing" },
      }),
      storeProviderOutput: async () => {
        throw new Error("should not store failed provider output");
      },
    });

    expect(result.status).toBe("generating");
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      attemptCount: 3,
      providerTaskId: "task-3",
    });
  });

  it("stores provider task failure details after generation attempts are exhausted", async () => {
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      status: "generating",
      provider: "evolink",
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      attemptCount: 2,
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      maxTaskRegenerations: 2,
      pollTask: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-1",
        status: "failed",
        outputUrl: null,
        errorMessage: "Input image URL could not be downloaded.",
        raw: {
          status: "failed",
          error: { message: "Input image URL could not be downloaded." },
        },
      }),
      storeProviderOutput: async () => {
        throw new Error("should not store failed provider output");
      },
    });

    expect(result).toEqual({
      jobId,
      segmentId,
      status: "failed",
      videoKey: null,
    });
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "failed",
      lastError: "Input image URL could not be downloaded.",
    });
    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segment_failed",
      lastError: "Input image URL could not be downloaded.",
    });
    expect(stores.jobStore.listEvents()[0]).toMatchObject({
      toStatus: "segment_failed",
      eventSnapshot: {
        segmentId,
        providerTaskId: "task-1",
        errorMessage: "Input image URL could not be downloaded.",
      },
    });
  });
});
