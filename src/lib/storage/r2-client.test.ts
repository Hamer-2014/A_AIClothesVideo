import { describe, expect, it } from "vitest";

import { getR2Config } from "./r2-client";

describe("R2 client config", () => {
  it("fails closed when required R2 env vars are missing", () => {
    expect(() => getR2Config({})).toThrow(
      "CLOUDFLARE_R2_ACCOUNT_ID is required for R2 storage.",
    );
  });

  it("builds the Cloudflare R2 S3-compatible endpoint", () => {
    expect(
      getR2Config({
        CLOUDFLARE_R2_ACCOUNT_ID: "abc123",
        CLOUDFLARE_R2_ACCESS_KEY_ID: "access",
        CLOUDFLARE_R2_SECRET_ACCESS_KEY: "secret",
        CLOUDFLARE_R2_BUCKET: "bucket",
      }),
    ).toMatchObject({
      bucket: "bucket",
      endpoint: "https://abc123.r2.cloudflarestorage.com",
      region: "auto",
    });
  });
});
