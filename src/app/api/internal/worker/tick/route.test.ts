import { afterEach, describe, expect, it, vi } from "vitest";

import { handleWorkerTickRequest } from "./route";

describe("POST /api/internal/worker/tick", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects requests when the cron secret is missing", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "");

    const response = await handleWorkerTickRequest(
      new Request("http://localhost/api/internal/worker/tick", {
        method: "POST",
        headers: { "x-cron-secret": "secret" },
      }),
      {
        runTick: async () => ({ processed: 1, succeeded: 1, failed: 0 }),
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cron_not_configured" });
  });

  it("rejects requests with an invalid secret", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "expected_secret");

    const response = await handleWorkerTickRequest(
      new Request("http://localhost/api/internal/worker/tick", {
        method: "POST",
        headers: { "x-cron-secret": "wrong_secret" },
      }),
      {
        runTick: async () => ({ processed: 1, succeeded: 1, failed: 0 }),
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("runs one worker tick for authorized cron requests", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "expected_secret");
    const response = await handleWorkerTickRequest(
      new Request("http://localhost/api/internal/worker/tick", {
        method: "POST",
        headers: { "x-cron-secret": "expected_secret" },
      }),
      {
        runTick: async () => ({ processed: 2, succeeded: 1, failed: 1 }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      processed: 2,
      succeeded: 1,
      failed: 1,
    });
  });
});
