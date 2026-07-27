export const CREEM_PRODUCTION_BASE_URL = "https://api.creem.io";

type EnvSource = Record<string, string | undefined>;

const purchaseProductKeys = [
  "CREEM_PRODUCT_ID_STARTER",
  "CREEM_PRODUCT_ID_CREATOR",
  "CREEM_PRODUCT_ID_STUDIO",
] as const;

const purchaseRequiredKeys = [
  "CREEM_API_KEY",
  "CREEM_WEBHOOK_SECRET",
  ...purchaseProductKeys,
] as const;

const knownEnvironments = new Set([
  "production",
  "staging",
  "preview",
  "development",
  "test",
]);

export function getCreemEnvironment(env: EnvSource = process.env) {
  const appEnvironment = env.APP_ENV?.trim().toLowerCase();
  if (appEnvironment && knownEnvironments.has(appEnvironment)) {
    return appEnvironment;
  }

  const nodeEnvironment = env.NODE_ENV?.trim().toLowerCase();
  return nodeEnvironment && knownEnvironments.has(nodeEnvironment)
    ? nodeEnvironment
    : "development";
}

export function isCreemProductionEnvironment(env: EnvSource = process.env) {
  return getCreemEnvironment(env) === "production";
}

export function isCreemPurchasesEnabled(env: EnvSource = process.env) {
  return env.CREEM_PURCHASES_ENABLED?.trim().toLowerCase() === "true";
}

export function getCreemPurchaseReadiness(env: EnvSource = process.env) {
  const enabled = isCreemPurchasesEnabled(env);
  if (!enabled) {
    return { enabled, missing: [] as string[], ready: false };
  }

  const rawValue = (key: string) => env[key] ?? "";
  const value = (key: string) => rawValue(key).trim();
  const missing: string[] = purchaseRequiredKeys.filter((key) => !value(key));

  if (rawValue("CREEM_WEBHOOK_SECRET") !== value("CREEM_WEBHOOK_SECRET")) {
    missing.push("CREEM_WEBHOOK_SECRET");
  }

  for (const key of purchaseProductKeys) {
    const productId = value(key);
    if (productId && !productId.startsWith("prod_")) {
      missing.push(key);
    }

    if (
      productId &&
      purchaseProductKeys.some(
        (otherKey) => otherKey !== key && value(otherKey) === productId,
      )
    ) {
      missing.push(key);
    }
  }

  if (isCreemProductionEnvironment(env)) {
    if (value("CREEM_BASE_URL") !== CREEM_PRODUCTION_BASE_URL) {
      missing.push("CREEM_BASE_URL");
    }
    if (!isCreemLiveApiKey(value("CREEM_API_KEY"))) {
      missing.push("CREEM_API_KEY");
    }
  }

  const uniqueMissing = [...new Set<string>(missing)];
  return {
    enabled,
    missing: uniqueMissing,
    ready: uniqueMissing.length === 0,
  };
}

export function isCreemLiveApiKey(value: string) {
  return value.startsWith("creem_") && !value.startsWith("creem_test_");
}
