import { describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createDefaultVirtualTryOnRuntimeDeps, type RuntimeJob, type RuntimeStore } from "./runtime";

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
    const deps = createDefaultVirtualTryOnRuntimeDeps({
      store,
      credits: createInMemoryCreditLedgerStore(),
      signer: async ({ key }) => "signed:" + key,
      imageClient,
      pollClient: async () => ({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1", status: "queued", outputUrl: null, raw: {} }),
      providerLogStore: createInMemoryProviderCallLogStore(),
    });

    expect(deps.store).toBe(store);
    await expect(deps.submit(job, "front")).resolves.toBe("task-1");
    expect(imageClient).toHaveBeenCalledOnce();
  });
});
