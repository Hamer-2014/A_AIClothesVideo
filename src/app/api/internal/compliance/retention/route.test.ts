import { describe, expect, it, vi } from "vitest";

import { handleComplianceRetentionRequest } from "./route";

describe("POST /api/internal/compliance/retention", () => {
  it("requires the cron secret and returns redaction counts", async () => {
    const unauthorized = await handleComplianceRetentionRequest(
      new Request("http://localhost/api/internal/compliance/retention", {
        method: "POST",
      }),
      { cronSecret: "expected", runRetention: vi.fn() },
    );
    expect(unauthorized.status).toBe(401);

    const authorized = await handleComplianceRetentionRequest(
      new Request("http://localhost/api/internal/compliance/retention", {
        method: "POST",
        headers: { authorization: "Bearer expected" },
      }),
      {
        cronSecret: "expected",
        runRetention: async () => ({
          removalRequestCount: 2,
          attestationCount: 3,
        }),
      },
    );
    expect(await authorized.json()).toEqual({
      ok: true,
      removalRequestCount: 2,
      attestationCount: 3,
    });
  });

  it("fails closed without configuration and hides service errors", async () => {
    const missingSecret = await handleComplianceRetentionRequest(
      new Request("http://localhost/api/internal/compliance/retention", {
        method: "POST",
      }),
      { cronSecret: "", runRetention: vi.fn() },
    );
    const failed = await handleComplianceRetentionRequest(
      new Request("http://localhost/api/internal/compliance/retention", {
        method: "POST",
        headers: { authorization: "Bearer expected" },
      }),
      {
        cronSecret: "expected",
        runRetention: async () => {
          throw new Error("database unavailable");
        },
      },
    );

    expect(missingSecret.status).toBe(503);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(await failed.json())).not.toContain("database");
  });
});
