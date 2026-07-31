import { describe, expect, it } from "vitest";

import { getVirtualTryOnConfig, requiredViewsFor } from "./config";

describe("virtual try-on configuration", () => {
  it("requires front back and detail for three view", () => {
    expect(() => requiredViewsFor({ mode: "three_view", frontAssetId: "front", backAssetId: null, detailAssetId: "detail" })).toThrow("three_view_requires_front_back_detail");
  });

  it("fails closed for an incomplete configuration", () => {
    expect(() => getVirtualTryOnConfig({ VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "0" })).toThrow("virtual_tryon_config_unavailable");
  });

  it("accepts the project Cloudflare R2 variables and rejects obsolete R2 aliases", () => {
    const env = {
      APIMART_API_KEY: "key",
      CLOUDFLARE_R2_ACCOUNT_ID: "account",
      CLOUDFLARE_R2_ACCESS_KEY_ID: "access",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret",
      CLOUDFLARE_R2_BUCKET: "bucket",
      VIRTUAL_TRYON_MODEL_FRONT_KEY: "models/front.png",
      VIRTUAL_TRYON_MODEL_SIDE_KEY: "models/side.png",
      VIRTUAL_TRYON_MODEL_BACK_KEY: "models/back.png",
      VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "10",
      VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST: "30",
    };
    expect(getVirtualTryOnConfig(env)).toMatchObject({ frontOnlyCreditCost: 10, threeViewCreditCost: 30 });
    expect(() => getVirtualTryOnConfig({ ...env, CLOUDFLARE_R2_BUCKET: undefined, R2_BUCKET: "obsolete" })).toThrow("virtual_tryon_config_unavailable");
  });
});
