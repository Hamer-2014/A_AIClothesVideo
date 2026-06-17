import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { mvpShotTemplates } from "@/lib/templates/catalog";
import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";
import { createInMemoryJobStore } from "@/server/jobs/state-machine";

import {
  analyzeVideoJobAssets,
  createInMemoryVideoJobAssetStore,
} from "./job-analysis";
import { createInMemoryAssetAnalysisStore } from "./analyze";

const jobId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

describe("video job asset analysis", () => {
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
    expect(providerCallLogStore.listCallLogs()).toHaveLength(2);
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
});
