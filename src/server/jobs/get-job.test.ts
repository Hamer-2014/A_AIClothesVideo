import { describe, expect, it } from "vitest";

import { mvpShotTemplates } from "@/lib/templates/catalog";

import {
  createInMemoryVideoJobReadStore,
  getVideoJobDetail,
} from "./get-job";

const jobId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

describe("get video job detail", () => {
  it("returns job status, assets, and aggregated recommendations", async () => {
    const store = createInMemoryVideoJobReadStore({
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
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        },
      ],
      assets: [
        {
          assetId: "asset-front",
          role: "front",
          sortOrder: 0,
        },
        {
          assetId: "asset-back",
          role: "back",
          sortOrder: 1,
        },
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
              has_flat_lay_or_white_background: true,
            },
            confidence: "high",
            risk_flags: [],
          },
        },
        {
          assetId: "asset-back",
          analysisJson: {
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
          },
        },
      ],
      storyboards: [
        {
          id: "storyboard-1",
          videoJobId: jobId,
          status: "draft",
          selectedTemplateIds: ["front_push_in"],
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
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    });

    const detail = await getVideoJobDetail({
      store,
      jobId,
      userId,
      templates: mvpShotTemplates,
    });

    expect(detail).not.toBeNull();
    if (!detail) {
      throw new Error("Expected job detail.");
    }

    expect(detail).toMatchObject({
      job: {
        id: jobId,
        status: "asset_analysis_passed",
        userVisibleStatus: "assets_ready",
      },
      assets: [
        { assetId: "asset-front", role: "front" },
        { assetId: "asset-back", role: "back" },
      ],
      acceptable: true,
      latestStoryboard: {
        id: "storyboard-1",
        status: "draft",
      },
    });
    expect(detail.recommendations.availableTemplateIds).toContain("back_display");
  });

  it("returns null when the job does not belong to the user", async () => {
    const store = createInMemoryVideoJobReadStore({
      jobs: [
        {
          id: jobId,
          userId: "someone-else",
          status: "asset_analysis_queued",
          userVisibleStatus: "analyzing_assets",
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
      assets: [],
      analyses: [],
      storyboards: [],
    });

    await expect(
      getVideoJobDetail({
        store,
        jobId,
        userId,
        templates: mvpShotTemplates,
      }),
    ).resolves.toBeNull();
  });

  it("uses job billing mode rather than caller supplied duration assumptions for trial recommendations", async () => {
    const store = createInMemoryVideoJobReadStore({
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
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        },
      ],
      assets: [
        {
          assetId: "asset-front",
          role: "front",
          sortOrder: 0,
        },
        {
          assetId: "asset-detail",
          role: "detail",
          sortOrder: 1,
        },
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
          assetId: "asset-detail",
          analysisJson: {
            asset_role: "detail",
            garment_category: "dress",
            view_angle: "detail",
            human_present: "no",
            visible_details: ["fabric"],
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
      ],
      storyboards: [],
    });

    const detail = await getVideoJobDetail({
      store,
      jobId,
      userId,
      templates: mvpShotTemplates,
    });

    expect(detail?.job).toMatchObject({
      billingMode: "paid",
      generationProfile: "paid_720p_audio",
      watermarkEnabled: false,
    });
    expect(detail?.recommendations.availableTemplateIds).toContain("fabric_macro");
  });

  it("preserves declared fixed-slot roles when building job detail recommendations", async () => {
    const store = createInMemoryVideoJobReadStore({
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
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        },
      ],
      assets: [
        { assetId: "asset-front", role: "front", sortOrder: 0 },
        { assetId: "asset-back", role: "back", sortOrder: 1 },
        { assetId: "asset-detail", role: "detail", sortOrder: 2 },
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
          assetId: "asset-back",
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
            confidence: "low",
            risk_flags: ["role_uncertain"],
          },
        },
        {
          assetId: "asset-detail",
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
            confidence: "low",
            risk_flags: ["role_uncertain"],
          },
        },
      ],
      storyboards: [],
    });

    const detail = await getVideoJobDetail({
      store,
      jobId,
      userId,
      templates: mvpShotTemplates,
    });

    expect(detail?.assetCompleteness.hasBack).toBe(true);
    expect(detail?.assetCompleteness.hasDetail).toBe(true);
    expect(detail?.assetCompleteness.detailTypes).toEqual(["fabric"]);
    expect(detail?.recommendations.availableTemplateIds).toContain("back_display");
    expect(detail?.recommendations.availableTemplateIds).toContain("fabric_macro");
  });

  it("returns analysis quality summaries for uploaded asset warnings", async () => {
    const store = createInMemoryVideoJobReadStore({
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
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        },
      ],
      assets: [{ assetId: "asset-scene", role: "scene", sortOrder: 0 }],
      analyses: [
        {
          assetId: "asset-scene",
          analysisJson: {
            asset_role: "background/scene image (no clothing item visible)",
            garment_category: "unknown",
            view_angle: "N/A",
            human_present: "no",
            visible_details: ["No clothing garment visible"],
            not_visible_details: ["garment material"],
            quality: {
              is_garment: false,
              is_clear: false,
              is_safe: true,
              has_flat_lay_or_white_background: false,
            },
            confidence: "low",
            risk_flags: ["No garment visible"],
          },
        },
      ],
      storyboards: [],
    });

    const detail = await getVideoJobDetail({
      store,
      jobId,
      userId,
      templates: mvpShotTemplates,
    });

    expect(detail?.analyses).toEqual([
      expect.objectContaining({
        assetId: "asset-scene",
        declaredRole: "scene",
        assetRole: "unknown",
        confidence: "low",
        quality: expect.objectContaining({
          isGarment: false,
          isClear: false,
        }),
        riskFlags: ["No garment visible"],
      }),
    ]);
  });
});
