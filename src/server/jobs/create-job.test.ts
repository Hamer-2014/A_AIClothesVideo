import { describe, expect, it } from "vitest";

import {
  createInMemoryFunnelEventStore,
} from "@/server/analytics/funnel-events";

import {
  createInMemoryVideoJobCreationStore,
  createVideoJobWithAssets,
} from "./create-job";

const userId = "22222222-2222-4222-8222-222222222222";

describe("create video job", () => {
  it("stores an explicit capture protocol and normalized sku name", async () => {
    const store = createInMemoryVideoJobCreationStore(
      ["front", "back", "detail"].map((role) => ({
        id: `asset-${role}`,
        userId,
        status: "uploaded" as const,
        detectedRole: role as "front" | "back" | "detail",
      })),
    );

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front", "asset-back", "asset-detail"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      captureProtocol: "product_showcase",
      skuName: "Linen Dress",
    });

    expect(result.job).toMatchObject({
      captureProtocol: "product_showcase",
      skuName: "Linen Dress",
    });
  });

  it("creates an asset-analysis queued job and binds owned assets", async () => {
    const funnelStore = createInMemoryFunnelEventStore();
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
      funnelEventStore: funnelStore,
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
    expect(store.listTrialUsages()).toHaveLength(0);
    expect(store.listTrialAbuseSignals()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "trial_granted",
          videoJobId: result.job.id,
        }),
      ]),
    );
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "job_created",
        source: "server",
        userId,
        path: null,
        metadata: expect.objectContaining({
          jobId: result.job.id,
          billingMode: "free_trial",
          durationSeconds: 8,
          aspectRatio: "9:16",
          presetId: "minimal_studio",
          status: "asset_analysis_queued",
        }),
      }),
    ]);
  });

  it("blocks direct job creation when any asset lacks rights attestation", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
        rightsAttested: false,
        rightsAttestationId: null,
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
    ).rejects.toThrow("Rights attestation is required for all assets.");

    expect(store.listJobs()).toHaveLength(0);
    expect(store.listEvents()).toHaveLength(0);
    expect(store.listAccessEvents()).toHaveLength(0);
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("stores a server-verified rights attestation snapshot", async () => {
    const now = new Date("2026-07-11T00:00:00.000Z");
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
        rightsAttested: true,
        rightsAttestationId: "attestation-1",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      now,
    });

    expect(result.job.rightsAttestationSnapshot).toEqual({
      version: "image_rights_v1",
      assetIds: ["asset-front"],
      attestationIds: ["attestation-1"],
      verifiedAt: now.toISOString(),
    });
  });

  it("records paid generation funnel event and does not block job creation when analytics fails", async () => {
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
      durationSeconds: 16,
      aspectRatio: "1:1",
      useFreeTrialIfAvailable: false,
      funnelEventStore: {
        async createEvent() {
          throw new Error("analytics down");
        },
      },
    });

    expect(result.job).toMatchObject({
      billingMode: "paid",
      status: "asset_analysis_queued",
    });
    expect(store.listJobs()).toHaveLength(1);
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

  it("stores preset id and snapshot when creating a job", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-1",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-1"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: false,
      presetId: "marketplace_clean",
    });

    expect(result.job).toMatchObject({
      presetId: "marketplace_clean",
      presetSnapshot: expect.objectContaining({
        id: "marketplace_clean",
        label: "电商主图动效",
      }),
    });
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

  it("rejects trial requests when email risk has already used a trial without creating a job", async () => {
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
        trialEligibilityCounts: {
          emailTrialCount: 1,
        },
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
        email: "seller@example.com",
        emailVerified: true,
        oauthAccounts: [{ provider: "google", providerAccountId: "google-1" }],
        deviceFingerprint: "device-1",
        requestContext: {
          ipAddress: "203.0.113.10",
          userAgent: "Vitest Browser",
          path: "/api/jobs",
        },
        abuseHashSecret: "test-secret",
        appEnvironment: "production",
        now: new Date("2026-06-13T08:00:00.000Z"),
      }),
    ).rejects.toThrow("Free trial is not available.");

    expect(store.listJobs()).toHaveLength(0);
    expect(store.listTrialAbuseSignals()).toEqual([
      expect.objectContaining({
        decision: "deny",
        eventType: "trial_denied",
        reasonCodes: expect.arrayContaining(["email_trial_used"]),
      }),
    ]);
  });

  it("does not apply trial abuse checks to explicit paid jobs", async () => {
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
        trialEligibilityCounts: {
          emailTrialCount: 1,
          ipSignalCount: 99,
        },
      },
    );

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: false,
      email: "seller@example.com",
      emailVerified: false,
      deviceFingerprint: "device-1",
      requestContext: {
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
      },
      abuseHashSecret: "test-secret",
      appEnvironment: "production",
    });

    expect(result.job.billingMode).toBe("paid");
    expect(store.listTrialAbuseSignals()).toHaveLength(0);
  });

  it("uses the dev fallback abuse hash secret for trial eligibility checks without granting usage at job creation", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: true,
      email: "seller@example.com",
      emailVerified: true,
      deviceFingerprint: "device-1",
      requestContext: {
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
      },
      abuseHashSecret: null,
      appEnvironment: "development",
      now: new Date("2026-06-13T08:00:00.000Z"),
    });

    const signals = store.listTrialAbuseSignals();
    const check = signals.find((signal) => signal.eventType === "trial_check");
    const granted = signals.find((signal) => signal.eventType === "trial_granted");

    expect(check).toBeTruthy();
    expect(granted).toBeUndefined();
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("creates paid jobs for 16 and 24 second durations when paid generation is selected", async () => {
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
      useFreeTrialIfAvailable: false,
    });
    const twentyFour = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 24,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: false,
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

  it("rejects a free-trial request for paid-only durations", async () => {
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
        durationSeconds: 16,
        aspectRatio: "9:16",
        useFreeTrialIfAvailable: true,
      }),
    ).rejects.toThrow("Free trial only supports 8-second video.");

    expect(store.listJobs()).toHaveLength(0);
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
    ]));
    expect(store.listAccessEvents()).not.toEqual(expect.arrayContaining([
      expect.objectContaining({
        userId,
        eventType: "trial_granted",
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

  it("gates and prices 40-second paid jobs", async () => {
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
        durationSeconds: 40,
        aspectRatio: "9:16",
        useFreeTrialIfAvailable: false,
        videoSpecEnv: { VIDEO_DURATION_40_ENABLED: "false" },
      }),
    ).rejects.toThrow("40-second Beta is not enabled.");

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 40,
      aspectRatio: "9:16",
      useFreeTrialIfAvailable: false,
      videoSpecEnv: { VIDEO_DURATION_40_ENABLED: "true" },
    });

    expect(result.job).toMatchObject({
      durationSeconds: 40,
      creditCost: 310,
      billingMode: "paid",
    });
  });
});
