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
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 0,
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
      isTrial: false,
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
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 0,
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
        isTrial: true,
      }),
    ).resolves.toBeNull();
  });
});
