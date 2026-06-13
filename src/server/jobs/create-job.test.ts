import { describe, expect, it } from "vitest";

import {
  createInMemoryVideoJobCreationStore,
  createVideoJobWithAssets,
} from "./create-job";

const userId = "22222222-2222-4222-8222-222222222222";

describe("create video job", () => {
  it("creates an asset-analysis queued job and binds owned assets", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
      {
        id: "asset-back",
        userId,
        status: "uploaded",
        detectedRole: "back",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front", "asset-back"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: true,
      now: new Date("2026-06-12T08:00:00.000Z"),
    });

    expect(result.job).toMatchObject({
      userId,
      status: "asset_analysis_queued",
      userVisibleStatus: "analyzing_assets",
      durationSeconds: 8,
      aspectRatio: "9:16",
      creditCost: 0,
      billingMode: "free_trial",
      generationProfile: "trial_540p_watermarked",
      watermarkEnabled: true,
      postQaMode: "lite",
      isTest: false,
    });
    expect(store.listJobAssets()).toEqual([
      expect.objectContaining({
        videoJobId: result.job.id,
        assetId: "asset-front",
        role: "front",
        sortOrder: 0,
      }),
      expect.objectContaining({
        videoJobId: result.job.id,
        assetId: "asset-back",
        role: "back",
        sortOrder: 1,
      }),
    ]);
    expect(store.listEvents()).toEqual([
      expect.objectContaining({
        videoJobId: result.job.id,
        fromStatus: "draft_uploaded",
        toStatus: "asset_analysis_queued",
        reason: "job_created",
      }),
    ]);
    expect(store.listTrialUsages()).toEqual([
      expect.objectContaining({
        userId,
        videoJobId: result.job.id,
        durationSeconds: 8,
        generationProfile: "trial_540p_watermarked",
        resolution: "540p",
        watermarkEnabled: true,
        provider: "apimart",
        model: "pixverse-v6",
      }),
    ]);
  });

  it("creates a paid 8 second job when paid generation is selected after trial was already used", async () => {
    const now = new Date("2026-06-12T08:00:00.000Z");
    const store = createInMemoryVideoJobCreationStore(
      [
        {
          id: "asset-front",
          userId,
          status: "uploaded",
          detectedRole: "front",
        },
      ],
      {
        trialUsages: [
          {
            userId,
            usedAt: new Date("2026-06-11T12:00:00.000Z"),
          },
        ],
      },
    );

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: false,
      now,
    });

    expect(result.job).toMatchObject({
      creditCost: 70,
      billingMode: "paid",
      generationProfile: "paid_720p_audio",
      watermarkEnabled: false,
      postQaMode: "standard",
    });
    expect(store.listTrialUsages()).toHaveLength(1);
  });

  it("defaults 8 second jobs to paid unless free trial is explicitly requested", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
    });

    expect(result.job).toMatchObject({
      creditCost: 70,
      billingMode: "paid",
      generationProfile: "paid_720p_audio",
      watermarkEnabled: false,
      postQaMode: "standard",
    });
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("rejects an explicit free trial request when the rolling 24 hour trial was already used", async () => {
    const store = createInMemoryVideoJobCreationStore(
      [
        {
          id: "asset-front",
          userId,
          status: "uploaded",
          detectedRole: "front",
        },
      ],
      {
        trialUsages: [
          {
            userId,
            usedAt: new Date("2026-06-12T07:00:00.000Z"),
          },
        ],
      },
    );

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 8,
        aspectRatio: "9:16",
        useFreeTrialIfAvailable: true,
        now: new Date("2026-06-12T08:00:00.000Z"),
      }),
    ).rejects.toThrow("Free trial is not available.");

    expect(store.listJobs()).toHaveLength(0);
    expect(store.listAccessEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        eventType: "trial_denied",
        metadata: expect.objectContaining({
          durationSeconds: 8,
          previousTrialCount: 1,
        }),
      }),
    ]));
  });

  it("always creates paid jobs for 16 and 24 second durations", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    const sixteen = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 16,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: true,
    });
    const twentyFour = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 24,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: true,
    });

    expect(sixteen.job).toMatchObject({
      creditCost: 130,
      billingMode: "paid",
      generationProfile: "paid_720p_audio",
    });
    expect(twentyFour.job).toMatchObject({
      creditCost: 190,
      billingMode: "paid",
      generationProfile: "paid_720p_audio",
    });
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("does not let legacy client trial intent force a free job when paid generation is selected", async () => {
    const store = createInMemoryVideoJobCreationStore(
      [
        {
          id: "asset-front",
          userId,
          status: "uploaded",
          detectedRole: "front",
        },
      ],
      {
        trialUsages: [
          {
            userId,
            usedAt: new Date("2026-06-12T07:00:00.000Z"),
          },
        ],
      },
    );

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      isTrial: true,
      useFreeTrialIfAvailable: false,
      now: new Date("2026-06-12T08:00:00.000Z"),
    });

    expect(result.job).toMatchObject({
      creditCost: 70,
      billingMode: "paid",
    });
  });

  it("records job creation and trial decision access events with IP and user agent", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: true,
      requestContext: {
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
      },
    });

    expect(store.listAccessEvents()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId,
        eventType: "job_create",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
        metadata: expect.objectContaining({ videoJobId: result.job.id }),
      }),
      expect.objectContaining({
        userId,
        eventType: "trial_eligibility_check",
        ipAddress: "203.0.113.10",
      }),
      expect.objectContaining({
        userId,
        eventType: "trial_granted",
        ipAddress: "203.0.113.10",
      }),
    ]));
  });

  it("rejects creating a job without assets", async () => {
    const store = createInMemoryVideoJobCreationStore([]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: [],
        durationSeconds: 8,
        aspectRatio: "9:16",
        useFreeTrialIfAvailable: true,
      }),
    ).rejects.toThrow("At least one asset is required to create a video job.");

    expect(store.listJobs()).toHaveLength(0);
  });

  it("rejects assets that do not belong to the user", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId: "another-user",
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 8,
        aspectRatio: "9:16",
        useFreeTrialIfAvailable: true,
      }),
    ).rejects.toThrow("One or more assets were not found for user.");

    expect(store.listJobs()).toHaveLength(0);
  });

  it("rejects assets that were presigned but not confirmed uploaded", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "pending_upload",
        detectedRole: "front",
      },
    ]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 8,
        aspectRatio: "9:16",
      }),
    ).rejects.toThrow("One or more assets are not uploaded yet.");

    expect(store.listJobs()).toHaveLength(0);
  });

  it("rejects unsupported duration and aspect ratio", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 12,
        aspectRatio: "4:5",
        isTrial: false,
      }),
    ).rejects.toThrow("Unsupported video duration.");
  });
});
