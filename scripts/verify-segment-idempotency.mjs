#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
  };
}

async function findDuplicateStoryboardSegments(sql) {
  return sql`
    select
      storyboard_id,
      segment_index,
      count(*)::int as duplicate_count,
      jsonb_agg(
        jsonb_build_object(
          'id', id,
          'videoJobId', video_job_id,
          'status', status,
          'createdAt', created_at,
          'updatedAt', updated_at
        )
        order by created_at asc, id asc
      ) as segments
    from video_segments
    where storyboard_id is not null
    group by storyboard_id, segment_index
    having count(*) > 1
    order by storyboard_id asc, segment_index asc
  `;
}

function printJson(rows) {
  console.log(JSON.stringify({ duplicateGroups: rows }, null, 2));
}

function printHuman(rows) {
  if (rows.length === 0) {
    console.log(
      "No duplicate video_segments rows found for (storyboard_id, segment_index).",
    );
    return;
  }

  console.error(
    `Found ${rows.length} duplicate (storyboard_id, segment_index) group(s):`,
  );
  for (const row of rows) {
    console.error(
      `\nStoryboard ${row.storyboard_id}, segment_index ${row.segment_index}: ${row.duplicate_count} rows`,
    );
    for (const segment of row.segments ?? []) {
      console.error(
        [
          `- segment ${segment.id}`,
          `job ${segment.videoJobId}`,
          `status ${segment.status}`,
          `created ${segment.createdAt}`,
        ].join(" | "),
      );
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sql = neon(readEnv("DATABASE_URL"));
  const rows = await findDuplicateStoryboardSegments(sql);

  if (args.json) {
    printJson(rows);
  } else {
    printHuman(rows);
  }

  if (rows.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
