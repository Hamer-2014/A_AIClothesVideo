import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns service health metadata and readiness checks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgres://example");
    vi.stubEnv("BETTER_AUTH_SECRET", "secret");
    vi.stubEnv("BETTER_AUTH_URL", "https://tools.runwaymotion.com");
    vi.stubEnv("CLOUDFLARE_R2_ACCOUNT_ID", "account");
    vi.stubEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", "key");
    vi.stubEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "secret");
    vi.stubEnv("CLOUDFLARE_R2_BUCKET", "bucket");
    vi.stubEnv("INTERNAL_WORKER_SECRET", "internal-secret");
    vi.stubEnv("CRON_JOB_SECRET", "cron-secret");
    vi.stubEnv(
      "CLOUD_RUN_STITCH_URL",
      "https://stitch-worker-hebafdmksq-uc.a.run.app",
    );
    vi.stubEnv("CLOUD_RUN_STITCH_SECRET", "cloud-run-secret");
    vi.stubEnv("CREEM_API_KEY", "creem-api-key");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "creem-webhook-secret");
    vi.stubEnv("CREEM_MODERATION_API_KEY", "creem-moderation-secret");
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek-key");
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision-key");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-4.1-mini");
    vi.stubEnv("EVOLINK_API_KEY", "evolink-key");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "a-runwaytools",
      environment: "production",
      ready: true,
      checks: {
        database: { configured: true, missing: [] },
        auth: { configured: true, missing: [] },
        storage: { configured: true, missing: [] },
        internalSecurity: { configured: true, missing: [] },
        stitchWorker: { configured: true, missing: [] },
        billing: { configured: true, missing: [] },
        aiProviders: { configured: true, missing: [] },
      },
      summary: {
        missing: [],
      },
    });
    expect(typeof body.timestamp).toBe("string");
  });

  it("reports missing runtime configuration without exposing secret values", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("CLOUDFLARE_R2_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", "");
    vi.stubEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "");
    vi.stubEnv("CLOUDFLARE_R2_BUCKET", "");
    vi.stubEnv("INTERNAL_WORKER_SECRET", "");
    vi.stubEnv("CRON_JOB_SECRET", "");
    vi.stubEnv("CLOUD_RUN_STITCH_URL", "");
    vi.stubEnv("CLOUD_RUN_STITCH_SECRET", "");
    vi.stubEnv("CREEM_API_KEY", "");
    vi.stubEnv("CREEM_WEBHOOK_SECRET", "");
    vi.stubEnv("CREEM_MODERATION_API_KEY", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("VISION_PROVIDER", "");
    vi.stubEnv("VISION_API_KEY", "");
    vi.stubEnv("VISION_MODEL_STANDARD", "");
    vi.stubEnv("EVOLINK_API_KEY", "");

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.ready).toBe(false);
    expect(body.summary.missing).toContain("DATABASE_URL");
    expect(body.summary.missing).toContain("CLOUD_RUN_STITCH_URL");
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(JSON.stringify(body)).not.toContain("postgres://");
  });
});
