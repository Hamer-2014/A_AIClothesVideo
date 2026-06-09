#!/usr/bin/env node

import { HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

import {
  buildMissingJobIdMessage,
  buildSmokeArtifactKeys,
  classifySmokeOutcome,
  normalizeSmokeMode,
  resolveSmokeJobId,
  shouldTriggerStitch,
} from "./lib/backend-smoke-utils.mjs";

loadEnv({ path: ".env.local" });
loadEnv();

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

async function listCandidateJobs(sql) {
  const rows = await sql`
    select id, status, is_test, updated_at
    from video_jobs
    where deleted_at is null
      and status in ('stitching_queued', 'stitching_running', 'post_qa_queued', 'post_qa_running', 'deliverable')
    order by updated_at desc
    limit 8
  `;

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    is_test: Boolean(row.is_test),
    updated_at:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  }));
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logProgress(message, details) {
  const suffix = details
    ? ` ${JSON.stringify(details)}`
    : "";
  console.log(`[backend-smoke] ${message}${suffix}`);
}

function parseJsonValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value ?? null;
}

function asStringArray(value) {
  const parsed = parseJsonValue(value);
  return Array.isArray(parsed)
    ? parsed.filter((item) => typeof item === "string")
    : [];
}

function createR2Client() {
  const accountId = readEnv("CLOUDFLARE_R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: readEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
      secretAccessKey: readEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    },
  });
}

async function headObject(s3, bucket, key) {
  try {
    await s3.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

async function listFrameKeys(s3, bucket, prefix) {
  const response = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    }),
  );

  return (response.Contents ?? [])
    .map((item) => item.Key)
    .filter((key) => typeof key === "string");
}

async function checkWorkerHealth(workerUrl) {
  const response = await fetch(`${workerUrl}/health`);
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Cloud Run health check failed with status ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function triggerStitchJob({ appUrl, secret, jobId }) {
  const response = await fetch(`${appUrl}/api/internal/stitch/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": secret,
    },
    body: JSON.stringify({ jobId }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Stitch job trigger failed with status ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function triggerWorkerTick({ appUrl, cronSecret }) {
  const response = await fetch(`${appUrl}/api/internal/worker/tick`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cron-secret": cronSecret,
    },
  });
  const body = await readJson(response);
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
}

async function loadJobSnapshot(sql, jobId) {
  const [job] = await sql`
    select
      id,
      status,
      user_visible_status,
      post_qa_mode,
      final_video_key,
      cover_key,
      updated_at
    from video_jobs
    where id = ${jobId}
    limit 1
  `;
  if (!job) {
    throw new Error(`Video job not found: ${jobId}`);
  }

  const [stitchJob] = await sql`
    select
      id,
      status,
      segment_keys,
      final_video_key,
      cover_key,
      frame_keys,
      updated_at,
      created_at
    from stitch_jobs
    where video_job_id = ${jobId}
    order by created_at desc
    limit 1
  `;

  const [postQa] = await sql`
    select
      id,
      status,
      mode,
      failure_category,
      frame_keys,
      created_at
    from post_qa_results
    where video_job_id = ${jobId}
    order by created_at desc
    limit 1
  `;

  const ledger = await sql`
    select type, amount, reason, created_at
    from credit_ledger
    where related_job_id = ${jobId}
    order by created_at asc
  `;

  const segments = await sql`
    select segment_index, status, provider_task_id, video_key
    from video_segments
    where video_job_id = ${jobId}
    order by segment_index asc
  `;

  return {
    job,
    stitchJob: stitchJob
      ? {
          ...stitchJob,
          segment_keys: asStringArray(stitchJob.segment_keys),
          frame_keys: asStringArray(stitchJob.frame_keys),
        }
      : null,
    postQa: postQa
      ? {
          ...postQa,
          frame_keys: asStringArray(postQa.frame_keys),
        }
      : null,
    ledger,
    segments,
  };
}

async function verifyArtifacts({ s3, bucket, jobId, snapshot }) {
  const expected = buildSmokeArtifactKeys(jobId);
  const finalVideoKey =
    snapshot.job.final_video_key ||
    snapshot.stitchJob?.final_video_key ||
    expected.finalVideoKey;
  const finalVideoExists = await headObject(s3, bucket, finalVideoKey);
  const frameKeys = await listFrameKeys(s3, bucket, expected.framePrefix);

  return {
    expected,
    finalVideoKey,
    finalVideoExists,
    frameKeys,
    frameCount: frameKeys.length,
  };
}

function assertSuccess({ mode, outcome, artifacts, snapshot }) {
  if (!outcome.success) {
    throw new Error(
      `Backend smoke ended in failure state: ${outcome.reason} (job=${snapshot.job.status}, stitch=${snapshot.stitchJob?.status ?? "missing"}, postQa=${snapshot.postQa?.status ?? "missing"})`,
    );
  }

  if (!artifacts.finalVideoExists) {
    throw new Error(`Expected stitched final video missing: ${artifacts.finalVideoKey}`);
  }

  if (artifacts.frameCount === 0) {
    throw new Error(
      `Expected QA frames under prefix ${artifacts.expected.framePrefix}, but none were found.`,
    );
  }

  if (mode === "full") {
    const ledgerTypes = snapshot.ledger.map((entry) => entry.type);
    if (!ledgerTypes.includes("capture")) {
      throw new Error(
        `Full smoke expected credit capture, but ledger only has: ${ledgerTypes.join(", ")}`,
      );
    }
  }
}

async function main() {
  const mode = normalizeSmokeMode(process.env.SMOKE_MODE);
  const appUrl = readEnv("APP_URL").replace(/\/+$/, "");
  const workerUrl = readEnv("CLOUD_RUN_STITCH_URL").replace(/\/+$/, "");
  const internalSecret = readEnv("INTERNAL_WORKER_SECRET");
  const databaseUrl = readEnv("DATABASE_URL");
  const bucket = readEnv("CLOUDFLARE_R2_BUCKET");
  const cronSecret = optionalEnv("CRON_JOB_SECRET");
  const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10 * 60 * 1000);
  const pollIntervalMs = Number(process.env.SMOKE_POLL_INTERVAL_MS ?? 5000);

  const sql = neon(databaseUrl);
  const jobId = resolveSmokeJobId({ argv: process.argv.slice(2) });
  if (!jobId) {
    const candidates = await listCandidateJobs(sql);
    throw new Error(buildMissingJobIdMessage({ mode, candidates }));
  }
  const s3 = createR2Client();

  const cloudRunHealth = await checkWorkerHealth(workerUrl);
  logProgress("Cloud Run health check passed.");
  let initialSnapshot = await loadJobSnapshot(sql, jobId);
  let stitchTrigger = {
    skipped: true,
    reason: "existing_stitch_state_reused",
  };

  if (
    shouldTriggerStitch({
      mode,
      jobStatus: initialSnapshot.job.status,
      stitchStatus: initialSnapshot.stitchJob?.status ?? null,
    })
  ) {
    logProgress("Triggering stitch job.", {
      jobId,
      jobStatus: initialSnapshot.job.status,
      stitchStatus: initialSnapshot.stitchJob?.status ?? null,
    });
    stitchTrigger = await triggerStitchJob({
      appUrl,
      secret: internalSecret,
      jobId,
    });
    initialSnapshot = await loadJobSnapshot(sql, jobId);
  } else {
    logProgress("Reusing existing stitch/post-qa state.", {
      jobId,
      jobStatus: initialSnapshot.job.status,
      stitchStatus: initialSnapshot.stitchJob?.status ?? null,
    });
  }

  const deadline = Date.now() + timeoutMs;
  const tickEvents = [];
  let snapshot = initialSnapshot;
  let artifacts = null;
  let outcome = null;

  while (Date.now() < deadline) {
    snapshot = await loadJobSnapshot(sql, jobId);
    logProgress("Polling job state.", {
      jobId,
      mode,
      jobStatus: snapshot.job.status,
      stitchStatus: snapshot.stitchJob?.status ?? null,
      postQaStatus: snapshot.postQa?.status ?? null,
    });

    if (
      mode === "full" &&
      cronSecret &&
      (snapshot.job.status === "post_qa_queued" ||
        snapshot.job.status === "post_qa_running")
    ) {
      logProgress("Triggering worker tick for post-qa progression.", {
        jobId,
        status: snapshot.job.status,
      });
      tickEvents.push(
        await triggerWorkerTick({
          appUrl,
          cronSecret,
        }),
      );
      snapshot = await loadJobSnapshot(sql, jobId);
    }

    artifacts = await verifyArtifacts({
      s3,
      bucket,
      jobId,
      snapshot,
    });

    outcome = classifySmokeOutcome({
      mode,
      jobStatus: snapshot.job.status,
      stitchStatus: snapshot.stitchJob?.status ?? null,
      postQaStatus: snapshot.postQa?.status ?? null,
    });

    if (outcome.done) {
      break;
    }

    await sleep(pollIntervalMs);
  }

  if (!snapshot || !artifacts || !outcome) {
    throw new Error("Backend smoke did not produce a final snapshot.");
  }

  if (!outcome.done) {
    throw new Error(
      `Backend smoke timed out after ${timeoutMs}ms (job=${snapshot.job.status}, stitch=${snapshot.stitchJob?.status ?? "missing"}, postQa=${snapshot.postQa?.status ?? "missing"})`,
    );
  }

  assertSuccess({ mode, outcome, artifacts, snapshot });

  console.log(
    JSON.stringify(
      {
        mode,
        cloudRunHealth,
        stitchTrigger,
        outcome,
        artifacts,
        snapshot,
        tickEvents,
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
