import { SUPPORT_EMAIL } from "@/lib/support-email";
import {
  CREEM_PRODUCTION_BASE_URL,
  getCreemEnvironment,
  isCreemLiveApiKey,
  isCreemPurchasesEnabled,
} from "@/lib/providers/creem/config";

export interface RuntimeHealthCheck {
  configured: boolean;
  missing: string[];
  status?: "ready" | "pending" | "missing";
}

export interface RuntimeHealthReport {
  ok: true;
  service: "a-ai-clothes-video";
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
    legalCompliance: RuntimeHealthCheck;
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

function buildOptionalPaymentCheck(
  env: EnvSource,
  environment: string,
): RuntimeHealthCheck {
  if (!isCreemPurchasesEnabled(env)) {
    return {
      configured: false,
      missing: [],
      status: "pending",
    };
  }

  const required = [
    "CREEM_API_KEY",
    "CREEM_WEBHOOK_SECRET",
    "CREEM_PRODUCT_ID_STARTER",
    "CREEM_PRODUCT_ID_CREATOR",
    "CREEM_PRODUCT_ID_STUDIO",
  ];
  const missing = required.filter((key) => !trimEnv(env, key));
  for (const key of required.filter((item) => item.startsWith("CREEM_PRODUCT_ID_"))) {
    const productId = trimEnv(env, key);
    if (productId && !productId.startsWith("prod_")) {
      missing.push(key);
    }
  }

  if (environment === "production") {
    if (trimEnv(env, "CREEM_BASE_URL") !== CREEM_PRODUCTION_BASE_URL) {
      missing.push("CREEM_BASE_URL");
    }
    if (!isCreemLiveApiKey(trimEnv(env, "CREEM_API_KEY"))) {
      missing.push("CREEM_API_KEY");
    }
  }
  return {
    configured: missing.length === 0,
    missing: [...new Set(missing)],
    status: missing.length === 0 ? "ready" : "missing",
  };
}

function buildModerationCheck(
  env: EnvSource,
  environment: string,
): RuntimeHealthCheck {
  if (environment !== "production") {
    return buildCheck(env, ["CREEM_MODERATION_API_KEY"]);
  }

  const missing: string[] = [];
  if (trimEnv(env, "PROMPT_MODERATION_MODE").toLowerCase() !== "creem") {
    missing.push("PROMPT_MODERATION_MODE");
  }
  if (trimEnv(env, "CREEM_BASE_URL") !== CREEM_PRODUCTION_BASE_URL) {
    missing.push("CREEM_BASE_URL");
  }
  if (!isCreemLiveApiKey(trimEnv(env, "CREEM_MODERATION_API_KEY"))) {
    missing.push("CREEM_MODERATION_API_KEY");
  }

  return {
    configured: missing.length === 0,
    missing,
    status: missing.length === 0 ? "ready" : "missing",
  };
}

function buildLegalComplianceCheck(
  env: EnvSource,
  environment: string,
): RuntimeHealthCheck {
  const required = [
    "LEGAL_CONTACT_EMAIL",
    "SUPPORT_EMAIL",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "ABUSE_HASH_SECRET",
  ];
  const check = buildCheck(env, required);
  if (environment === "production" || environment === "staging") {
    const missing = [...check.missing];
    if (trimEnv(env, "SUPPORT_EMAIL") !== SUPPORT_EMAIL) {
      missing.push("SUPPORT_EMAIL");
    }

    return {
      configured: missing.length === 0,
      missing: [...new Set(missing)],
      status: missing.length === 0 ? "ready" : "missing",
    };
  }
  return {
    ...check,
    status: check.configured ? "ready" : "pending",
  };
}

function buildAiProvidersCheck(env: EnvSource): RuntimeHealthCheck {
  const required = [
    "DEEPSEEK_API_KEY",
    "VISION_PROVIDER",
    "VISION_API_KEY",
    "VISION_MODEL_STANDARD",
    "VIDEO_GENERATION_PROVIDER",
    "VIDEO_GENERATION_MODEL",
  ];
  const provider = trimEnv(env, "VIDEO_GENERATION_PROVIDER").toLowerCase();

  if (provider === "apimart") {
    required.push("APIMART_API_KEY");
  } else if (provider === "evolink") {
    required.push("EVOLINK_API_KEY");
  }

  const missing = required.filter((key) => !trimEnv(env, key));
  if (provider && provider !== "apimart" && provider !== "evolink") {
    missing.push("VIDEO_GENERATION_PROVIDER");
  }

  return {
    configured: missing.length === 0,
    missing,
    status: missing.length === 0 ? "ready" : "missing",
  };
}

export function getRuntimeHealth(
  env: EnvSource = process.env,
): Omit<RuntimeHealthReport, "timestamp"> {
  const environment = getCreemEnvironment(env);
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
      "ABUSE_HASH_SECRET",
    ]),
    stitchWorker: buildCheck(env, [
      "CLOUD_RUN_STITCH_URL",
      "CLOUD_RUN_STITCH_SECRET",
    ]),
    billing: buildCheck(env, []),
    moderation: buildModerationCheck(env, environment),
    legalCompliance: buildLegalComplianceCheck(env, environment),
    creemPayment: buildOptionalPaymentCheck(env, environment),
    aiProviders: buildAiProvidersCheck(env),
  };

  const readinessChecks = Object.entries(checks).filter(
    ([, check]) => check.status !== "pending",
  );
  const missing = Array.from(
    new Set(readinessChecks.flatMap(([, check]) => check.missing)),
  ).sort();

  return {
    ok: true,
    service: "a-ai-clothes-video",
    environment,
    ready: missing.length === 0,
    checks,
    summary: {
      missing,
    },
  };
}
