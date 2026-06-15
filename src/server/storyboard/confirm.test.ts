import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { grantTrialCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryModerationResultStore } from "@/server/moderation/results";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  confirmStoryboard,
  createInMemoryStoryboardConfirmationStore,
  type NewVideoSegmentRecord,
  type VideoSegmentRecord,
} from "./confirm";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const storyboardId = "44444444-4444-4444-8444-444444444444";

function createStores() {
  const jobStore = createInMemoryJobStore([
    {
      id: jobId,
      userId,
      status: "storyboard_draft_ready",
      lockedBy: null,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  ]);
  const storyboardStore = createInMemoryStoryboardConfirmationStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "storyboard_draft_ready",
        durationSeconds: 16,
        creditCost: 130,
        billingMode: "paid",
        generationProfile: "paid_720p_audio",
        watermarkEnabled: false,
        isTest: false,
      },
    ],
    jobAssets: [
      {
        videoJobId: jobId,
        assetId: "asset-front",
        role: "front",
        sortOrder: 0,
      },
    ],
    storyboards: [
      {
        id: storyboardId,
        videoJobId: jobId,
        version: 1,
        status: "draft",
        selectedTemplateIds: ["front_push_in", "front_pan"],
        storyboardJson: {
          duration_seconds: 16,
          segments: [
            {
              index: 0,
              duration_seconds: 8,
              template_id: "front_push_in",
              prompt: "Slow push-in on the front garment.",
            },
            {
              index: 1,
              duration_seconds: 8,
              template_id: "front_pan",
              prompt: "Gentle pan across the front garment.",
            },
          ],
        },
        finalPromptSnapshot: null,
        providerCallLogId: null,
        confirmedAt: null,
        createdAt: new Date("2026-06-07T00:00:00.000Z"),
        updatedAt: new Date("2026-06-07T00:00:00.000Z"),
      },
    ],
  });
  const creditStore = createInMemoryCreditLedgerStore();
  const moderationStore = createInMemoryModerationResultStore();

  return {
    jobStore,
    storyboardStore,
    creditStore,
    moderationStore,
  };
}

async function allowModeration() {
  return {
    id: "mod-allow",
    decision: "allow" as const,
    raw: { decision: "allow" },
  };
}

async function grantPaidJobCredits(stores: ReturnType<typeof createStores>) {
  await grantTrialCredits({
    store: stores.creditStore,
    userId,
    amount: 200,
    reason: "test setup",
    idempotencyKey: `grant:${randomUUID()}`,
  });
}

async function seedExistingSegments(
  store: ReturnType<typeof createStores>["storyboardStore"],
  segments: NewVideoSegmentRecord[],
) {
  await store.createVideoSegments(segments);
}

function segmentInput(
  segmentIndex: number,
  templateId = segmentIndex === 0 ? "front_push_in" : "front_pan",
): NewVideoSegmentRecord {
  return {
    videoJobId: jobId,
    storyboardId,
    segmentIndex,
    templateId,
    prompt:
      segmentIndex === 0
        ? "Slow push-in on the front garment."
        : "Gentle pan across the front garment.",
    inputAssetSnapshot: {
      segmentIndex,
      templateId,
      assets: [{ assetId: "asset-front", role: "front", sortOrder: 0 }],
    },
    generationProfile: "paid_720p_audio",
    resolution: "720p",
    audioEnabled: true,
    watermarkEnabled: false,
    isTest: false,
  };
}

function markStoryboardConfirmed(stores: ReturnType<typeof createStores>) {
  const storyboard = stores.storyboardStore.listStoryboards()[0];
  if (!storyboard) {
    throw new Error("Missing test storyboard.");
  }

  return stores.storyboardStore.confirmStoryboard({
    storyboardId: storyboard.id,
    finalPromptSnapshot: {
      version: "global_intent_constraints_v1",
      durationSeconds: 16,
      globalHardConstraints: [],
      globalUserIntent: {
        sourcePromptSummary: null,
        styleIntent: null,
        sellingPoints: [],
        negativeIntent: [],
      },
      segmentPrompts: [],
      systemConstraints: [],
      inputAssets: [],
      assetFactsSnapshot: {
        hasBack: false,
        hasDetail: false,
        hasScene: false,
      },
      templatePolicySnapshot: {},
    },
  });
}

describe("confirmStoryboard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("moderates the final prompt, reserves credits, confirms storyboard, and creates video segments", async () => {
    const stores = createStores();
    const moderatedPrompts: string[] = [];
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:user-1",
    });

    const result = await confirmStoryboard({
      ...stores,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async (input) => {
        moderatedPrompts.push(input.prompt);
        return {
          id: "mod-1",
          decision: "allow",
          raw: { decision: "allow" },
        };
      },
    });

    expect(result).toEqual({
      jobId,
      storyboardId,
      status: "segments_queued",
      reservedLedgerId: expect.any(String),
      segmentCount: 2,
    });
    expect(stores.storyboardStore.listStoryboards()[0]).toMatchObject({
      status: "confirmed",
      finalPromptSnapshot: {
        version: "global_intent_constraints_v1",
        durationSeconds: 16,
        globalHardConstraints: expect.arrayContaining([
          expect.stringContaining("Do not invent garment details"),
          expect.stringContaining("Do not show the back side"),
        ]),
        globalUserIntent: {
          sourcePromptSummary: null,
          styleIntent: null,
          sellingPoints: [],
          negativeIntent: [],
        },
        segmentPrompts: [
          expect.objectContaining({
            templateId: "front_push_in",
            prompt: "Slow push-in on the front garment.",
          }),
          expect.objectContaining({
            templateId: "front_pan",
            prompt: "Gentle pan across the front garment.",
          }),
        ],
        assetFactsSnapshot: {
          hasBack: false,
          hasDetail: false,
          hasScene: false,
        },
      },
    });
    expect(moderatedPrompts[0]).toContain("GLOBAL HARD CONSTRAINTS:");
    expect(moderatedPrompts[0]).toContain("GLOBAL USER INTENT:");
    expect(moderatedPrompts[0]).toContain("- Clean ecommerce product video.");
    expect(moderatedPrompts[0]).toContain("SEGMENT 1 (front_push_in):");
    expect(stores.storyboardStore.listSegments()).toEqual([
      expect.objectContaining({
        videoJobId: jobId,
        storyboardId,
        segmentIndex: 0,
        status: "queued",
        templateId: "front_push_in",
        prompt: "Slow push-in on the front garment.",
        inputAssetSnapshot: expect.objectContaining({
          promptCompiler: expect.objectContaining({
            version: "global_intent_constraints_v1",
          }),
        }),
        generationProfile: "paid_720p_audio",
        resolution: "720p",
        audioEnabled: true,
        watermarkEnabled: false,
        isTest: false,
      }),
      expect.objectContaining({
        videoJobId: jobId,
        storyboardId,
        segmentIndex: 1,
        status: "queued",
        templateId: "front_pan",
        prompt: "Gentle pan across the front garment.",
        inputAssetSnapshot: expect.objectContaining({
          promptCompiler: expect.objectContaining({
            version: "global_intent_constraints_v1",
          }),
        }),
        generationProfile: "paid_720p_audio",
        resolution: "720p",
        audioEnabled: true,
        watermarkEnabled: false,
        isTest: false,
      }),
    ]);
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
    expect(stores.moderationStore.listResults()).toEqual([
      expect.objectContaining({
        source: "final_video_prompt",
        decision: "allow",
      }),
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
  });

  it("uses an explicit debug resolution override when creating video segments", async () => {
    vi.stubEnv("VIDEO_GENERATION_DEBUG_RESOLUTION", "360p");
    const stores = createStores();
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:debug-resolution",
    });

    await confirmStoryboard({
      ...stores,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-debug-resolution",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(stores.storyboardStore.listSegments()).toEqual([
      expect.objectContaining({
        generationProfile: "paid_720p_audio",
        resolution: "360p",
      }),
      expect.objectContaining({
        generationProfile: "paid_720p_audio",
        resolution: "360p",
      }),
    ]);
  });

  it("only attaches assets required by each segment template", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "storyboard_draft_ready",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const storyboardStore = createInMemoryStoryboardConfirmationStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "storyboard_draft_ready",
          durationSeconds: 16,
          creditCost: 130,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
          isTest: false,
        },
      ],
      jobAssets: [
        { videoJobId: jobId, assetId: "asset-front", role: "front", sortOrder: 0 },
        { videoJobId: jobId, assetId: "asset-back", role: "back", sortOrder: 1 },
        { videoJobId: jobId, assetId: "asset-detail", role: "detail", sortOrder: 2 },
        { videoJobId: jobId, assetId: "asset-scene", role: "scene", sortOrder: 3 },
      ],
      storyboards: [
        {
          id: storyboardId,
          videoJobId: jobId,
          version: 1,
          status: "draft",
          selectedTemplateIds: ["front_push_in", "back_display"],
          storyboardJson: {
            duration_seconds: 16,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "front_push_in",
                prompt: "Slow push-in on the front garment.",
              },
              {
                index: 1,
                duration_seconds: 8,
                template_id: "back_display",
                prompt: "Hold on the back garment.",
              },
            ],
          },
          finalPromptSnapshot: null,
          providerCallLogId: null,
          confirmedAt: null,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    });
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:template-assets",
    });

    await confirmStoryboard({
      jobStore,
      storyboardStore,
      creditStore,
      moderationStore: createInMemoryModerationResultStore(),
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-1",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(storyboardStore.listSegments()).toEqual([
      expect.objectContaining({
        templateId: "front_push_in",
        inputAssetSnapshot: expect.objectContaining({
          segmentIndex: 0,
          templateId: "front_push_in",
          assets: [
            {
              assetId: "asset-front",
              role: "front",
              sortOrder: 0,
            },
          ],
          promptCompiler: expect.objectContaining({
            version: "global_intent_constraints_v1",
            globalHardConstraints: expect.arrayContaining([
              expect.stringContaining("Do not invent garment details"),
            ]),
          }),
        }),
      }),
      expect.objectContaining({
        templateId: "back_display",
        inputAssetSnapshot: expect.objectContaining({
          segmentIndex: 1,
          templateId: "back_display",
          assets: [
            {
              assetId: "asset-back",
              role: "back",
              sortOrder: 1,
            },
          ],
          promptCompiler: expect.objectContaining({
            version: "global_intent_constraints_v1",
          }),
        }),
      }),
    ]);
  });

  it("attaches front and scene assets for the scene lifestyle template", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "storyboard_draft_ready",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const storyboardStore = createInMemoryStoryboardConfirmationStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "storyboard_draft_ready",
          durationSeconds: 8,
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
          isTest: false,
        },
      ],
      jobAssets: [
        { videoJobId: jobId, assetId: "asset-front", role: "front", sortOrder: 0 },
        { videoJobId: jobId, assetId: "asset-scene", role: "scene", sortOrder: 1 },
        { videoJobId: jobId, assetId: "asset-back", role: "back", sortOrder: 2 },
      ],
      storyboards: [
        {
          id: storyboardId,
          videoJobId: jobId,
          version: 1,
          status: "draft",
          selectedTemplateIds: ["scene_lifestyle_showcase"],
          storyboardJson: {
            duration_seconds: 8,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "scene_lifestyle_showcase",
                prompt: "Show the garment in the uploaded street scene.",
              },
            ],
          },
          finalPromptSnapshot: null,
          providerCallLogId: null,
          confirmedAt: null,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    });
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 100,
      reason: "test setup",
      idempotencyKey: "grant:scene-template-assets",
    });

    await confirmStoryboard({
      jobStore,
      storyboardStore,
      creditStore,
      moderationStore: createInMemoryModerationResultStore(),
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-scene",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(storyboardStore.listSegments()[0]).toMatchObject({
      templateId: "scene_lifestyle_showcase",
      inputAssetSnapshot: {
        segmentIndex: 0,
        templateId: "scene_lifestyle_showcase",
        assets: [
          { assetId: "asset-front", role: "front", sortOrder: 0 },
          { assetId: "asset-scene", role: "scene", sortOrder: 1 },
        ],
      },
    });
    expect(storyboardStore.listStoryboards()[0]?.finalPromptSnapshot).toMatchObject({
      inputAssets: [
        { assetId: "asset-front", role: "front", sortOrder: 0 },
        { assetId: "asset-scene", role: "scene", sortOrder: 1 },
        { assetId: "asset-back", role: "back", sortOrder: 2 },
      ],
      systemConstraints: expect.arrayContaining([
        "Use scene assets only as background, lighting, and mood reference.",
      ]),
    });
  });

  it("blocks confirmation before reserving credits or creating segments when final prompt moderation flags", async () => {
    const stores = createStores();
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:user-1",
    });

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-flag",
          decision: "flag",
          raw: { decision: "flag" },
        }),
      }),
    ).rejects.toThrow("Final prompt moderation blocked video generation.");

    expect(stores.storyboardStore.listSegments()).toHaveLength(0);
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe(
      "prompt_moderation_blocked",
    );
  });

  it("does not create segments when credit reserve fails", async () => {
    const stores = createStores();

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-1",
          decision: "allow",
          raw: { decision: "allow" },
        }),
      }),
    ).rejects.toThrow("Insufficient available credits.");

    expect(stores.storyboardStore.listSegments()).toHaveLength(0);
    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("draft");
  });

  it("keeps storyboard retryable when segment creation fails after credit reserve", async () => {
    const stores = createStores();
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:segment-create-failure",
    });

    const failingStoryboardStore = {
      ...stores.storyboardStore,
      async createVideoSegments() {
        throw new Error("segment insert failed");
      },
    };

    await expect(
      confirmStoryboard({
        ...stores,
        storyboardStore: failingStoryboardStore,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-segment-failure",
          decision: "allow",
          raw: { decision: "allow" },
        }),
      }),
    ).rejects.toThrow("segment insert failed");

    expect(stores.storyboardStore.listStoryboards()[0]).toMatchObject({
      status: "draft",
      finalPromptSnapshot: null,
    });
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
  });

  it("reuses existing segments when retrying after storyboard confirmation fails", async () => {
    const stores = createStores();
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:confirm-failure-retry",
    });
    let shouldFailConfirm = true;
    const flakyStoryboardStore = {
      ...stores.storyboardStore,
      async confirmStoryboard(input: {
        storyboardId: string;
        finalPromptSnapshot: unknown;
      }) {
        if (shouldFailConfirm) {
          shouldFailConfirm = false;
          throw new Error("storyboard confirm failed");
        }

        return stores.storyboardStore.confirmStoryboard(
          input as Parameters<typeof stores.storyboardStore.confirmStoryboard>[0],
        );
      },
    };

    await expect(
      confirmStoryboard({
        ...stores,
        storyboardStore: flakyStoryboardStore,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-confirm-failure",
          decision: "allow",
          raw: { decision: "allow" },
        }),
      }),
    ).rejects.toThrow("storyboard confirm failed");

    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("draft");
    expect(stores.storyboardStore.listSegments()).toHaveLength(2);

    const result = await confirmStoryboard({
      ...stores,
      storyboardStore: flakyStoryboardStore,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-confirm-retry",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(result).toMatchObject({
      status: "segments_queued",
      segmentCount: 2,
    });
    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("confirmed");
    expect(stores.storyboardStore.listSegments()).toHaveLength(2);
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
  });

  it("resumes a confirmed storyboard with existing segments after final status transition failure", async () => {
    const stores = createStores();
    await grantTrialCredits({
      store: stores.creditStore,
      userId,
      amount: 200,
      reason: "test setup",
      idempotencyKey: "grant:confirmed-retry-gap",
    });
    const failingJobStore = {
      ...stores.jobStore,
      async createStateEvent(
        input: Parameters<typeof stores.jobStore.createStateEvent>[0],
      ) {
        if (input.toStatus === "segments_queued") {
          throw new Error("segments queued event failed");
        }

        return stores.jobStore.createStateEvent(input);
      },
    };

    await expect(
      confirmStoryboard({
        ...stores,
        jobStore: failingJobStore,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-confirmed-gap",
          decision: "allow",
          raw: { decision: "allow" },
        }),
      }),
    ).rejects.toThrow("segments queued event failed");

    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("confirmed");
    expect(stores.storyboardStore.listSegments()).toHaveLength(2);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("credits_reserved");

    const result = await confirmStoryboard({
      ...stores,
      jobStore: stores.jobStore,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-confirmed-gap-retry",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(result).toMatchObject({
      status: "segments_queued",
      segmentCount: 2,
    });
    expect(stores.storyboardStore.listSegments()).toHaveLength(2);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
    expect(stores.creditStore.listLedger().map((entry) => entry.type)).toEqual([
      "trial_grant",
      "reserve",
    ]);
  });

  it("rejects a confirmed storyboard with no segments", async () => {
    const stores = createStores();
    await grantPaidJobCredits(stores);
    await markStoryboardConfirmed(stores);

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: allowModeration,
      }),
    ).rejects.toThrow(
      "Confirmed storyboard is missing complete video segments.",
    );

    expect(stores.storyboardStore.listSegments()).toHaveLength(0);
  });

  it("rejects a confirmed storyboard with partial segments", async () => {
    const stores = createStores();
    await grantPaidJobCredits(stores);
    await markStoryboardConfirmed(stores);
    await seedExistingSegments(stores.storyboardStore, [segmentInput(0)]);

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: allowModeration,
      }),
    ).rejects.toThrow(
      "Confirmed storyboard is missing complete video segments.",
    );

    expect(stores.storyboardStore.listSegments()).toHaveLength(1);
  });

  it("rejects a draft storyboard with partial existing segments", async () => {
    const stores = createStores();
    await grantPaidJobCredits(stores);
    await seedExistingSegments(stores.storyboardStore, [segmentInput(0)]);

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: allowModeration,
      }),
    ).rejects.toThrow("Existing storyboard segments are incomplete.");

    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("draft");
    expect(stores.storyboardStore.listSegments()).toHaveLength(1);
  });

  it("rejects existing storyboard segments with unexpected indexes", async () => {
    const stores = createStores();
    await grantPaidJobCredits(stores);
    await seedExistingSegments(stores.storyboardStore, [
      segmentInput(0),
      segmentInput(1),
      segmentInput(2, "front_pan"),
    ]);

    await expect(
      confirmStoryboard({
        ...stores,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: allowModeration,
      }),
    ).rejects.toThrow("Existing storyboard segments are incomplete.");

    expect(stores.storyboardStore.listStoryboards()[0]?.status).toBe("draft");
    expect(stores.storyboardStore.listSegments()).toHaveLength(3);
  });

  it("requeries and reuses complete segments when segment creation returns empty after a conflict", async () => {
    const stores = createStores();
    await grantPaidJobCredits(stores);
    let createAttempts = 0;
    const conflictStoryboardStore = {
      ...stores.storyboardStore,
      async createVideoSegments(input: NewVideoSegmentRecord[]) {
        createAttempts += 1;
        await seedExistingSegments(stores.storyboardStore, input);
        return [] as VideoSegmentRecord[];
      },
    };

    const result = await confirmStoryboard({
      ...stores,
      storyboardStore: conflictStoryboardStore,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: allowModeration,
    });

    expect(result).toMatchObject({
      status: "segments_queued",
      segmentCount: 2,
    });
    expect(createAttempts).toBe(1);
    expect(stores.storyboardStore.listSegments()).toEqual([
      expect.objectContaining({ segmentIndex: 0 }),
      expect.objectContaining({ segmentIndex: 1 }),
    ]);
    expect(stores.storyboardStore.listSegments()).toHaveLength(2);
  });

  it("allows trial jobs with zero credit cost to confirm storyboard without reserving credits", async () => {
    const stores = createStores();
    const trialStoryboardStore = createInMemoryStoryboardConfirmationStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "storyboard_draft_ready",
          durationSeconds: 8,
          creditCost: 0,
          billingMode: "free_trial",
          generationProfile: "trial_540p_watermarked",
          watermarkEnabled: true,
          isTest: false,
        },
      ],
      jobAssets: [
        {
          videoJobId: jobId,
          assetId: "asset-front",
          role: "front",
          sortOrder: 0,
        },
      ],
      storyboards: [
        {
          id: storyboardId,
          videoJobId: jobId,
          version: 1,
          status: "draft",
          selectedTemplateIds: ["front_push_in"],
          storyboardJson: {
            duration_seconds: 8,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "front_push_in",
                prompt: "Slow push-in on the front garment.",
              },
            ],
          },
          finalPromptSnapshot: null,
          providerCallLogId: null,
          confirmedAt: null,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    });

    const result = await confirmStoryboard({
      ...stores,
      storyboardStore: trialStoryboardStore,
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-trial",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });

    expect(result).toEqual({
      jobId,
      storyboardId,
      status: "segments_queued",
      reservedLedgerId: null,
      segmentCount: 1,
    });
    expect(stores.creditStore.listLedger()).toHaveLength(0);
    expect(trialStoryboardStore.listStoryboards()[0]).toMatchObject({
      status: "confirmed",
    });
    expect(trialStoryboardStore.listSegments()).toEqual([
      expect.objectContaining({
        videoJobId: jobId,
        storyboardId,
        segmentIndex: 0,
        status: "queued",
        generationProfile: "trial_540p_watermarked",
        resolution: "540p",
        audioEnabled: false,
        watermarkEnabled: true,
      }),
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
  });

  it("rejects non trial-allowed templates when confirming a free trial storyboard", async () => {
    const stores = createStores();
    const trialStoryboardStore = createInMemoryStoryboardConfirmationStore({
      jobs: [
        {
          id: jobId,
          userId,
          status: "storyboard_draft_ready",
          durationSeconds: 8,
          creditCost: 0,
          billingMode: "free_trial",
          generationProfile: "trial_540p_watermarked",
          watermarkEnabled: true,
          isTest: false,
        },
      ],
      jobAssets: [
        {
          videoJobId: jobId,
          assetId: "asset-front",
          role: "front",
          sortOrder: 0,
        },
      ],
      storyboards: [
        {
          id: storyboardId,
          videoJobId: jobId,
          version: 1,
          status: "draft",
          selectedTemplateIds: ["fabric_macro"],
          storyboardJson: {
            duration_seconds: 8,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "fabric_macro",
                prompt: "Macro detail shot.",
              },
            ],
          },
          finalPromptSnapshot: null,
          providerCallLogId: null,
          confirmedAt: null,
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    });

    await expect(
      confirmStoryboard({
        ...stores,
        storyboardStore: trialStoryboardStore,
        jobId,
        userId,
        storyboardId,
        moderatePrompt: async () => ({
          id: "mod-trial",
          decision: "allow",
          raw: { decision: "allow" },
        }),
      }),
    ).rejects.toThrow("Free trial storyboard contains non trial-allowed templates.");

    expect(trialStoryboardStore.listSegments()).toHaveLength(0);
    expect(trialStoryboardStore.listStoryboards()[0]?.status).toBe("draft");
  });
});
