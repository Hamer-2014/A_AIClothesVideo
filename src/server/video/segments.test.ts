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
        creditCost: 70,
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
        generationProfile: "trial_540p_watermarked",
        resolution: "540p",
        audioEnabled: false,
        watermarkEnabled: true,
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
      {
        id: "asset-scene",
        userId,
        originalKey: "users/user-1/assets/asset-scene/original.jpg",
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
        creditCost: 70,
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
      generationProfile: "paid_720p_audio" as const,
      resolution: "720p",
      audioEnabled: true,
      watermarkEnabled: false,
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

  it("does not submit a queued segment before the job reaches generation states", async () => {
    const stores = createStores();
    const unsafeStore = createInMemoryVideoSegmentStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "prompt_moderation_running",
          aspectRatio: "9:16",
          creditCost: 70,
        },
      ],
      segments: stores.segmentStore.listSegments(),
      assets: [],
    });
    let providerCalled = false;

    await expect(
      submitQueuedSegment({
        jobStore: stores.jobStore,
        segmentStore: unsafeStore,
        jobId,
        segmentId,
        createVideoGeneration: async () => {
          providerCalled = true;
          throw new Error("provider must not be called");
        },
      }),
    ).rejects.toThrow("Video job is not ready for segment generation.");

    expect(providerCalled).toBe(false);
    expect(unsafeStore.listSegments()[0]?.status).toBe("queued");
  });

  it("rechecks the latest job state immediately before provider submission", async () => {
    const stores = createStores();
    let jobReads = 0;
    let providerCalled = false;
    const racingStore = {
      ...stores.segmentStore,
      async findJob(id: string) {
        jobReads += 1;
        const job = await stores.segmentStore.findJob(id);
        return jobReads === 1
          ? job
          : job
            ? { ...job, status: "segment_failed" }
            : null;
      },
    };

    await expect(
      submitQueuedSegment({
        jobStore: stores.jobStore,
        segmentStore: racingStore,
        providerCallLogStore: stores.providerCallLogStore,
        jobId,
        segmentId,
        createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        createVideoGeneration: async () => {
          providerCalled = true;
          throw new Error("provider must not be called");
        },
      }),
    ).rejects.toThrow("Video job is not ready for segment generation.");

    expect(jobReads).toBeGreaterThanOrEqual(2);
    expect(providerCalled).toBe(false);
    expect(racingStore.listSegments()[0]).toMatchObject({ status: "queued" });
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
    expect(started).toHaveLength(3);
    expect(started[0]).toContain("GLOBAL HARD CONSTRAINTS:");
    expect(started[0]).toContain("GLOBAL USER INTENT:");
    expect(started[0]).toContain("SEGMENT INSTRUCTION:\nPrompt 0");
    expect(started[1]).toContain("SEGMENT INSTRUCTION:\nPrompt 1");
    expect(started[2]).toContain("SEGMENT INSTRUCTION:\nPrompt 2");
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
        if (input.prompt.includes("SEGMENT INSTRUCTION:\nPrompt 1")) {
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
        model: "veo3.1-fast-beta",
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
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      providerCallLogId: expect.any(String),
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segment_generating");
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "evolink",
      model: "veo3.1-fast-beta",
      purpose: "video_generation",
      status: "succeeded",
      providerKeyId: null,
      modelRouteId: null,
      routeSnapshot: null,
      providerTaskId: "task-1",
      requestSnapshot: expect.objectContaining({
        configSource: "env",
        compiledPromptVersion: "global_intent_constraints_v1",
        globalHardConstraints: expect.arrayContaining([
          expect.stringContaining("Do not invent garment details"),
        ]),
        globalUserIntent: {},
        segmentInstruction: "Slow front push-in.",
        compiledPromptSections: [
          "GLOBAL HARD CONSTRAINTS",
          "GLOBAL USER INTENT",
          "SEGMENT INSTRUCTION",
        ],
      }),
    });
  });

  it("does not submit the same queued segment twice when concurrent workers race", async () => {
    const stores = createStores();
    let providerCalls = 0;

    const results = await Promise.allSettled([
      submitQueuedSegment({
        ...stores,
        jobId,
        segmentId,
        createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        createVideoGeneration: async () => {
          providerCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            provider: "apimart",
            model: "pixverse-v6",
            providerTaskId: "task-race",
            raw: { ok: true },
          };
        },
      }),
      submitQueuedSegment({
        ...stores,
        jobId,
        segmentId,
        createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        createVideoGeneration: async () => {
          providerCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return {
            provider: "apimart",
            model: "pixverse-v6",
            providerTaskId: "task-race-duplicate",
            raw: { ok: true },
          };
        },
      }),
    ]);

    expect(results).toEqual([
      expect.objectContaining({ status: "fulfilled" }),
      expect.objectContaining({ status: "rejected" }),
    ]);
    expect(providerCalls).toBe(1);
    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "generating",
      providerTaskId: "task-race",
    });
    expect(stores.providerCallLogStore.listCallLogs()).toHaveLength(1);
  });

  it("clears stale job errors after submitting a retried queued segment", async () => {
    const stores = createStores();
    await stores.jobStore.updateJobStatus(jobId, {
      status: "segments_queued",
      lastError: "No active model route for video_generation in development.",
      failureReason: "No active model route for video_generation in development.",
    });

    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async () => ({
        provider: "apimart",
        model: "pixverse-v6",
        providerTaskId: "task-retried",
        raw: { ok: true },
      }),
    });

    expect(stores.jobStore.listJobs()[0]).toMatchObject({
      status: "segment_generating",
      lastError: null,
      failureReason: null,
    });
  });

  it("does not pass database provider key or route model into generation", async () => {
    const stores = createStores();
    const seenDeps: unknown[] = [];

    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (_input, deps) => {
        seenDeps.push(deps);
        return {
          provider: "apimart",
          model: "pixverse-v6-env",
          providerTaskId: "task-env-key",
          raw: { ok: true },
        };
      },
    });

    expect(seenDeps[0]).toBeUndefined();
  });

  it("passes segment resolution, audio, watermark, and generation profile into video generation", async () => {
    const stores = createStores();
    const seenInputs: unknown[] = [];

    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => {
        seenInputs.push(input);
        return {
          provider: "apimart",
          model: "pixverse-v6",
          providerTaskId: "task-profile",
          raw: { ok: true },
        };
      },
    });

    expect(seenInputs[0]).toMatchObject({
      resolution: "540p",
      audio: false,
      watermarkEnabled: true,
      generationProfile: "trial_540p_watermarked",
    });
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      requestSnapshot: expect.objectContaining({
        configSource: "env",
        generationProfile: "trial_540p_watermarked",
        resolution: "540p",
        audio: false,
        watermarkEnabled: true,
      }),
    });
  });

  it("labels garment and scene reference images in the provider prompt", async () => {
    const stores = createStores();
    await stores.segmentStore.updateSegment(segmentId, {
      templateId: "scene_lifestyle_showcase",
      inputAssetSnapshot: {
        assets: [
          { assetId: "asset-front", role: "front", sortOrder: 0 },
          { assetId: "asset-scene", role: "scene", sortOrder: 1 },
        ],
      },
    });
    const seenInputs: unknown[] = [];

    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => {
        seenInputs.push(input);
        return {
          provider: "apimart",
          model: "pixverse-v6",
          providerTaskId: "task-scene",
          raw: { ok: true },
        };
      },
    });

    expect(seenInputs[0]).toMatchObject({
      imageUrls: [
        "https://signed.example/users/user-1/assets/asset-front/original.jpg",
        "https://signed.example/users/user-1/assets/asset-scene/original.jpg",
      ],
      prompt: expect.stringContaining("Image 1 is a front garment reference"),
    });
    expect((seenInputs[0] as { prompt: string }).prompt).toContain(
      "Image 2 is a scene/background reference",
    );
    expect((seenInputs[0] as { prompt: string }).prompt).toContain(
      "Use scene/background reference only for environment, lighting, and mood",
    );
  });

  it("uses the APIMart provider selected by env-only router", async () => {
    vi.stubEnv("VIDEO_GENERATION_PROVIDER", "apimart");
    vi.stubEnv("VIDEO_GENERATION_MODEL", "pixverse-v6");
    vi.stubEnv("APIMART_API_KEY", "sk-env-apimart");
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

  it("submits through the env-only generation function without route metadata", async () => {
    const stores = createStores();
    const seenInputs: unknown[] = [];

    const result = await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async (input) => {
        seenInputs.push(input);
        return {
        provider: "apimart",
        model: "pixverse-v6",
        providerTaskId: "task-env-only",
        raw: { ok: true },
        };
      },
    });

    expect(result.providerTaskId).toBe("task-env-only");
    expect((seenInputs[0] as { prompt: string }).prompt).toContain(
      "SEGMENT INSTRUCTION:\nSlow front push-in.",
    );
    expect((seenInputs[0] as { prompt: string }).prompt).toContain(
      "GLOBAL HARD CONSTRAINTS:",
    );
    expect(stores.providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "apimart",
      model: "pixverse-v6",
      providerKeyId: null,
      modelRouteId: null,
      routeSnapshot: null,
      requestSnapshot: expect.objectContaining({
        configSource: "env",
      }),
    });
  });

  it("continues to submit when no database route dependency is provided", async () => {
    const stores = createStores();
    const createVideoGeneration = vi.fn(async () => ({
      provider: "apimart" as const,
      model: "pixverse-v6",
      providerTaskId: "task-env",
      raw: { ok: true },
    }));

    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      maxSubmitAttempts: 1,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration,
    });

    expect(createVideoGeneration).toHaveBeenCalledOnce();
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
        requestSnapshot: expect.objectContaining({
          attempt: 2,
          maxAttempts: 3,
        }),
      }),
    ]);
  });

  it("records env-only submit failure logs without route or provider key fields", async () => {
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
      providerKeyId: null,
      modelRouteId: null,
      routeSnapshot: null,
      model: "pixverse-v6",
      status: "failed",
      errorCode: "video_generation_submit_failed",
      errorMessage: "APIMart submit failed.",
      requestSnapshot: expect.objectContaining({
        configSource: "env",
      }),
    });
  });

  it("requeues a claimed segment when signing input assets fails before provider submit", async () => {
    const stores = createStores();

    await expect(
      submitQueuedSegment({
        ...stores,
        jobId,
        segmentId,
        createSignedUrl: async () => {
          throw new Error("R2 signing failed.");
        },
        createVideoGeneration: async () => {
          throw new Error("provider should not be called");
        },
      }),
    ).rejects.toThrow("R2 signing failed.");

    expect(stores.segmentStore.listSegments()[0]).toMatchObject({
      status: "queued",
      providerTaskId: null,
      lastError: "R2 signing failed.",
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
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
    });
    await stores.jobStore.updateJobStatus(jobId, { status: "segment_generating" });

    const result = await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      pollTask: async () => ({
        provider: "evolink",
        model: "veo3.1-fast-beta",
        providerTaskId: "task-1",
        status: "succeeded",
        outputUrl: "https://provider.example/video.mp4",
        errorMessage: null,
        raw: { status: "succeeded" },
        costEstimate: "0.333",
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
      costEstimate: "0.333",
    });
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segment_succeeded");
  });

  it("polls using the provider persisted on the segment instead of the current env provider", async () => {
    vi.stubEnv("VIDEO_GENERATION_PROVIDER", "evolink");
    vi.stubEnv("APIMART_BASE_URL", "https://api.apimart.example");
    vi.stubEnv("EVOLINK_BASE_URL", "https://api.evolink.example");
    vi.stubEnv("APIMART_API_KEY", "sk-env-apimart");
    vi.stubEnv("EVOLINK_API_KEY", "sk-env-evolink");
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
    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async () => ({
        provider: "apimart",
        model: "pixverse-v6",
        providerTaskId: "task-apimart",
        raw: { ok: true },
      }),
    });

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
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-env-apimart",
        }),
      }),
    );
  });

  it("polls provider tasks with env-only auth and no provider key lookup", async () => {
    vi.stubEnv("APIMART_API_KEY", "sk-env-poll");
    const stores = createStores();
    await submitQueuedSegment({
      ...stores,
      jobId,
      segmentId,
      createSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      createVideoGeneration: async () => ({
        provider: "apimart",
        model: "pixverse-v6",
        providerTaskId: "task-env-poll",
        raw: { ok: true },
      }),
    });
    const fetchImpl = vi.fn(async () =>
      Response.json({
        code: 200,
        data: {
          id: "task-env-poll",
          status: "processing",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchImpl);

    await pollSubmittedSegment({
      ...stores,
      jobId,
      segmentId,
      storeProviderOutput: async () => {
        throw new Error("should not store running output");
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.apimart.ai/v1/tasks/task-env-poll",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-env-poll",
        }),
      }),
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

