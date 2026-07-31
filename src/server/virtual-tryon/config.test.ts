import { describe, expect, it } from "vitest";

import { getVirtualTryOnConfig, requiredViewsFor } from "./config";

describe("virtual try-on configuration", () => {
  it("requires front back and detail for three view", () => {
    expect(() => requiredViewsFor({ mode: "three_view", frontAssetId: "front", backAssetId: null, detailAssetId: "detail" })).toThrow("three_view_requires_front_back_detail");
  });

  it("fails closed for an incomplete configuration", () => {
    expect(() => getVirtualTryOnConfig({ VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "0" })).toThrow("virtual_tryon_config_unavailable");
  });
});
