import { describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createVisionVirtualTryOnQa } from "@/lib/providers/vision/client";
import { createInMemoryVirtualTryOnQaStore } from "./qa-store";
import { createDefaultVirtualTryOnRuntimeDeps, runVirtualTryOnTick, type RuntimeJob, type RuntimeStore } from "./runtime";

const job: RuntimeJob = {
  id: "job-1",
  packId: "pack-1",
  userId: "user-1",
  mode: "front_only",
  status: "queued",
  creditCost: 1,
  lockedUntil: null,
  sourceKeys: { front: "users/user-1/assets/front.png" },
  modelKeys: { front: "platform/models/front.png", side: "platform/models/side.png", back: "platform/models/back.png" },
  assets: [],
};

describe("default virtual try-on runtime dependencies", () => {
  it("composes the APIMart bridge with the supplied runtime store and credits", async () => {
    const store = {} as RuntimeStore;
    const imageClient = vi.fn(async () => ({ provider: "apimart" as const, model: "gpt-image-2", providerTaskId: "task-1", raw: {} }));
    const providerLogStore = createInMemoryProviderCallLogStore();
    const deps = createDefaultVirtualTryOnRuntimeDeps({
      store,
      credits: createInMemoryCreditLedgerStore(),
      signer: async ({ key }) => "signed:" + key,
      imageClient,
      pollClient: async () => ({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1", status: "queued", outputUrl: null, raw: {} }),
      providerLogStore,
    });

    expect(deps.store).toBe(store);
    expect(deps.qaDeps.providerLogStore).toBe(providerLogStore);
    expect(deps.qaDeps.visionProvider).toBe(createVisionVirtualTryOnQa);
    await expect(deps.submit(job, "front")).resolves.toBe("task-1");
    expect(imageClient).toHaveBeenCalledOnce();
  });

  it("includes default QA dependencies so a queued QA job does not fail only because they were omitted", async () => {
    const qaStore = createInMemoryVirtualTryOnQaStore();
    const qaJob: RuntimeJob = {
      ...job,
      status: "qa_queued",
      assets: [{ view: "front", providerTaskId: "task-1", providerStatus: "succeeded", attemptCount: 1, r2Key: "virtual-try-on/job-1/packs/pack-1/front.png" }],
    };
    const store: RuntimeStore = {
      acquire: async () => qaJob,
      renewLease: async () => true,
      saveAsset: async () => true,
      transitionToGenerating: async () => true,
      transitionAssetsReadyToQaQueued: async () => true,
      resolveQa: async (_jobId, _packId, _workerId, passed) => {
        qaJob.status = passed ? "capturing" : "recovering_release";
        return true;
      },
      finalizeCapturedPack: async () => true,
      scheduleCapturePersistenceRetry: async () => "retry",
      transitionCaptureToRefund: async () => true,
      transitionToRecoveringRelease: async () => true,
      scheduleRetry: async () => true,
      releaseLease: async () => true,
    };
    const visionProvider = vi.fn().mockResolvedValue({
      provider: "vision",
      model: "strict",
      qaJson: {
        verdict: "pass",
        targetView: "front",
        garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" },
        person: { anatomy: "natural", identityConsistency: "match" },
        inventedDetails: false,
        evidence: [],
      },
      raw: { discarded: true },
    });
    const signer = vi.fn(async ({ key }: { key: string }) => "signed:" + key);
    const deps = createDefaultVirtualTryOnRuntimeDeps({
      store,
      credits: createInMemoryCreditLedgerStore(),
      signer,
      providerLogStore: createInMemoryProviderCallLogStore(),
      qaStore,
      visionProvider,
    });

    expect(deps.qaDeps).toBeDefined();
    const result = await runVirtualTryOnTick({ workerId: "worker", ...deps });

    expect(result.action).toBe("capturing");
    expect(visionProvider).toHaveBeenCalledOnce();
    expect(signer).toHaveBeenCalledWith({ key: "users/user-1/assets/front.png", expiresIn: 300 });
    expect(await qaStore.findResults("pack-1")).toHaveLength(1);
  });
});
