import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "./log-call";

describe("provider call log store", () => {
  it("creates succeeded and failed provider call logs", async () => {
    const store = createInMemoryProviderCallLogStore();

    await store.createCallLog({
      provider: "openai",
      model: "gpt-5.4-mini",
      purpose: "standard_asset_analysis",
      userId: "11111111-1111-4111-8111-111111111111",
      modelRouteId: "33333333-3333-4333-8333-333333333333",
      routeSnapshot: {
        routeId: "33333333-3333-4333-8333-333333333333",
        routeSource: "database",
      },
      requestSnapshot: { imageCount: 1 },
      responseSummary: { assetRole: "front" },
      status: "succeeded",
      durationMs: 123,
    });
    await store.createCallLog({
      provider: "openai",
      model: "gpt-5.4-mini",
      purpose: "standard_asset_analysis",
      requestSnapshot: { imageCount: 1 },
      status: "failed",
      errorCode: "provider_error",
      errorMessage: "upstream failed",
    });

    expect(store.listCallLogs()).toHaveLength(2);
    expect(store.listCallLogs()[0]).toMatchObject({
      provider: "openai",
      status: "succeeded",
      modelRouteId: "33333333-3333-4333-8333-333333333333",
      routeSnapshot: {
        routeId: "33333333-3333-4333-8333-333333333333",
        routeSource: "database",
      },
      durationMs: 123,
    });
    expect(store.listCallLogs()[1]).toMatchObject({
      status: "failed",
      errorCode: "provider_error",
    });
  });
});
