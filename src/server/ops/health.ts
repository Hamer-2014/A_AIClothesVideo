export interface RuntimeHealthCheck {
  configured: boolean;
  missing: string[];
  status?: "ready" | "pending" | "missing";
}

export interface RuntimeHealthReport {
  ok: true;
  service: "a-runwaytools";
  environment: string;
  ready: boolean;
  timestamp: string;
  checks: {
    database: RuntimeHealthCheck;
    auth: RuntimeHealthCheck;
    storage: RuntimeHealthCheck;
    internalSecurity: RuntimeHealthCheck;
    stitchWorker: RuntimeHealthCheck;
    billing: RuntimeHealthCheck;
    moderation: RuntimeHealthCheck;
    creemPayment: RuntimeHealthCheck;
    aiProviders: RuntimeHealthCheck;
  };
  summary: {
    missing: string[];
  };
}

type EnvSource = Record<string, string | undefined>;

function trimEnv(env: EnvSource, key: string) {
  return env[key]?.trim() ?? "";
}

function buildCheck(env: EnvSource, keys: string[]): RuntimeHealthCheck {
  const missing = keys.filter((key) => !trimEnv(env, key));
  return {
    configured: missing.length === 0,
    missing,
    status: missing.length === 0 ? "ready" : "missing",
  };
}

function buildOptionalPaymentCheck(env: EnvSource): RuntimeHealthCheck {
  const required = ["CREEM_API_KEY", "CREEM_WEBHOOK_SECRET"];
  const missing = required.filter((key) => !trimEnv(env, key));
  return {
    configured: missing.length === 0,
    missing,
    status: missing.length === 0 ? "ready" : "pending",
  };
}

function videoGenerationProviderKeys(env: EnvSource) {
  const provider = trimEnv(env, "VIDEO_GENERATION_PROVIDER").toLowerCase() || "evolink";

  if (provider === "evolink") {
    return ["EVOLINK_API_KEY"];
  }

  if (provider === "apimart") {
    return ["APIMART_API_KEY"];
  }

  return ["VIDEO_GENERATION_PROVIDER_UNSUPPORTED"];
}

export function getRuntimeHealth(
  env: EnvSource = process.env,
): Omit<RuntimeHealthReport, "timestamp"> {
  const videoGenerationKeys = videoGenerationProviderKeys(env);
  const checks = {
    database: buildCheck(env, ["DATABASE_URL"]),
    auth: buildCheck(env, ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"]),
    storage: buildCheck(env, [
      "CLOUDFLARE_R2_ACCOUNT_ID",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_R2_BUCKET",
    ]),
    internalSecurity: buildCheck(env, [
      "INTERNAL_WORKER_SECRET",
      "CRON_JOB_SECRET",
    ]),
    stitchWorker: buildCheck(env, [
      "CLOUD_RUN_STITCH_URL",
      "CLOUD_RUN_STITCH_SECRET",
    ]),
    billing: buildCheck(env, []),
    moderation: buildCheck(env, ["CREEM_MODERATION_API_KEY"]),
    creemPayment: buildOptionalPaymentCheck(env),
    aiProviders: buildCheck(env, [
      "DEEPSEEK_API_KEY",
      "VISION_PROVIDER",
      "VISION_API_KEY",
      "VISION_MODEL_STANDARD",
      ...videoGenerationKeys,
    ]),
  };

  const readinessChecks = Object.entries(checks).filter(
    ([name]) => name !== "creemPayment",
  );
  const missing = Array.from(
    new Set(readinessChecks.flatMap(([, check]) => check.missing)),
  ).sort();

  return {
    ok: true,
    service: "a-runwaytools",
    environment: trimEnv(env, "NODE_ENV") || "development",
    ready: missing.length === 0,
    checks,
    summary: {
      missing,
    },
  };
}
