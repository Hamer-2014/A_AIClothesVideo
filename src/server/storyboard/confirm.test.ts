import { describe, expect, it } from "vitest";

import { grantTrialCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryModerationResultStore } from "@/server/moderation/results";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  confirmStoryboard,
  createInMemoryStoryboardConfirmationStore,
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

describe("confirmStoryboard", () => {
  it("moderates the final prompt, reserves credits, confirms storyboard, and creates video segments", async () => {
    const stores = createStores();
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
      moderatePrompt: async () => ({
        id: "mod-1",
        decision: "allow",
        raw: { decision: "allow" },
      }),
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
        durationSeconds: 16,
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
      },
    });
    expect(stores.storyboardStore.listSegments()).toEqual([
      expect.objectContaining({
        videoJobId: jobId,
        storyboardId,
        segmentIndex: 0,
        status: "queued",
        templateId: "front_push_in",
        prompt: "Slow push-in on the front garment.",
        isTest: false,
      }),
      expect.objectContaining({
        videoJobId: jobId,
        storyboardId,
        segmentIndex: 1,
        status: "queued",
        templateId: "front_pan",
        prompt: "Gentle pan across the front garment.",
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
      }),
    ]);
    expect(stores.jobStore.listJobs()[0]?.status).toBe("segments_queued");
  });
});
