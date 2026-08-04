#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { config as loadEnv } from "dotenv";

const defaultIntervalMs = 5_000;
const requestTimeoutMs = 30_000;

function required(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

export function validateLocalVirtualTryOnWorkerConfig(env) {
  if (env.APP_ENV?.trim().toLowerCase() !== "development") {
    throw new Error("The local Virtual try-on worker only runs in a development environment.");
  }
  if ([env.VERCEL_ENV, env.NODE_ENV].some((value) => value?.trim().toLowerCase() === "production")) {
    throw new Error("The local Virtual try-on worker refuses a production deployment environment.");
  }
  if (env.VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST?.trim().toLowerCase() !== "true") {
    throw new Error("Set VIRTUAL_TRYON_LOCAL_WORKER_ACKNOWLEDGE_COST=true to acknowledge real provider costs.");
  }

  const appUrl = required(env, "APP_URL");
  let baseUrl;
  try {
    baseUrl = new URL(appUrl);
  } catch {
    throw new Error("APP_URL must be a valid loopback URL.");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (!loopbackHosts.has(baseUrl.hostname) || !["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("The local Virtual try-on worker requires a loopback APP_URL.");
  }

  const allowlist = new Set(required(env, "VIRTUAL_TRYON_LOCAL_DATABASE_HOST_ALLOWLIST")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean));
  let databaseUrl;
  try {
    databaseUrl = new URL(required(env, "DATABASE_URL"));
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL.");
  }
  if (!allowlist.has(databaseUrl.hostname.toLowerCase())) {
    throw new Error("The local Virtual try-on worker database host is not allowlisted.");
  }
  const cronSecret = required(env, "CRON_JOB_SECRET");
  const requestedInterval = Number(env.VIRTUAL_TRYON_LOCAL_WORKER_INTERVAL_MS ?? defaultIntervalMs);
  if (!Number.isInteger(requestedInterval) || requestedInterval < 1_000 || requestedInterval > 60_000) {
    throw new Error("VIRTUAL_TRYON_LOCAL_WORKER_INTERVAL_MS must be an integer from 1000 to 60000.");
  }

  return {
    endpoint: new URL("/api/internal/virtual-try-on/tick", baseUrl).toString(),
    cronSecret,
    intervalMs: requestedInterval,
  };
}

function safeErrorCode(payload) {
  const value = payload && typeof payload === "object" && typeof payload.error === "string"
    ? payload.error
    : "unknown_error";
  return /^[a-z0-9_-]{1,80}$/i.test(value) ? value : "unknown_error";
}

export async function runVirtualTryOnTick(config, fetchImpl = fetch) {
  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": config.cronSecret,
    },
    body: JSON.stringify({ limit: 1 }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Virtual try-on tick request failed with ${response.status}: ${safeErrorCode(payload)}`);
  }
  if (!payload || typeof payload !== "object" || typeof payload.processed !== "number") {
    throw new Error("Virtual try-on tick returned an invalid response.");
  }
  return payload;
}

function waitForNextTick(intervalMs, signal) {
  return new Promise((resolveWait) => {
    if (signal?.aborted) return resolveWait();
    const timeout = setTimeout(resolveWait, intervalMs);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      resolveWait();
    }, { once: true });
  });
}

export async function runLocalVirtualTryOnWorker({
  config,
  once = false,
  signal,
  tick = runVirtualTryOnTick,
  log = console.log,
}) {
  do {
    try {
      const result = await tick(config);
      log(`[virtual-try-on] processed=${result.processed} submitted=${result.submitted ?? 0} polled=${result.polled ?? 0} ready=${result.ready ?? 0}`);
    } catch (error) {
      if (once) throw error;
      log(`[virtual-try-on] ${error instanceof Error ? error.message : "tick failed"}`);
    }
    if (once || signal?.aborted) return;
    await waitForNextTick(config.intervalMs, signal);
  } while (!signal?.aborted);
}

async function main() {
  loadEnv({ path: ".env.local" });
  loadEnv();
  const config = validateLocalVirtualTryOnWorkerConfig(process.env);
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  await runLocalVirtualTryOnWorker({
    config,
    once: process.argv.includes("--once"),
    signal: controller.signal,
  });
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Virtual try-on local worker failed.");
    process.exitCode = 1;
  });
}
