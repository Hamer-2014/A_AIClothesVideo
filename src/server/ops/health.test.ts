import { describe, expect, it } from "vitest";

import { getRuntimeHealth } from "./health";

describe("getRuntimeHealth", () => {
  it("aggregates missing env vars by subsystem", () => {
    const result = getRuntimeHealth({
      NODE_ENV: "production",
      DATABASE_URL: "",
      BETTER_AUTH_SECRET: "",
      BETTER_AUTH_URL: "https://tools.runwaymotion.com",
      CLOUDFLARE_R2_ACCOUNT_ID: "account",
      CLOUDFLARE_R2_ACCESS_KEY_ID: "",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "",
      CLOUDFLARE_R2_BUCKET: "bucket",
      INTERNAL_WORKER_SECRET: "internal-secret",
      CRON_JOB_SECRET: "",
      CLOUD_RUN_STITCH_URL: "",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "",
      VISION_MODEL_STANDARD: "",
      EVOLINK_API_KEY: "",
    });

    expect(result.ready).toBe(false);
    expect(result.environment).toBe("production");
    expect(result.checks.database).toEqual({
      configured: false,
      missing: ["DATABASE_URL"],
    });
    expect(result.checks.storage).toEqual({
      configured: false,
      missing: [
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      ],
    });
    expect(result.checks.aiProviders).toEqual({
      configured: false,
      missing: [
        "VISION_API_KEY",
        "VISION_MODEL_STANDARD",
        "EVOLINK_API_KEY",
      ],
    });
    expect(result.summary.missing).toContain("CREEM_API_KEY");
    expect(result.summary.missing).toContain("CLOUD_RUN_STITCH_URL");
  });

  it("returns a ready summary when all critical env vars exist", () => {
    const result = getRuntimeHealth({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://masked",
      BETTER_AUTH_SECRET: "secret",
      BETTER_AUTH_URL: "https://tools.runwaymotion.com",
      CLOUDFLARE_R2_ACCOUNT_ID: "account",
      CLOUDFLARE_R2_ACCESS_KEY_ID: "key",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret",
      CLOUDFLARE_R2_BUCKET: "bucket",
      INTERNAL_WORKER_SECRET: "internal-secret",
      CRON_JOB_SECRET: "cron-secret",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "creem-api-key",
      CREEM_WEBHOOK_SECRET: "creem-webhook-secret",
      CREEM_MODERATION_API_KEY: "creem-moderation-secret",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      EVOLINK_API_KEY: "evolink-key",
    });

    expect(result.ready).toBe(true);
    expect(result.summary.missing).toEqual([]);
    expect(
      Object.values(result.checks).every((check) => check.configured),
    ).toBe(true);
  });
});
