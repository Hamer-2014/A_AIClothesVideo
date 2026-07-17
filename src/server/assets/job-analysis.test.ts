import { describe, expect, it } from "vitest";

import type { JsonValue } from "@/lib/db/schema/common";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  analyzeVideoJobAssets,
  createInMemoryVideoJobAssetStore,
} from "./job-analysis";
import { createInMemoryAssetAnalysisStore } from "./analyze";
import { createInMemoryAssetConsistencyStore } from "./consistency";

const jobId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

describe("video job asset analysis", () => {
  it("runs ordered task-local consistency for human-model views", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const consistencyStore = createInMemoryAssetConsistencyStore();
    const seenInputs: Array<{
      expectedSubjectKind: string;
      declaredRoles: string[];
    }> = [];

    const result = await analyzeVideoJobAssets({
      jobStore,
      jobAssetStore: createInMemoryVideoJobAssetStore(
        ["front", "side", "back"].map((role, sortOrder) => ({
          assetId: `model-${role}`,
          originalKey: `${role}.jpg`,
          role,
          sortOrder,
        })),
      ),
      analysisStore: createInMemoryAssetAnalysisStore(),
      assetConsistencyStore: consistencyStore,
      providerCallLogStore: createInMemoryProviderCallLogStore(),
      jobId,
      userId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      createDownloadSignedUrl: async ({ key }) =>
        `https://signed.example/${key}`,
      visionProvider: async ({ imageUrls }) => {
        const role = imageUrls[0]?.split("/").at(-1)?.replace(".jpg", "") ??
          "front";
        return {
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson: {
            asset_role: role,
            garment_category: "dress",
            view_angle: role,
            human_present: "yes",
            subject_kind: "human_model",
            visible_details: [`${role}_shape`],
            not_visible_details: [],
            quality: {
              is_garment: true,
              is_clear: true,
              is_safe: true,
              has_flat_lay_or_white_background: false,
            },
            confidence: "high",
            risk_flags: [],
          },
          raw: { id: role },
        };
      },
      consistencyProvider: async (input) => {
        seenInputs.push(input);
        return {
          provider: "openai",
          model: "gpt-5.4",
          consistencyJson: {
            garment_match: "pass",
            model_match: "pass",
            color_match: true,
            pattern_match: true,
            view_coverage: input.declaredRoles,
            confidence: "0.95",
            risk_flags: [],
          },
          raw: { id: "model-consistency" },
        };
      },
    });

    expect(seenInputs).toEqual([
      expect.objectContaining({
        expectedSubjectKind: "human_model",
        declaredRoles: ["front", "side", "back"],
      }),
    ]);
    expect(result.assetCompleteness).toMatchObject({
      hasModelFront: true,
      hasModelSide: true,
      hasModelBack: true,
      modelGarmentConsistency: "pass",
      modelConsistency: "pass",
    });
    expect(consistencyStore.listAnalyses()[0]).toMatchObject({
      analysisKind: "model_views",
      status: "passed",
    });
  });

  it("runs ordered product-view consistency and unlocks half rotation", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const providerCallLogStore = createInMemoryProviderCallLogStore();
    const consistencyStore = createInMemoryAssetConsistencyStore();
    const seenConsistencyInputs: Array<{
      imageUrls: string[];
      declaredRoles: string[];
    }> = [];

    const result = await analyzeVideoJobAssets({
      jobStore,
      jobAssetStore: createInMemoryVideoJobAssetStore([
        {
          assetId: "asset-front",
          originalKey: "front.jpg",
          role: "front",
          sortOrder: 0,
        },
        {
          assetId: "asset-side",
          originalKey: "side.jpg",
          role: "side",
          sortOrder: 1,
        },
        {
          assetId: "asset-back",
          originalKey: "back.jpg",
          role: "back",
          sortOrder: 2,
        },
      ]),
      analysisStore: createInMemoryAssetAnalysisStore(),
      assetConsistencyStore: consistencyStore,
      providerCallLogStore,
      jobId,
      userId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      createDownloadSignedUrl: async ({ key }) =>
        `https://signed.example/${key}`,
      visionProvider: async ({ imageUrls }) => {
        const role = imageUrls[0]?.includes("side")
          ? "side"
          : imageUrls[0]?.includes("back")
            ? "back"
            : "front";

        return {
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson: {
            asset_role: role,
            garment_category: "dress",
            view_angle: role,
            human_present: "no",
            subject_kind: "product",
            visible_details: [`${role}_shape`],
            not_visible_details: [],
            quality: {
              is_garment: true,
              is_clear: true,
              is_safe: true,
              has_flat_lay_or_white_background: role === "front",
            },
            confidence: "high",
            risk_flags: [],
          },
          raw: { id: role },
        };
      },
      consistencyProvider: async (input) => {
        seenConsistencyInputs.push(input);
        return {
          provider: "openai",
          model: "gpt-5.4",
          consistencyJson: {
            garment_match: "pass",
            model_match: "not_applicable",
            color_match: true,
            pattern_match: true,
            view_coverage: input.declaredRoles,
            confidence: "0.96",
            risk_flags: [],
          },
          raw: { id: "consistency-1" },
        };
      },
    });

    expect(seenConsistencyInputs[0]?.declaredRoles).toEqual([
      "front",
      "side",
      "back",
    ]);
    expect(seenConsistencyInputs[0]?.imageUrls).toEqual([
      "https://signed.example/front.jpg",
      "https://signed.example/side.jpg",
      "https://signed.example/back.jpg",
    ]);
    expect(result.recommendations.availableTemplateIds).toContain(
      "product_half_rotation",
    );
    expect(result.assetCompleteness.garmentConsistency).toBe("pass");
    expect(consistencyStore.listAnalyses()).toHaveLength(1);
    expect(JSON.stringify(providerCallLogStore.listCallLogs())).not.toContain(
      "https://signed.example",
    );
  });

  it("analyzes assets attached to a job and stores linked provider logs", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const jobAssetStore = createInMemoryVideoJobAssetStore([
      {
        assetId: "asset-front",
        originalKey: "users/user-1/assets/asset-front/original.jpg",
        role: "front",
        sortOrder: 0,
      },
      {
        assetId: "asset-back",
        originalKey: "users/user-1/assets/asset-back/original.jpg",
        role: "back",
        sortOrder: 1,
      },
    ]);
    const analysisStore = createInMemoryAssetAnalysisStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();
    const funnelStore = createInMemoryFunnelEventStore();

    const result = await analyzeVideoJobAssets({
      jobStore,
      jobAssetStore,
      analysisStore,
      assetConsistencyStore: createInMemoryAssetConsistencyStore(),
      providerCallLogStore,
      jobId,
      userId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      funnelEventStore: funnelStore,
      createDownloadSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async ({ imageUrls }) => {
        const isBack = imageUrls[0]?.includes("asset-back");
        return {
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson: {
            asset_role: isBack ? "back" : "front",
            garment_category: "dress",
            view_angle: isBack ? "back" : "front",
            human_present: "no",
            visible_details: isBack ? ["back_shape"] : ["front_shape"],
            not_visible_details: [],
            quality: {
              is_garment: true,
              is_clear: true,
              is_safe: true,
              has_flat_lay_or_white_background: !isBack,
            },
            confidence: "high",
            risk_flags: [],
          },
          raw: { id: isBack ? "back" : "front" },
        };
      },
    });

    expect(analysisStore.listAnalyses()).toHaveLength(2);
    expect(providerCallLogStore.listCallLogs()).toHaveLength(3);
    expect(providerCallLogStore.listCallLogs()[2]).toMatchObject({
      purpose: "strict_asset_review",
      status: "failed",
    });
    expect(result.assetCompleteness.hasFront).toBe(true);
    expect(result.assetCompleteness.hasBack).toBe(true);
    expect(result.recommendations.availableTemplateIds).toContain("back_display");
    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "asset_analysis_passed",
      userVisibleStatus: "assets_ready",
      failureReason: null,
      lastError: null,
      lockedBy: null,
      lockedUntil: null,
    });
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "asset_analysis_passed",
        source: "server",
        userId,
        metadata: expect.objectContaining({
          jobId,
          status: "asset_analysis_passed",
        }),
      }),
    ]);
  });

  it("preserves user fixed-slot roles when vision role detection is lower confidence", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const jobAssetStore = createInMemoryVideoJobAssetStore([
      {
        assetId: "asset-front",
        originalKey: "users/user-1/assets/asset-front/original.jpg",
        role: "front",
        sortOrder: 0,
      },
      {
        assetId: "asset-back",
        originalKey: "users/user-1/assets/asset-back/original.jpg",
        role: "back",
        sortOrder: 1,
      },
      {
        assetId: "asset-detail",
        originalKey: "users/user-1/assets/asset-detail/original.jpg",
        role: "detail",
        sortOrder: 2,
      },
    ]);

    const result = await analyzeVideoJobAssets({
      jobStore,
      jobAssetStore,
      analysisStore: createInMemoryAssetAnalysisStore(),
      assetConsistencyStore: createInMemoryAssetConsistencyStore(),
      providerCallLogStore: createInMemoryProviderCallLogStore(),
      jobId,
      userId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      createDownloadSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async () => ({
        provider: "openai",
        model: "gpt-5.4-mini",
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
            has_flat_lay_or_white_background: false,
          },
          confidence: "low",
          risk_flags: ["role_uncertain"],
        },
        raw: { id: "misclassified" },
      }),
    });

    expect(result.assetCompleteness.hasFront).toBe(true);
    expect(result.assetCompleteness.hasBack).toBe(true);
    expect(result.assetCompleteness.hasDetail).toBe(true);
    expect(result.recommendations.availableTemplateIds).toContain("back_display");
    expect(result.recommendations.availableTemplateIds).toContain("fabric_macro");
  });

  it("uses the job asset declared scene role when provider returns a natural language non-garment role", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const analysisStore = createInMemoryAssetAnalysisStore();

    const result = await analyzeVideoJobAssets({
      jobStore,
      jobAssetStore: createInMemoryVideoJobAssetStore([
        {
          assetId: "asset-front",
          originalKey: "users/user-1/assets/asset-front/original.jpg",
          role: "front",
          sortOrder: 0,
        },
        {
          assetId: "asset-scene",
          originalKey: "users/user-1/assets/asset-scene/original.jpg",
          role: "scene",
          sortOrder: 1,
        },
      ]),
      analysisStore,
      providerCallLogStore: createInMemoryProviderCallLogStore(),
      jobId,
      userId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      createDownloadSignedUrl: async ({ key }) => `https://signed.example/${key}`,
      visionProvider: async ({ imageUrls }) => {
        const isScene = imageUrls[0]?.includes("asset-scene");
        const analysisJson: JsonValue = isScene
          ? {
              asset_role:
                "Unclear/not a garment; appears to be studio lighting equipment used for product photography",
              garment_category: "unknown",
              view_angle: "studio setup",
              human_present: "no",
              visible_details: ["studio lighting equipment"],
              not_visible_details: ["garment details"],
              quality: {
                is_garment: false,
                is_clear: true,
                is_safe: true,
              },
              confidence: "low",
              risk_flags: ["not_a_garment"],
            }
          : {
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
            };

        return {
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson,
          raw: { id: isScene ? "scene" : "front" },
        };
      },
    });

    expect(analysisStore.listAnalyses().map((analysis) => analysis.assetRole)).toEqual([
      "front",
      "scene",
    ]);
    expect(result.assetCompleteness.hasScene).toBe(true);
    expect(result.recommendations.availableTemplateIds).toContain(
      "scene_lifestyle_showcase",
    );
  });

  it("rejects analysis when the job does not belong to the user", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId: "different-user",
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    await expect(
      analyzeVideoJobAssets({
        jobStore,
        jobAssetStore: createInMemoryVideoJobAssetStore([]),
        analysisStore: createInMemoryAssetAnalysisStore(),
        providerCallLogStore: createInMemoryProviderCallLogStore(),
        jobId,
        userId,
        mode: "standard",
        templates: mvpShotTemplates,
        isTrial: false,
        createDownloadSignedUrl: async () => "https://signed.example/asset.jpg",
        visionProvider: async () => {
          throw new Error("must not call provider");
        },
      }),
    ).rejects.toThrow("Video job not found for user.");
  });

  it("fails closed when a job has no attached assets", async () => {
    const funnelStore = createInMemoryFunnelEventStore();
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    await expect(
      analyzeVideoJobAssets({
        jobStore,
        jobAssetStore: createInMemoryVideoJobAssetStore([]),
        analysisStore: createInMemoryAssetAnalysisStore(),
        providerCallLogStore: createInMemoryProviderCallLogStore(),
        jobId,
        userId,
        mode: "standard",
        templates: mvpShotTemplates,
        isTrial: false,
        funnelEventStore: funnelStore,
        createDownloadSignedUrl: async () => "https://signed.example/asset.jpg",
        visionProvider: async () => {
          throw new Error("must not call provider");
        },
      }),
    ).rejects.toThrow("Video job has no attached assets.");

    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "asset_analysis_failed",
      userVisibleStatus: "failed",
      failureReason: "Video job has no attached assets.",
      lastError: "Video job has no attached assets.",
    });
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "asset_analysis_failed",
        source: "server",
        userId,
        metadata: expect.objectContaining({
          jobId,
          status: "asset_analysis_failed",
          reasonCategory: "asset_analysis",
        }),
      }),
    ]);
  });

  it("stores a readable retry message when the vision provider network fetch fails", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      analyzeVideoJobAssets({
        jobStore,
        jobAssetStore: createInMemoryVideoJobAssetStore([
          {
            assetId: "asset-front",
            originalKey: "users/user-1/assets/asset-front/original.jpg",
            role: "front",
            sortOrder: 0,
          },
        ]),
        analysisStore: createInMemoryAssetAnalysisStore(),
        providerCallLogStore,
        jobId,
        userId,
        mode: "lite",
        templates: mvpShotTemplates,
        isTrial: true,
        createDownloadSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        visionProvider: async () => {
          throw new Error("fetch failed");
        },
      }),
    ).rejects.toThrow("fetch failed");

    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "asset_analysis_failed",
      userVisibleStatus: "failed",
      failureReason: "素材分析服务网络连接失败，请稍后重试。",
      lastError: "素材分析服务网络连接失败，请稍后重试。",
    });
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      videoJobId: jobId,
      errorMessage: "fetch failed",
    });
  });

  it("stores a Chinese retry message when provider schema output is invalid", async () => {
    const jobStore = createInMemoryJobStore([
      {
        id: jobId,
        userId,
        status: "asset_analysis_queued",
        lockedBy: null,
        lockedUntil: null,
        attemptCount: 0,
        lastError: null,
      },
    ]);

    await expect(
      analyzeVideoJobAssets({
        jobStore,
        jobAssetStore: createInMemoryVideoJobAssetStore([
          {
            assetId: "asset-front",
            originalKey: "users/user-1/assets/asset-front/original.jpg",
            role: "front",
            sortOrder: 0,
          },
        ]),
        analysisStore: createInMemoryAssetAnalysisStore(),
        providerCallLogStore: createInMemoryProviderCallLogStore(),
        jobId,
        userId,
        mode: "standard",
        templates: mvpShotTemplates,
        isTrial: false,
        createDownloadSignedUrl: async ({ key }) => `https://signed.example/${key}`,
        visionProvider: async () => ({
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson: {
            asset_role: "not-a-role",
            garment_category: "dress",
            view_angle: "front",
            human_present: "no",
            visible_details: [],
            not_visible_details: [],
            quality: { is_garment: true, is_clear: true, is_safe: true },
            confidence: "low",
            risk_flags: [],
          },
          raw: { id: "bad-role" },
        }),
      }),
    ).rejects.toThrow("Asset analysis JSON has invalid asset_role.");

    expect(jobStore.listJobs()[0]).toMatchObject({
      status: "asset_analysis_failed",
      failureReason: "素材分析结果格式异常，请重新选择图片或稍后重试。",
      lastError: "素材分析结果格式异常，请重新选择图片或稍后重试。",
    });
  });
});
