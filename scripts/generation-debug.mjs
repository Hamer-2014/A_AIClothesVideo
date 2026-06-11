import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

const jobId = process.argv[2];
const command = process.argv[3] ?? "status";

if (!jobId) {
  console.error("Usage: node scripts/generation-debug.mjs <jobId> [status|tick]");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function printSection(title, sql, params = [jobId]) {
  const result = await pool.query(sql, params);
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(result.rows, null, 2));
}

async function printStatus() {
  await printSection(
    "JOB",
    `
      select
        id,
        user_id,
        status,
        user_visible_status,
        locked_by,
        locked_until,
        attempt_count,
        last_error,
        failure_reason,
        updated_at
      from video_jobs
      where id = $1
    `,
  );
  await printSection(
    "SEGMENTS",
    `
      select
        id,
        segment_index,
        status,
        provider,
        model,
        provider_task_id,
        provider_call_log_id,
        video_key,
        last_error,
        attempt_count,
        updated_at
      from video_segments
      where video_job_id = $1
      order by segment_index asc
    `,
  );
  await printSection(
    "PROVIDER_LOGS",
    `
      select
        provider,
        model,
        purpose,
        status,
        error_code,
        error_message,
        provider_task_id,
        request_snapshot,
        response_summary,
        created_at
      from provider_call_logs
      where video_job_id = $1
      order by created_at desc
      limit 20
    `,
  );
  await printSection(
    "EVENTS",
    `
      select
        from_status,
        to_status,
        reason,
        event_snapshot,
        created_at
      from job_state_events
      where video_job_id = $1
      order by created_at desc
      limit 20
    `,
  );
}

async function runWorkerTick() {
  const secret = process.env.CRON_JOB_SECRET;
  if (!secret) {
    throw new Error("CRON_JOB_SECRET is not configured.");
  }

  const baseUrl =
    process.env.GENERATION_DEBUG_BASE_URL ??
    "http://localhost:3000";
  const endpoint = new URL("/api/internal/worker/tick", baseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-cron-secret": secret,
    },
  });
  const body = await response.text();

  console.log("\n=== WORKER_TICK ===");
  console.log(body);

  if (!response.ok) {
    throw new Error(`Worker tick failed with status ${response.status}.`);
  }
}

try {
  if (command === "tick") {
    await runWorkerTick();
  } else if (command !== "status") {
    throw new Error(`Unknown command: ${command}`);
  }

  await printStatus();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
