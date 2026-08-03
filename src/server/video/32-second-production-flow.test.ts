import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { grantTrialCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryModerationResultStore } from "@/server/moderation/results";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import {
  createInMemoryStitchStore,
  createStitchJobForVideo,
} from "@/server/stitch/jobs";
import {
  confirmStoryboard,
  createInMemoryStoryboardConfirmationStore,
} from "@/server/storyboard/confirm";

const userId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const storyboardId = "44444444-4444-4444-8444-444444444444";
const originalAppUrl = process.env.APP_URL;
const templateIds = [
  "front_push_in",
  "front_pan",
  "front_crop_detail",
  "minimal_studio",
];

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
});

afterEach(() => {
  process.env.APP_URL = originalAppUrl;
});

describe("32-second production flow", () => {
  it("confirms four ordered segments and carries them into the stitch payload", async () => {
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
          durationSeconds: 32,
          creditCost: 250,
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
          selectedTemplateIds: templateIds,
          presetId: "minimal_studio",
          presetSnapshot: null,
          storyboardJson: {
            duration_seconds: 32,
            segments: templateIds.map((templateId, index) => ({
              index,
              duration_seconds: 8,
              template_id: templateId,
              prompt: `Preserve the garment in ordered shot ${index + 1}.`,
            })),
          },
          finalPromptSnapshot: null,
          providerCallLogId: null,
          confirmedAt: null,
          createdAt: new Date("2026-08-03T00:00:00.000Z"),
          updatedAt: new Date("2026-08-03T00:00:00.000Z"),
        },
      ],
    });
    const creditStore = createInMemoryCreditLedgerStore();
    await grantTrialCredits({
      store: creditStore,
      userId,
      amount: 300,
      reason: "32-second production flow test",
      idempotencyKey: "grant:32-second-production-flow",
    });

    const confirmation = await confirmStoryboard({
      jobStore,
      storyboardStore,
      creditStore,
      moderationStore: createInMemoryModerationResultStore(),
      jobId,
      userId,
      storyboardId,
      moderatePrompt: async () => ({
        id: "mod-allow-32-second-flow",
        decision: "allow",
        raw: { decision: "allow" },
      }),
    });
    const confirmedSegments = storyboardStore.listSegments();

    expect(confirmation).toMatchObject({
      status: "segments_queued",
      segmentCount: 4,
      reservedLedgerId: expect.any(String),
    });
    expect(creditStore.listLedger()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "reserve",
          amount: 250,
          relatedJobId: jobId,
        }),
      ]),
    );
    expect(confirmedSegments.map((segment) => segment.segmentIndex)).toEqual([
      0, 1, 2, 3,
    ]);

    await jobStore.updateJobStatus(jobId, { status: "segment_succeeded" });
    const stitchStore = createInMemoryStitchStore({
      jobs: [
        {
          id: jobId,
          status: "segment_succeeded",
          durationSeconds: 32,
          isTest: false,
          postQaMode: "standard",
        },
      ],
      segments: confirmedSegments.map((segment) => ({
        id: segment.id,
        videoJobId: jobId,
        segmentIndex: segment.segmentIndex,
        status: "succeeded",
        videoKey: `jobs/${jobId}/segments/${segment.id}/video.mp4`,
      })),
    });

    const stitchPayload = await createStitchJobForVideo({
      jobStore,
      stitchStore,
      jobId,
    });

    expect(stitchPayload).toMatchObject({
      segmentCount: 4,
      postQaMode: "standard",
      segmentKeys: confirmedSegments.map(
        (segment) => `jobs/${jobId}/segments/${segment.id}/video.mp4`,
      ),
    });
  });
});
