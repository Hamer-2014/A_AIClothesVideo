import { describe, expect, it, vi } from "vitest";

import {
  runLocalVirtualTryOnWorker,
  runVirtualTryOnTick,
  validateLocalVirtualTryOnWorkerConfig,
} from "./virtual-try-on-dev-worker.mjs";

describe("virtual try-on local worker", () => {
  const validEnv = {
    APP_ENV: "development",
    APP_URL: "http://localhost:3000",
    CRON_JOB_SECRET: "cron-secret-value",
    DATABASE_URL: "postgresql://dev:dev@localhost:5432/aiclothes_dev",
    VIRTUAL_TRYON_LOCAL_DATABASE_HOST_ALLOWLIST: "localhost,127.0.0.1",
    VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST: "true",
  };

  it("refuses production and requires explicit cost acknowledgement", () => {
    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      APP_ENV: "production",
    })).toThrow("development environment");

    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST: "false",
    })).toThrow("VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST=true");

    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      APP_URL: "https://tools.runwaymotion.com",
    })).toThrow("loopback APP_URL");
  });

  it("refuses production deployment markers and databases outside the explicit allowlist", () => {
    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      VERCEL_ENV: "production",
    })).toThrow("production deployment");

    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      NODE_ENV: "production",
    })).toThrow("production deployment");

    expect(() => validateLocalVirtualTryOnWorkerConfig({
      ...validEnv,
      DATABASE_URL: "postgresql://app:secret@prod-db.example:5432/app",
    })).toThrow("database host is not allowlisted");
  });

  it("posts a bounded tick with the cron secret", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      processed: 1,
      submitted: 1,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const config = validateLocalVirtualTryOnWorkerConfig(validEnv);

    const result = await runVirtualTryOnTick(config, fetchImpl);

    expect(result).toMatchObject({ processed: 1, submitted: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3000/api/internal/virtual-try-on/tick",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-cron-secret": "cron-secret-value" }),
        body: JSON.stringify({ limit: 1 }),
      }),
    );
  });

  it("reports a safe error without echoing the secret", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "unauthorized",
    }), { status: 401 }));
    const config = validateLocalVirtualTryOnWorkerConfig(validEnv);

    const result = runVirtualTryOnTick(config, fetchImpl);

    await expect(result).rejects.toThrow("tick request failed with 401: unauthorized");
    await expect(result).rejects.not.toThrow("cron-secret-value");
  });

  it("supports a one-shot run without scheduling another request", async () => {
    const tick = vi.fn().mockResolvedValue({ processed: 0 });
    const log = vi.fn();

    await runLocalVirtualTryOnWorker({
      config: validateLocalVirtualTryOnWorkerConfig(validEnv),
      once: true,
      tick,
      log,
    });

    expect(tick).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("processed=0"));
  });
});
