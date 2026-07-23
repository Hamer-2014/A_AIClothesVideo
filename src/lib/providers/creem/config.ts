export const CREEM_PRODUCTION_BASE_URL = "https://api.creem.io";

type EnvSource = Record<string, string | undefined>;

export function getCreemEnvironment(env: EnvSource = process.env) {
  return (
    env.APP_ENV?.trim().toLowerCase() ||
    env.NODE_ENV?.trim().toLowerCase() ||
    "development"
  );
}

export function isCreemProductionEnvironment(env: EnvSource = process.env) {
  return getCreemEnvironment(env) === "production";
}

export function isCreemLiveApiKey(value: string) {
  return value.startsWith("creem_") && !value.startsWith("creem_test_");
}
