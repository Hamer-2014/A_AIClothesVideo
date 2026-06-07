import { describe, expect, it } from "vitest";

import {
  createInMemoryVideoJobCreationStore,
  createVideoJobWithAssets,
} from "./create-job";

const userId = "22222222-2222-4222-8222-222222222222";

describe("create video job", () => {
  it("creates an asset-analysis queued job and binds owned assets", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
      {
        id: "asset-back",
        userId,
        status: "uploaded",
        detectedRole: "back",
      },
    ]);

    const result = await createVideoJobWithAssets({
      store,
      userId,
      assetIds: ["asset-front", "asset-back"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      isTrial: true,
    });

    expect(result.job).toMatchObject({
      userId,
      status: "asset_analysis_queued",
      userVisibleStatus: "analyzing_assets",
      durationSeconds: 8,
      aspectRatio: "9:16",
      creditCost: 0,
      isTest: false,
    });
    expect(store.listJobAssets()).toEqual([
      expect.objectContaining({
        videoJobId: result.job.id,
        assetId: "asset-front",
        role: "front",
        sortOrder: 0,
      }),
      expect.objectContaining({
        videoJobId: result.job.id,
        assetId: "asset-back",
        role: "back",
        sortOrder: 1,
      }),
    ]);
    expect(store.listEvents()).toEqual([
      expect.objectContaining({
        videoJobId: result.job.id,
        fromStatus: "draft_uploaded",
        toStatus: "asset_analysis_queued",
        reason: "job_created",
      }),
    ]);
  });

  it("rejects creating a job without assets", async () => {
    const store = createInMemoryVideoJobCreationStore([]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: [],
        durationSeconds: 8,
        aspectRatio: "9:16",
        isTrial: true,
      }),
    ).rejects.toThrow("At least one asset is required to create a video job.");

    expect(store.listJobs()).toHaveLength(0);
  });

  it("rejects assets that do not belong to the user", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId: "another-user",
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 8,
        aspectRatio: "9:16",
        isTrial: true,
      }),
    ).rejects.toThrow("One or more assets were not found for user.");

    expect(store.listJobs()).toHaveLength(0);
  });

  it("rejects unsupported duration and aspect ratio", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    await expect(
      createVideoJobWithAssets({
        store,
        userId,
        assetIds: ["asset-front"],
        durationSeconds: 12,
        aspectRatio: "4:5",
        isTrial: false,
      }),
    ).rejects.toThrow("Unsupported video duration.");
  });
});
