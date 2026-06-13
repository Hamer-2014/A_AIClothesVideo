import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { mvpShotTemplates } from "@/lib/templates/catalog";

import {
  analyzeAssetWithVisionProvider,
  analyzeAssetFromVisionResult,
  buildRecommendationsFromAnalyses,
  createInMemoryAssetAnalysisStore,
} from "./analyze";
import { parseAssetAnalysisJson } from "./analysis-schema";

const assetId = "11111111-1111-4111-8111-111111111111";

describe("asset analysis workflow service", () => {
  it("stores parsed analysis and returns template recommendations", async () => {
    const store = createInMemoryAssetAnalysisStore();

    const result = await analyzeAssetFromVisionResult({
      store,
      assetId,
      mode: "standard",
      templates: mvpShotTemplates,
      isTrial: false,
      visionJson: {
        asset_role: "front",
        garment_category: "dress",
        view_angle: "front",
        human_present: "no",
        visible_details: ["front_shape"],
        not_visible_details: ["back", "fabric"],
        quality: {
          is_garment: true,
          is_clear: true,
          is_safe: true,
          has_flat_lay_or_white_background: true,
        },
        confidence: "high",
        risk_flags: [],
      },
    });

    expect(store.listAnalyses()).toHaveLength(1);
    expect(store.listAnalyses()[0]).toMatchObject({
      assetId,
      mode: "standard",
      assetRole: "front",
      garmentCategory: "dress",
    });
    expect(result.acceptable).toBe(true);
    expect(result.recommendations.availableTemplateIds).toContain("front_push_in");
    expect(result.recommendations.availableTemplateIds).not.toContain("back_display");
  });

  it("builds recommendations from multiple parsed analyses", () => {
    const analyses = [
      parseAssetAnalysisJson({
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
      }),
      parseAssetAnalysisJson({
        asset_role: "back",
        garment_category: "dress",
        view_angle: "back",
        human_present: "no",
        visible_details: ["back_shape"],
        not_visible_details: [],
        quality: {
          is_garment: true,
          is_clear: true,
          is_safe: true,
        },
        confidence: "high",
        risk_flags: [],
      }),
      parseAssetAnalysisJson({
        asset_role: "detail",
        garment_category: "dress",
        view_angle: "macro",
        human_present: "no",
        visible_details: ["fabric", "print"],
        not_visible_details: [],
        quality: {
          is_garment: true,
          is_clear: true,
          is_safe: true,
        },
        confidence: "medium",
        risk_flags: [],
      }),
    ];

    const result = buildRecommendationsFromAnalyses({
      analyses,
      templates: mvpShotTemplates,
      isTrial: false,
    });

    expect(result.acceptable).toBe(true);
    expect(result.assetCompleteness.hasBack).toBe(true);
    expect(result.assetCompleteness.detailTypes).toEqual(["fabric", "print"]);
    expect(result.recommendations.availableTemplateIds).toContain("back_display");
    expect(result.recommendations.availableTemplateIds).toContain("fabric_macro");
    expect(result.recommendations.availableTemplateIds).toContain("print_closeup");
  });

  it("stores rejected analyses but does not recommend generation templates", async () => {
    const store = createInMemoryAssetAnalysisStore();

    const result = await analyzeAssetFromVisionResult({
      store,
      assetId,
      mode: "lite",
      templates: mvpShotTemplates,
      isTrial: true,
      visionJson: {
        asset_role: "unknown",
        garment_category: "unknown",
        view_angle: "unknown",
        human_present: "unknown",
        visible_details: [],
        not_visible_details: [],
        quality: {
          is_garment: false,
          is_clear: true,
          is_safe: true,
        },
        confidence: "low",
        risk_flags: ["not_garment"],
      },
    });

    expect(result.acceptable).toBe(false);
    expect(result.recommendations.availableTemplateIds).toEqual([]);
    expect(store.listAnalyses()[0]).toMatchObject({
      assetRole: "unknown",
      riskFlags: ["not_garment"],
    });
  });

  it("calls the real vision workflow, logs provider success, and links the analysis record", async () => {
    const analysisStore = createInMemoryAssetAnalysisStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    const result = await analyzeAssetWithVisionProvider({
      analysisStore,
      providerCallLogStore,
      assetId,
      userId: "22222222-2222-4222-8222-222222222222",
      mode: "standard",
      imageUrls: ["https://signed.example/front.jpg"],
      templates: mvpShotTemplates,
      isTrial: false,
      visionProvider: async (input) => ({
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
            has_flat_lay_or_white_background: true,
          },
          confidence: "high",
          risk_flags: [],
        },
        raw: { id: "chatcmpl_test", imageCount: input.imageUrls.length },
      }),
    });

    const [callLog] = providerCallLogStore.listCallLogs();
    const [analysisRecord] = analysisStore.listAnalyses();

    expect(callLog).toMatchObject({
      provider: "openai",
      model: "gpt-5.4-mini",
      purpose: "standard_asset_analysis",
      userId: "22222222-2222-4222-8222-222222222222",
      requestSnapshot: {
        assetId,
        imageCount: 1,
        mode: "standard",
      },
      responseSummary: {
        assetRole: "front",
        confidence: "high",
      },
      status: "succeeded",
    });
    expect(typeof callLog?.durationMs).toBe("number");
    expect(analysisRecord).toMatchObject({
      providerCallLogId: callLog?.id,
      assetRole: "front",
    });
    expect(result.record.providerCallLogId).toBe(callLog?.id);
    expect(result.recommendations.availableTemplateIds).toContain("front_push_in");
  });

  it("logs provider failures and does not store fabricated analysis", async () => {
    const analysisStore = createInMemoryAssetAnalysisStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      analyzeAssetWithVisionProvider({
        analysisStore,
        providerCallLogStore,
        assetId,
        userId: "22222222-2222-4222-8222-222222222222",
        videoJobId: "33333333-3333-4333-8333-333333333333",
        mode: "strict",
        imageUrls: ["https://signed.example/front.jpg"],
        templates: mvpShotTemplates,
        isTrial: false,
        visionProvider: async () => {
          throw new Error("Vision provider failed with status 400.");
        },
      }),
    ).rejects.toThrow("Vision provider failed with status 400.");

    expect(analysisStore.listAnalyses()).toHaveLength(0);
    expect(providerCallLogStore.listCallLogs()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "vision",
      model: "unknown",
      purpose: "strict_asset_review",
      userId: "22222222-2222-4222-8222-222222222222",
      videoJobId: "33333333-3333-4333-8333-333333333333",
      requestSnapshot: {
        assetId,
        imageCount: 1,
        mode: "strict",
      },
      status: "failed",
      errorCode: "vision_provider_error",
      errorMessage: "Vision provider failed with status 400.",
    });
  });

  it("logs provider schema failures with the actual provider and model", async () => {
    const analysisStore = createInMemoryAssetAnalysisStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      analyzeAssetWithVisionProvider({
        analysisStore,
        providerCallLogStore,
        assetId,
        mode: "standard",
        imageUrls: ["https://signed.example/front.jpg"],
        templates: mvpShotTemplates,
        isTrial: false,
        visionProvider: async () => ({
          provider: "openai",
          model: "gpt-5.4-mini",
          analysisJson: {
            asset_role: "front",
          },
          raw: { id: "chatcmpl_bad_schema" },
        }),
      }),
    ).rejects.toThrow(
      "Asset analysis JSON is missing required field: human_present.",
    );

    expect(analysisStore.listAnalyses()).toHaveLength(0);
    expect(providerCallLogStore.listCallLogs()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "openai",
      model: "gpt-5.4-mini",
      purpose: "standard_asset_analysis",
      status: "failed",
      errorCode: "vision_schema_error",
    });
  });

  it("does not create a fake provider failure when analysis persistence fails", async () => {
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    await expect(
      analyzeAssetWithVisionProvider({
        analysisStore: {
          async createAnalysis() {
            throw new Error("database unavailable");
          },
        },
        providerCallLogStore,
        assetId,
        mode: "lite",
        imageUrls: ["https://signed.example/front.jpg"],
        templates: mvpShotTemplates,
        isTrial: true,
        visionProvider: async () => ({
          provider: "openai",
          model: "gpt-5.4-nano",
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
          raw: { id: "chatcmpl_test" },
        }),
      }),
    ).rejects.toThrow("database unavailable");

    expect(providerCallLogStore.listCallLogs()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "openai",
      model: "gpt-5.4-nano",
      purpose: "lite_asset_check",
      status: "succeeded",
    });
  });
});
