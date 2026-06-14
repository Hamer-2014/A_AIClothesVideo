import { describe, expect, it } from "vitest";

import {
  createDrizzleProviderOpsStore,
  createInMemoryProviderOpsStore,
  getProviderOpsOverview,
} from "./providers";

function createStore() {
  return createInMemoryProviderOpsStore({
    providers: [
      {
        id: "provider-1",
        name: "evolink",
        displayName: "EvoLink",
        status: "active",
        baseUrl: "https://api.evolink.ai",
      },
    ],
    keys: [
      {
        id: "key-1",
        providerId: "provider-1",
        label: "main",
        environment: "development",
        status: "paused",
        keyPreview: "sk_...1234",
        dailyCostLimit: "100",
        currentDailyCost: "0",
        concurrentLimit: 2,
        currentConcurrency: 0,
        failureCount: 0,
      },
    ],
    routes: [
      {
        id: "route-1",
        purpose: "video_generation",
        environment: "development",
        primaryProviderId: "provider-1",
        primaryModel: "veo3.1-fast-beta",
        fallbackProviderId: null,
        fallbackModel: null,
        status: "paused",
        minMarginPercent: 45,
        allowPublicFallback: "false",
      },
    ],
  });
}

describe("provider ops", () => {
  it("returns provider overview without encrypted keys", async () => {
    const overview = await getProviderOpsOverview({ store: createStore() });

    expect(overview.keys[0]).toEqual(
      expect.objectContaining({
        id: "key-1",
        keyPreview: "sk_...1234",
      }),
    );
    expect(overview.keys[0]).not.toHaveProperty("encryptedKey");
  });

  it("does not expose provider key or model route write operations", () => {
    expect(createInMemoryProviderOpsStore({ providers: [], keys: [], routes: [] }))
      .not.toHaveProperty("createKey");
    expect(createInMemoryProviderOpsStore({ providers: [], keys: [], routes: [] }))
      .not.toHaveProperty("rotateKey");
    expect(createInMemoryProviderOpsStore({ providers: [], keys: [], routes: [] }))
      .not.toHaveProperty("updateRoute");
  });

  it("does not query retired model_routes from the drizzle overview store", async () => {
    let selectCalls = 0;
    const db = {
      select() {
        selectCalls += 1;
        return {
          from() {
            return Promise.resolve([]);
          },
        };
      },
    };

    const overview = await getProviderOpsOverview({
      store: createDrizzleProviderOpsStore(db as never),
    });

    expect(overview.routes).toEqual([]);
    expect(selectCalls).toBe(2);
  });
});
