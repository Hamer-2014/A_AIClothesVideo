import { describe, expect, it } from "vitest";

import { handleJobPreflightRequest } from "./route";

describe("POST /api/jobs/preflight", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleJobPreflightRequest(
      new Request("http://localhost/api/jobs/preflight", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          presetId: "marketplace_clean",
        }),
      }),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns canCreateJob false with Chinese blocking reason when front asset is missing", async () => {
    const response = await handleJobPreflightRequest(
      new Request("http://localhost/api/jobs/preflight", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-scene"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          presetId: "marketplace_clean",
          useFreeTrialIfAvailable: true,
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        preflight: async () => ({
          canCreateJob: false,
          requiredAssetRoles: ["front"],
          uploadedAssetRoles: ["scene"],
          blockingReasons: [
            {
              code: "front_asset_required",
              message: "至少需要上传一张服装正面图。",
            },
          ],
          warnings: [],
          recommendedTemplateIds: [],
          missingRightsAttestationAssetIds: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      canCreateJob: false,
      requiredAssetRoles: ["front"],
      uploadedAssetRoles: ["scene"],
      blockingReasons: [
        {
          code: "front_asset_required",
          message: "至少需要上传一张服装正面图。",
        },
      ],
      warnings: [],
      recommendedTemplateIds: [],
      missingRightsAttestationAssetIds: [],
    });
  });

  it("returns scene warning for marketplace clean front plus scene preflight", async () => {
    const response = await handleJobPreflightRequest(
      new Request("http://localhost/api/jobs/preflight", {
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-front", "asset-scene"],
          durationSeconds: 8,
          aspectRatio: "9:16",
          presetId: "marketplace_clean",
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        preflight: async () => ({
          canCreateJob: true,
          requiredAssetRoles: ["front"],
          uploadedAssetRoles: ["front", "scene"],
          blockingReasons: [],
          warnings: [
            {
              code: "scene_reference_only",
              message: "场景图仅作为背景、灯光和氛围参考，不会作为服装细节依据。",
            },
          ],
          recommendedTemplateIds: ["scene_lifestyle_showcase"],
          missingRightsAttestationAssetIds: [],
        }),
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.canCreateJob).toBe(true);
    expect(body.warnings).toEqual([
      {
        code: "scene_reference_only",
        message: "场景图仅作为背景、灯光和氛围参考，不会作为服装细节依据。",
      },
    ]);
  });
});
