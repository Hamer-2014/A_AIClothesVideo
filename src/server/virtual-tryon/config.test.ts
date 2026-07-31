import { describe, expect, it } from "vitest";

import { getVirtualTryOnConfig, getVirtualTryOnPublicConfig, requiredViewsFor } from "./config";

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
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STRICT: "strict-model",
      PROMPT_MODERATION_MODE: "off",
      APP_ENV: "development",
      NODE_ENV: "development",
    };
    expect(getVirtualTryOnConfig(env)).toMatchObject({ frontOnlyCreditCost: 10, threeViewCreditCost: 30 });
    expect(() => getVirtualTryOnConfig({ ...env, CLOUDFLARE_R2_BUCKET: undefined, R2_BUCKET: "obsolete" })).toThrow("virtual_tryon_config_unavailable");
  });

  it("fails public availability before paid work when strict vision or moderation is unavailable", () => {
    const env = { APIMART_API_KEY: "key", CLOUDFLARE_R2_ACCOUNT_ID: "account", CLOUDFLARE_R2_ACCESS_KEY_ID: "access", CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret", CLOUDFLARE_R2_BUCKET: "bucket", VIRTUAL_TRYON_MODEL_FRONT_KEY: "front", VIRTUAL_TRYON_MODEL_SIDE_KEY: "side", VIRTUAL_TRYON_MODEL_BACK_KEY: "back", VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST: "10", VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST: "30", VISION_PROVIDER: "openai", VISION_API_KEY: "vision", VISION_MODEL_STRICT: "strict", PROMPT_MODERATION_MODE: "off", APP_ENV: "development", NODE_ENV: "development" };
    expect(getVirtualTryOnConfig(env)).toBeTruthy();
    expect(() => getVirtualTryOnConfig({ ...env, VISION_MODEL_STRICT: undefined })).toThrow("virtual_tryon_config_unavailable");
    expect(() => getVirtualTryOnConfig({ ...env, VISION_PROVIDER: "unknown_provider" })).toThrow("virtual_tryon_config_unavailable");
    expect(() => getVirtualTryOnConfig({ ...env, VISION_PROVIDER: "custom", VISION_BASE_URL: undefined })).toThrow("virtual_tryon_config_unavailable");
    expect(() => getVirtualTryOnConfig({ ...env, APP_ENV: "staging", PROMPT_MODERATION_MODE: "creem", CREEM_MODERATION_API_KEY: undefined })).toThrow("virtual_tryon_config_unavailable");
    expect(() => getVirtualTryOnConfig({ ...env, APP_ENV: "production", PROMPT_MODERATION_MODE: "creem", CREEM_MODERATION_API_KEY: "creem_test_key" })).toThrow("virtual_tryon_config_unavailable");
    expect(getVirtualTryOnPublicConfig({ ...env, VISION_MODEL_STRICT: undefined })).toEqual({ available: false, frontOnlyCreditCost: null, threeViewCreditCost: null });
    expect(getVirtualTryOnPublicConfig({ ...env, APP_ENV: "staging", PROMPT_MODERATION_MODE: "creem", CREEM_MODERATION_API_KEY: undefined })).toEqual({ available: false, frontOnlyCreditCost: null, threeViewCreditCost: null });
  });
});
