#!/usr/bin/env node

const required = ["APP_URL", "INTERNAL_WORKER_SECRET", "CLOUD_RUN_STITCH_URL", "JOB_ID"];

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

async function main() {
  for (const name of required) {
    readEnv(name);
  }

  const appUrl = readEnv("APP_URL").replace(/\/+$/, "");
  const workerUrl = readEnv("CLOUD_RUN_STITCH_URL").replace(/\/+$/, "");
  const secret = readEnv("INTERNAL_WORKER_SECRET");
  const jobId = readEnv("JOB_ID");

  const health = await fetch(`${workerUrl}/health`);
  if (!health.ok) {
    throw new Error(`Cloud Run health check failed with status ${health.status}.`);
  }

  const trigger = await fetch(`${appUrl}/api/internal/stitch/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret,
    },
    body: JSON.stringify({ jobId }),
  });
  const triggerBody = await readJson(trigger);

  if (!trigger.ok) {
    throw new Error(
      `Stitch job trigger failed with status ${trigger.status}: ${JSON.stringify(
        triggerBody,
      )}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        cloudRunHealth: await readJson(health),
        stitchTrigger: triggerBody,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
