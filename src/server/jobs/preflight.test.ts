import { describe, expect, it } from "vitest";

import { createInMemoryVideoJobCreationStore } from "./create-job";
import { preflightVideoJob } from "./preflight";

const userId = "22222222-2222-4222-8222-222222222222";

describe("video job preflight", () => {
  it("blocks assets without rights attestation before job creation", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
        rightsAttested: false,
        rightsAttestationId: null,
      },
    ]);

    const result = await preflightVideoJob({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 8,
      aspectRatio: "9:16",
    });

    expect(result.blockingReasons).toContainEqual({
      code: "rights_attestation_required",
      message: "请先确认所选素材的版权、肖像与商业使用授权。",
    });
    expect(result.missingRightsAttestationAssetIds).toEqual(["asset-front"]);
  });

  it("blocks job creation when no uploaded front asset is present without creating jobs or trial usages", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-scene",
        userId,
        status: "uploaded",
        detectedRole: "scene",
      },
    ]);

    const result = await preflightVideoJob({
      store,
      userId,
      assetIds: ["asset-scene"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      presetId: "marketplace_clean",
      useFreeTrialIfAvailable: true,
    });

    expect(result.canCreateJob).toBe(false);
    expect(result.requiredAssetRoles).toEqual(["front"]);
    expect(result.uploadedAssetRoles).toEqual(["scene"]);
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "front_asset_required",
          message: expect.stringContaining("正面"),
        }),
      ]),
    );
    expect(store.listJobs()).toHaveLength(0);
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("allows marketplace clean front plus scene assets and warns that scene is atmosphere reference only", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
      {
        id: "asset-scene",
        userId,
        status: "uploaded",
        detectedRole: "scene",
      },
    ]);

    const result = await preflightVideoJob({
      store,
      userId,
      assetIds: ["asset-front", "asset-scene"],
      durationSeconds: 8,
      aspectRatio: "9:16",
      presetId: "marketplace_clean",
      useFreeTrialIfAvailable: false,
    });

    expect(result.canCreateJob).toBe(true);
    expect(result.uploadedAssetRoles).toEqual(["front", "scene"]);
    expect(result.blockingReasons).toEqual([]);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "scene_reference_only",
          message: expect.stringContaining("氛围参考"),
        }),
      ]),
    );
    expect(result.recommendedTemplateIds).toEqual(["product_float"]);
    expect(store.listJobs()).toHaveLength(0);
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("blocks free trial preflight for durations longer than 8 seconds", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);

    const result = await preflightVideoJob({
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 16,
      aspectRatio: "9:16",
      presetId: "minimal_studio",
      useFreeTrialIfAvailable: true,
    });

    expect(result.canCreateJob).toBe(false);
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "free_trial_duration_unsupported",
          message: expect.stringContaining("免费试用仅支持 8 秒"),
        }),
      ]),
    );
    expect(store.listTrialUsages()).toHaveLength(0);
  });

  it("reports the 40-second gate and paid-only rule", async () => {
    const store = createInMemoryVideoJobCreationStore([
      {
        id: "asset-front",
        userId,
        status: "uploaded",
        detectedRole: "front",
      },
    ]);
    const base = {
      store,
      userId,
      assetIds: ["asset-front"],
      durationSeconds: 40,
      aspectRatio: "9:16",
      presetId: "minimal_studio",
    };

    const disabled = await preflightVideoJob({
      ...base,
      useFreeTrialIfAvailable: false,
      videoSpecEnv: { VIDEO_DURATION_40_ENABLED: "false" },
    });
    expect(disabled.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "duration_beta_disabled" }),
    );

    const trial = await preflightVideoJob({
      ...base,
      useFreeTrialIfAvailable: true,
      videoSpecEnv: { VIDEO_DURATION_40_ENABLED: "true" },
    });
    expect(trial.blockingReasons).toContainEqual(
      expect.objectContaining({ code: "free_trial_duration_unsupported" }),
    );
  });
});
