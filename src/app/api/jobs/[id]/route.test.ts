import { describe, expect, it } from "vitest";

import { handleGetJobRequest } from "./route";

describe("GET /api/jobs/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGetJobRequest(
      new Request("http://localhost/api/jobs/job-1"),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns a job detail for the owner", async () => {
    const response = await handleGetJobRequest(
      new Request("http://localhost/api/jobs/job-1"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        sourceAssetStore: {
          listOwnedJobAssets: async ({ jobId, userId }) => {
            expect(jobId).toBe("job-1");
            expect(userId).toBe("user-1");
            return [
              {
                assetId: "asset-1",
                role: "front",
                sortOrder: 0,
                originalKey: "users/user-1/assets/asset-1/original.webp",
                fileName: "front.webp",
                mimeType: "image/webp",
              },
              {
                assetId: "asset-2",
                role: "back",
                sortOrder: 1,
                originalKey: "users/user-1/assets/asset-2/original.webp",
                fileName: "back.webp",
                mimeType: "image/webp",
              },
            ];
          },
        },
        createDownloadSignedUrl: async ({ key }) => {
          if (key.includes("asset-2")) {
            throw new Error("temporary signing failure");
          }
          return `https://signed-r2.example/${key}?expires=900`;
        },
        getJob: async () => ({
          job: {
            id: "job-1",
            userId: "user-1",
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
          assets: [
            { assetId: "asset-1", role: "front", sortOrder: 0 },
            { assetId: "asset-2", role: "back", sortOrder: 1 },
          ],
          analyses: [],
          consistencyAnalyses: [],
          acceptable: true,
          assetCompleteness: {
            hasFront: true,
            hasBack: false,
            hasSide: false,
            hasDetail: false,
            hasScene: false,
            hasModelFront: false,
            hasModelSide: false,
            hasModelBack: false,
            hasFlatLayOrWhiteBackground: true,
            hasProductFront: false,
            hasProductSide: false,
            hasProductBack: false,
            garmentConsistency: "unknown",
            modelGarmentConsistency: "unknown",
            modelConsistency: "unknown",
            detailTypes: [],
          },
          recommendations: {
            recommended: [],
            optional: [],
            unavailable: [],
            availableTemplateIds: ["front_push_in"],
          },
      latestStoryboard: {
        id: "storyboard-1",
        videoJobId: "job-1",
        status: "draft",
        selectedTemplateIds: ["front_push_in"],
            storyboardJson: {
              duration_seconds: 8,
              segments: [],
            },
            createdAt: new Date(),
          },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      job: {
        id: "job-1",
        status: "asset_analysis_passed",
      },
      assetCount: 2,
      recommendations: {
        availableTemplateIds: ["front_push_in"],
      },
      latestStoryboard: {
        id: "storyboard-1",
        status: "draft",
        selectedTemplateIds: ["front_push_in"],
      },
    });
    expect(body.assets).toEqual([
      {
        assetId: "asset-1",
        role: "front",
        sortOrder: 0,
        fileName: "front.webp",
        mimeType: "image/webp",
        previewUrl:
          "https://signed-r2.example/users/user-1/assets/asset-1/original.webp?expires=900",
      },
      {
        assetId: "asset-2",
        role: "back",
        sortOrder: 1,
        fileName: "back.webp",
        mimeType: "image/webp",
        previewUrl: null,
      },
    ]);
  });

  it("returns 404 when the job is not found for the user", async () => {
    const response = await handleGetJobRequest(
      new Request("http://localhost/api/jobs/job-1"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getJob: async () => null,
      },
    );

    expect(response.status).toBe(404);
  });
});
