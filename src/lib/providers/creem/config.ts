export const CREEM_PRODUCTION_BASE_URL = "https://api.creem.io";

type EnvSource = Record<string, string | undefined>;

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

export function isCreemLiveApiKey(value: string) {
  return value.startsWith("creem_") && !value.startsWith("creem_test_");
}
