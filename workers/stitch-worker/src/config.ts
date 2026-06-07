export interface WorkerConfig {
  workerSecret: string;
  bucket: string;
  r2Endpoint: string;
  r2AccessKeyId: string;
  r2SecretAccessKey: string;
}

const requiredEnv = [
  "CLOUD_RUN_STITCH_SECRET",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
] as const;

function requireEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: (typeof requiredEnv)[number],
) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing stitch-worker environment variable: ${key}`);
  }

  return value;
}

export function readWorkerConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): WorkerConfig {
  const workerSecret = requireEnv(env, "CLOUD_RUN_STITCH_SECRET");
  const explicitEndpoint = env.CLOUDFLARE_R2_ENDPOINT?.trim();
  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const r2Endpoint =
    explicitEndpoint ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!r2Endpoint) {
    throw new Error(
      "Missing stitch-worker environment variable: CLOUDFLARE_R2_ACCOUNT_ID",
    );
  }

  return {
    workerSecret,
    bucket: requireEnv(env, "CLOUDFLARE_R2_BUCKET"),
    r2Endpoint,
    r2AccessKeyId: requireEnv(env, "CLOUDFLARE_R2_ACCESS_KEY_ID"),
    r2SecretAccessKey: requireEnv(env, "CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
  };
}
