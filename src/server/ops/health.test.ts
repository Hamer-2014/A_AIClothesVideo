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
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "",
      APIMART_API_KEY: "",
    });

    expect(result.ready).toBe(false);
    expect(result.environment).toBe("production");
    expect(result.checks.database).toEqual({
      configured: false,
      missing: ["DATABASE_URL"],
      status: "missing",
    });
    expect(result.checks.storage).toEqual({
      configured: false,
      missing: [
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      ],
      status: "missing",
    });
    expect(result.checks.aiProviders).toEqual({
      configured: false,
      missing: [
        "VISION_API_KEY",
        "VISION_MODEL_STANDARD",
        "VIDEO_GENERATION_MODEL",
        "APIMART_API_KEY",
      ],
      status: "missing",
    });
    expect(result.checks.creemPayment.status).toBe("pending");
    expect(result.summary.missing).not.toContain("CREEM_API_KEY");
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "support@example.com",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "RunwayTools <legal@example.com>",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "creem-api-key",
      CREEM_WEBHOOK_SECRET: "creem-webhook-secret",
      CREEM_MODERATION_API_KEY: "creem-moderation-secret",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
    });

    expect(result.ready).toBe(true);
    expect(result.summary.missing).toEqual([]);
    expect(
      Object.values(result.checks).every((check) => check.configured),
    ).toBe(true);
  });

  it("still requires CREEM_MODERATION_API_KEY when moderation mode is off", () => {
    const result = getRuntimeHealth({
      NODE_ENV: "development",
      PROMPT_MODERATION_MODE: "off",
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
      CREEM_MODERATION_API_KEY: "",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
    });

    expect(result.ready).toBe(false);
    expect(result.checks.moderation.configured).toBe(false);
    expect(result.summary.missing).toContain("CREEM_MODERATION_API_KEY");
  });

  it("reports creem payment pending separately from moderation readiness", () => {
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "support@example.com",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "RunwayTools <legal@example.com>",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
    });

    expect(result.ready).toBe(true);
    expect(result.checks.creemPayment.status).toBe("pending");
    expect(result.checks.moderation.configured).toBe(true);
  });

  it("marks app not ready when moderation is missing", () => {
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
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
    });

    expect(result.ready).toBe(false);
    expect(result.checks.moderation.configured).toBe(false);
    expect(result.summary.missing).toContain("CREEM_MODERATION_API_KEY");
  });

  it("requires the selected APIMart env key for video generation", () => {
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "support@example.com",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "RunwayTools <legal@example.com>",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "",
      PROVIDER_KEY_ENCRYPTION_SECRET: "",
    });

    expect(result.ready).toBe(false);
    expect(result.checks.aiProviders.missing).toContain("APIMART_API_KEY");
    expect(result.checks.aiProviders.missing).not.toContain("PROVIDER_KEY_ENCRYPTION_SECRET");
    expect(result.checks.aiProviders.missing).not.toContain("EVOLINK_API_KEY");
  });

  it("requires the selected EvoLink env key for video generation", () => {
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "support@example.com",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "RunwayTools <legal@example.com>",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "evolink",
      VIDEO_GENERATION_MODEL: "veo3.1-fast-beta",
      APIMART_API_KEY: "",
      EVOLINK_API_KEY: "",
      PROVIDER_KEY_ENCRYPTION_SECRET: "",
    });

    expect(result.ready).toBe(false);
    expect(result.checks.aiProviders.missing).toContain("EVOLINK_API_KEY");
    expect(result.checks.aiProviders.missing).not.toContain("APIMART_API_KEY");
    expect(result.checks.aiProviders.missing).not.toContain("PROVIDER_KEY_ENCRYPTION_SECRET");
  });

  it("marks an unsupported video generation provider as missing config", () => {
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "unknown",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
      EVOLINK_API_KEY: "evolink-key",
    });

    expect(result.ready).toBe(false);
    expect(result.checks.aiProviders.missing).toContain("VIDEO_GENERATION_PROVIDER");
  });

  it("is ready with APIMart selected from env-only video generation config", () => {
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
      ABUSE_HASH_SECRET: "abuse-hash-secret",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "support@example.com",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "RunwayTools <legal@example.com>",
      CLOUD_RUN_STITCH_URL: "https://stitch-worker.a.run.app",
      CLOUD_RUN_STITCH_SECRET: "cloud-run-secret",
      CREEM_API_KEY: "",
      CREEM_WEBHOOK_SECRET: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
      DEEPSEEK_API_KEY: "deepseek-key",
      VISION_PROVIDER: "openai",
      VISION_API_KEY: "vision-key",
      VISION_MODEL_STANDARD: "gpt-4.1-mini",
      VIDEO_GENERATION_PROVIDER: "apimart",
      VIDEO_GENERATION_MODEL: "pixverse-v6",
      APIMART_API_KEY: "apimart-key",
      PROVIDER_KEY_ENCRYPTION_SECRET: "",
    });

    expect(result.ready).toBe(true);
    expect(result.checks.aiProviders.missing).toEqual([]);
  });

  it("uses APP_ENV as the business environment", () => {
    const report = getRuntimeHealth({
      APP_ENV: "staging",
      NODE_ENV: "production",
    });

    expect(report.environment).toBe("staging");
  });

  it("reports a missing abuse hash secret in internal security readiness", () => {
    const report = getRuntimeHealth({
      INTERNAL_WORKER_SECRET: "worker-secret",
      CRON_JOB_SECRET: "cron-secret",
    });

    expect(report.checks.internalSecurity.missing).toContain(
      "ABUSE_HASH_SECRET",
    );
  });

  it("reports production legal compliance configuration", () => {
    const report = getRuntimeHealth({
      APP_ENV: "production",
      LEGAL_CONTACT_EMAIL: "",
      SUPPORT_EMAIL: "",
      RESEND_API_KEY: "",
      EMAIL_FROM: "",
      ABUSE_HASH_SECRET: "",
    });

    expect(report.checks.legalCompliance.missing).toEqual([
      "LEGAL_CONTACT_EMAIL",
      "SUPPORT_EMAIL",
      "RESEND_API_KEY",
      "EMAIL_FROM",
      "ABUSE_HASH_SECRET",
    ]);
  });

  it("requires a support email for production readiness", () => {
    const report = getRuntimeHealth({
      APP_ENV: "production",
      LEGAL_CONTACT_EMAIL: "legal@example.com",
      SUPPORT_EMAIL: "",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "AI Clothes Video <support@example.com>",
      ABUSE_HASH_SECRET: "abuse-secret",
    });

    expect(report.checks.legalCompliance.missing).toContain("SUPPORT_EMAIL");
    expect(report.ready).toBe(false);
  });
});

