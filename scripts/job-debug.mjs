import dotenv from "dotenv";
import { Pool } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

const jobId = process.argv[2];

if (!jobId) {
  console.error("Usage: node scripts/job-debug.mjs <jobId>");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const queries = {
  job: `
    select
      id,
      user_id,
      status,
      user_visible_status,
      duration_seconds,
      aspect_ratio,
      credit_cost,
      reserved_ledger_id,
      final_video_key,
      cover_key,
      failure_reason,
      last_error,
      locked_by,
      locked_until,
      attempt_count,
      is_test,
      created_at,
      updated_at
    from video_jobs
    where id = $1
  `,
  events: `
    select
      to_status,
      reason,
      actor_type,
      actor_id,
      event_snapshot,
      created_at
    from job_state_events
    where video_job_id = $1
    order by created_at asc
  `,
  storyboards: `
    select
      id,
      status,
      selected_template_ids,
      storyboard_json,
      final_prompt_snapshot,
      confirmed_at,
      created_at,
      updated_at
    from storyboards
    where video_job_id = $1
    order by created_at desc
  `,
  segments: `
    select
      id,
      segment_index,
      status,
      template_id,
      provider,
      model,
      provider_task_id,
      provider_call_log_id,
      video_key,
      attempt_count,
      last_error,
      next_retry_at,
      created_at,
      updated_at
    from video_segments
    where video_job_id = $1
    order by segment_index asc, created_at asc
  `,
  stitch: `
    select
      id,
      status,
      segment_keys,
      final_video_key,
      cover_key,
      frame_keys,
      callback_snapshot,
      attempt_count,
      last_error,
      created_at,
      updated_at
    from stitch_jobs
    where video_job_id = $1
    order by created_at desc
  `,
  postQa: `
    select
      id,
      status,
      mode,
      frame_keys,
      failure_category,
      result_json,
      attempt_count,
      last_error,
      created_at,
      updated_at
    from post_qa_results
    where video_job_id = $1
    order by created_at desc
  `,
  moderation: `
    select
      id,
      source,
      decision,
      error_code,
      error_message,
      created_at
    from prompt_moderation_results
    where video_job_id = $1
    order by created_at desc
    limit 10
  `,
  providerLogs: `
    select
      provider,
      model,
      purpose,
      status,
      error_code,
      error_message,
      request_snapshot,
      response_summary,
      duration_ms,
      created_at
    from provider_call_logs
    where video_job_id = $1
    order by created_at desc
    limit 20
  `,
};

async function printSection(title, sql) {
  const result = await pool.query(sql, [jobId]);
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(result.rows, null, 2));
}

async function main() {
  for (const [title, sql] of Object.entries(queries)) {
    await printSection(title.toUpperCase(), sql);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
