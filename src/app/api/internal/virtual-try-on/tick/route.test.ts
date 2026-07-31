import { afterEach, describe, expect, it, vi } from "vitest";

import { handleVirtualTryOnTickRequest } from "./route";

function request(body: unknown = {}, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/internal/virtual-try-on/tick", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/internal/virtual-try-on/tick", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed when CRON_JOB_SECRET is not configured", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "");

    const response = await handleVirtualTryOnTickRequest(request({}, { "x-cron-secret": "secret" }));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cron_not_configured" });
  });

  it("rejects an invalid cron secret", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "secret");

    const response = await handleVirtualTryOnTickRequest(request({}, { "x-cron-secret": "wrong" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("accepts a Bearer cron secret and rejects an invalid tick limit", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "secret");
    const response = await handleVirtualTryOnTickRequest(request({ limit: 21 }, { authorization: "Bearer secret" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_tick_limit" });
  });

  it("alternates maintenance and generation without exceeding the requested processed limit", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "secret");
    const calls: string[] = [];
    const response = await handleVirtualTryOnTickRequest(request({ limit: 3 }, { "x-cron-secret": "secret" }), {
      runMaintenance: async () => {
        calls.push("maintenance");
        return { processed: 1, action: "released" };
      },
      runGeneration: async () => {
        calls.push("generation");
        return { processed: 1, action: "submit" };
      },
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual(["maintenance", "generation", "maintenance"]);
    expect(await response.json()).toEqual({ processed: 3, submitted: 1, polled: 0, ready: 0, failed: 2, transferred: 0, qaQueued: 0, capturing: 0, retried: 0, maintenance: 2 });
  });

  it("uses the other phase when the preferred phase is idle and maps actions to safe counters", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "secret");
    const calls: string[] = [];
    let generationCalls = 0;
    const response = await handleVirtualTryOnTickRequest(request({ limit: 2 }, { "x-cron-secret": "secret" }), {
      runMaintenance: async () => {
        calls.push("maintenance");
        return { processed: 0 };
      },
      runGeneration: async () => {
        calls.push("generation");
        generationCalls += 1;
        return generationCalls === 1 ? { processed: 1, action: "qa_queued" } : { processed: 1, action: "ready" };
      },
    });

    expect(response.status).toBe(200);
    expect(calls).toEqual(["maintenance", "generation", "generation"]);
    expect(await response.json()).toEqual({ processed: 2, submitted: 0, polled: 0, ready: 1, failed: 0, transferred: 0, qaQueued: 1, capturing: 0, retried: 0, maintenance: 0 });
  });

  it("returns a stable error without implementation details when a tick throws", async () => {
    vi.stubEnv("CRON_JOB_SECRET", "secret");
    const response = await handleVirtualTryOnTickRequest(request({}, { "x-cron-secret": "secret" }), {
      runMaintenance: async () => {
        throw new Error("https://signed.example/private-key");
      },
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "virtual_tryon_tick_failed" });
  });
});
