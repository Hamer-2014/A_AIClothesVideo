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
        presetId: null,
        presetSnapshot: null,
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

  it("sends asset summary and selected template definitions to DeepSeek", async () => {
    const capturedPrompts: string[] = [];
    const readStore = createInMemoryVideoJobReadStore({
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
          presetId: null,
          presetSnapshot: null,
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        },
      ],
      assets: [
        { assetId: "asset-front", role: "front", sortOrder: 0 },
        { assetId: "asset-scene", role: "scene", sortOrder: 1 },
      ],
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
            },
            confidence: "high",
            risk_flags: [],
          },
        },
        {
          assetId: "asset-scene",
          analysisJson: {
            asset_role: "background scene",
            garment_category: "unknown",
            view_angle: "scene",
            human_present: "no",
            visible_details: ["street background"],
            not_visible_details: ["garment"],
            quality: {
              is_garment: false,
              is_clear: true,
              is_safe: true,
            },
            confidence: "high",
            risk_flags: [],
          },
        },
      ],
    });

    await generateStoryboardDraft({
      jobReadStore: readStore,
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
      providerCallLogStore: createInMemoryProviderCallLogStore(),
      moderationResultStore: createInMemoryModerationResultStore(),
      jobId,
      userId,
      selectedTemplateIds: ["scene_lifestyle_showcase"],
      userPrompt: "Use the uploaded street scene as background.",
      templates: mvpShotTemplates,
      moderatePrompt: async () => ({
        id: "mod-scene",
        decision: "allow",
        raw: { id: "mod-scene" },
      }),
      createStoryboard: async (input) => {
        capturedPrompts.push(input.userPrompt);
        return {
          provider: "deepseek",
          model: "deepseek-v4-flash",
          storyboardJson: {
            duration_seconds: 8,
            segments: [
              {
                index: 0,
                duration_seconds: 8,
                template_id: "scene_lifestyle_showcase",
                prompt: "Use image 1 as garment reference and image 2 as scene reference.",
              },
            ],
          },
          raw: { id: "chatcmpl_scene_storyboard" },
        };
      },
    });

    const prompt = JSON.parse(capturedPrompts[0] ?? "{}");
    expect(prompt.asset_summary).toMatchObject({
      has_front: true,
      has_scene: true,
      scene_usage: "background/reference only",
    });
    expect(prompt.selected_template_definitions).toEqual([
      expect.objectContaining({
        template_id: "scene_lifestyle_showcase",
        required_assets: ["front", "scene"],
        base_prompt_intent: expect.stringContaining("scene image"),
        system_constraints: expect.arrayContaining([
          expect.stringContaining("scene image only as background"),
        ]),
      }),
    ]);
  });

  it("sends system-owned global constraints and user intent to DeepSeek", async () => {
    const capturedPrompts: string[] = [];

    await generateStoryboardDraft({
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
      providerCallLogStore: createInMemoryProviderCallLogStore(),
      moderationResultStore: createInMemoryModerationResultStore(),
      jobId,
      userId,
      selectedTemplateIds: ["front_push_in"],
      userPrompt: "想要高级独立站商品页风格，突出裙摆廓形和面料质感，不要真人走秀。",
      templates: mvpShotTemplates,
      moderatePrompt: async () => ({
        id: "mod-global-intent",
        decision: "allow",
        raw: { id: "mod-global-intent" },
      }),
      createStoryboard: async (input) => {
        capturedPrompts.push(input.userPrompt);
        return {
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
          raw: { id: "chatcmpl_global_intent" },
        };
      },
    });

    const prompt = JSON.parse(capturedPrompts[0] ?? "{}");
    expect(prompt.global_hard_constraints).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Do not invent garment details"),
        expect.stringContaining("Do not show the back side"),
      ]),
    );
    expect(prompt.global_user_intent).toMatchObject({
      styleIntent: "premium clean ecommerce product video",
      sellingPoints: expect.arrayContaining([
        "emphasize visible garment silhouette",
        "emphasize visible fabric texture from the provided garment images",
      ]),
      negativeIntent: expect.arrayContaining(["avoid runway-walk presentation"]),
    });
    expect(prompt.instructions).toEqual(
      expect.arrayContaining([
        "Return only segment prompts.",
        "Do not create, output, or rewrite global constraints.",
        "Every segment prompt must obey global_hard_constraints.",
      ]),
    );
  });

  it("rejects DeepSeek storyboard prompts that violate generated hard constraints", async () => {
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
        providerCallLogStore: createInMemoryProviderCallLogStore(),
        moderationResultStore: createInMemoryModerationResultStore(),
        jobId,
        userId,
        selectedTemplateIds: ["front_push_in"],
        userPrompt: "Show the front shape cleanly.",
        templates: mvpShotTemplates,
        moderatePrompt: async () => ({
          id: "mod-invalid-storyboard",
          decision: "allow",
          raw: { id: "mod-invalid-storyboard" },
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
                prompt: "Turn around to show the back side of the garment.",
              },
            ],
          },
          raw: { id: "chatcmpl_invalid_storyboard" },
        }),
      }),
    ).rejects.toThrow("Storyboard prompt violates global hard constraints.");
  });

  it("rejects Chinese storyboard prompts that ask for unavailable back or detail views", async () => {
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
        providerCallLogStore: createInMemoryProviderCallLogStore(),
        moderationResultStore: createInMemoryModerationResultStore(),
        jobId,
        userId,
        selectedTemplateIds: ["front_push_in"],
        userPrompt: "Show the front shape cleanly.",
        templates: mvpShotTemplates,
        moderatePrompt: async () => ({
          id: "mod-invalid-chinese-storyboard",
          decision: "allow",
          raw: { id: "mod-invalid-chinese-storyboard" },
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
                prompt: "镜头转身展示背面，并做面料细节特写。",
              },
            ],
          },
          raw: { id: "chatcmpl_invalid_chinese_storyboard" },
        }),
      }),
    ).rejects.toThrow("Storyboard prompt violates global hard constraints.");
  });
});
