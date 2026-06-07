import { S3Client } from "@aws-sdk/client-s3";

export type R2Env = Record<string, string | undefined>;

const requiredR2Env = [
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
] as const;

export function getR2Config(env: R2Env = process.env) {
  for (const key of requiredR2Env) {
    if (!env[key]) {
      throw new Error(`${key} is required for R2 storage.`);
    }
  }

  const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID!;

  return {
    accountId,
    accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    bucket: env.CLOUDFLARE_R2_BUCKET!,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  };
}

export function createR2Client(config = getR2Config()) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
