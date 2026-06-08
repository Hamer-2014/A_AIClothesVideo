import { describe, expect, it } from "vitest";

import { readWorkerConfig } from "./config.js";

describe("readWorkerConfig", () => {
  it("requires runtime configuration for Cloud Run stitch execution", () => {
    expect(() => readWorkerConfig({})).toThrow(
      "Missing stitch-worker environment variable: CLOUD_RUN_STITCH_SECRET",
    );
  });

  it("normalizes the R2 endpoint and bucket settings", () => {
    const config = readWorkerConfig({
      CLOUD_RUN_STITCH_SECRET: "secret",
      CLOUDFLARE_R2_ACCOUNT_ID: "account",
      CLOUDFLARE_R2_ACCESS_KEY_ID: "access",
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: "private",
      CLOUDFLARE_R2_BUCKET: "bucket",
    });

    expect(config).toMatchObject({
      workerSecret: "secret",
      bucket: "bucket",
      r2Endpoint: "https://account.r2.cloudflarestorage.com",
    });
  });
});
