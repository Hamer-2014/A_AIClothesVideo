import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { createInMemoryVideoJobReadStore } from "@/server/jobs/get-job";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";
import { createInMemoryModerationResultStore } from "@/server/moderation/results";

import {
  createInMemoryStoryboardStore,
  generateStoryboardDraft,
} from "./generate";

const jobId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function createReadStore() {
  return createInMemoryVideoJobReadStore({
    jobs: [
      {
        id: jobId,
        userId,
        status: "asset_analysis_passed",
        userVisibleStatus: "assets_ready",
        lastError: null,
        failureReason: null,
        durationSeconds: 8,
        aspectRatio: "9:16",
        creditCost: 0,
        billingMode: "free_trial",
        generationProfile: "trial_540p_watermarked",
        watermarkEnabled: true,
      },
    ],
    assets: [{ assetId: "asset-front", role: "front", sortOrder: 0 }],
    analyses: [
      {
        assetId: "asset-front",
        analysisJson: {
          asset_role: "front",
          garment_category: "dress",
          view_angle: "front",
          human_present: "no",
          visible_details: ["front_shape"],
          not_visible_details: [],
          quality: {
            is_garment: true,
            is_clear: true,
            is_safe: true,
            has_flat_lay_or_white_background: true,
          },
          confidence: "high",
          risk_flags: [],
        },
      },
    ],
  });
}

describe("generate storyboard draft", () => {
  it("moderates user input, calls DeepSeek, logs provider call, and stores draft", async () => {
    const storyboardStore = createInMemoryStoryboardStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();
    const moderationResultStore = createInMemoryModerationResultStore();
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_passed",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    const result = await generateStoryboardDraft({
      jobReadStore: createReadStore(),
      jobStore,
      storyboardStore,
      providerCallLogStore,
      moderationResultStore,
      jobId,
      userId,
      selectedTemplateIds: ["front_push_in"],
      userPrompt: "Show the front shape cleanly.",
      templates: mvpShotTemplates,
      moderatePrompt: async () => ({
        id: "mod_1",
        decision: "allow",
        raw: { id: "mod_1" },
      }),
      createStoryboard: async () => ({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        storyboardJson: {
          duration_seconds: 8,
          segments: [
            {
              index: 0,
              duration_seconds: 8,
              template_id: "front_push_in",
              prompt: "Slow front push-in.",
            },
          ],
        },
        raw: { id: "chatcmpl_storyboard" },
      }),
    });

    expect(result.storyboard.status).toBe("draft");
    expect(storyboardStore.listStoryboards()).toHaveLength(1);
    expect(storyboardStore.listStoryboards()[0]).toMatchObject({
      videoJobId: jobId,
      selectedTemplateIds: ["front_push_in"],
      providerCallLogId: providerCallLogStore.listCallLogs()[0]?.id,
    });
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      purpose: "storyboard",
      status: "succeeded",
    });
    expect(moderationResultStore.listResults()[0]).toMatchObject({
      decision: "allow",
      source: "user_input",
    });
    expect(jobStore.listJobs()[0]?.status).toBe("storyboard_draft_ready");
  });

  it("blocks unavailable templates before calling DeepSeek", async () => {
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      generateStoryboardDraft({
        jobReadStore: createReadStore(),
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "asset_analysis_passed",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 0,
            lastError: null,
          },
        ]),
        storyboardStore: createInMemoryStoryboardStore(),
        providerCallLogStore,
        moderationResultStore: createInMemoryModerationResultStore(),
        jobId,
        userId,
        selectedTemplateIds: ["back_display"],
        userPrompt: "Show back view.",
        templates: mvpShotTemplates,
        moderatePrompt: async () => {
          throw new Error("must not moderate");
        },
        createStoryboard: async () => {
          throw new Error("must not call DeepSeek");
        },
      }),
    ).rejects.toThrow("Selected template is not available for this job: back_display.");

    expect(providerCallLogStore.listCallLogs()).toHaveLength(0);
  });

  it("fails closed when prompt moderation blocks input", async () => {
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      generateStoryboardDraft({
        jobReadStore: createReadStore(),
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "asset_analysis_passed",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 0,
            lastError: null,
          },
        ]),
        storyboardStore: createInMemoryStoryboardStore(),
        providerCallLogStore,
        moderationResultStore: createInMemoryModerationResultStore(),
        jobId,
        userId,
        selectedTemplateIds: ["front_push_in"],
        userPrompt: "Unsafe prompt.",
        templates: mvpShotTemplates,
        moderatePrompt: async () => ({
          id: "mod_2",
          decision: "deny",
          raw: { id: "mod_2" },
        }),
        createStoryboard: async () => {
          throw new Error("must not call DeepSeek");
        },
      }),
    ).rejects.toThrow("Prompt moderation blocked storyboard generation.");

    expect(providerCallLogStore.listCallLogs()).toHaveLength(0);
  });

  it("does not create a fake DeepSeek failure when storyboard persistence fails", async () => {
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      generateStoryboardDraft({
        jobReadStore: createReadStore(),
        jobStore: createInMemoryJobStore([
          {
            id: jobId,
            userId,
            status: "asset_analysis_passed",
            lockedBy: null,
            lockedUntil: null,
            attemptCount: 0,
            lastError: null,
          },
        ]),
        storyboardStore: {
          async createStoryboard() {
            throw new Error("database unavailable");
          },
        },
        providerCallLogStore,
        moderationResultStore: createInMemoryModerationResultStore(),
        jobId,
        userId,
        selectedTemplateIds: ["front_push_in"],
        userPrompt: "Show front view.",
        templates: mvpShotTemplates,
        moderatePrompt: async () => ({
          id: "mod_3",
          decision: "allow",
          raw: { id: "mod_3" },
        }),
        createStoryboard: async () => ({
          provider: "deepseek",
          model: "deepseek-v4-flash",
          storyboardJson: {
            duration_seconds: 8,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "front_push_in",
                prompt: "Slow front push-in.",
              },
            ],
          },
          raw: { id: "chatcmpl_storyboard" },
        }),
      }),
    ).rejects.toThrow("database unavailable");

    expect(providerCallLogStore.listCallLogs()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      status: "succeeded",
    });
  });
});
