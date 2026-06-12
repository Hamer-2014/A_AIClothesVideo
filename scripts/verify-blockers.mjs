#!/usr/bin/env node

import { neon } from "@neondatabase/serverless";
import { config as loadEnv } from "dotenv";

import {
  buildBlockerVerificationReport,
  evaluateAuditEvidence,
  evaluateFailureCompensationEvidence,
  evaluatePaidDeliveryEvidence,
} from "./lib/blocker-verification-utils.mjs";

loadEnv({ path: ".env.local" });
loadEnv();

function readEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function asStringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string");
  }
  if (typeof value === "string") {
    if (value.startsWith("{") && value.endsWith("}")) {
      return value
        .slice(1, -1)
        .split(",")
        .map((item) => item.trim().replace(/^"|"$/g, ""))
        .filter(Boolean);
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item) => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function loadPaidDeliveryCandidates(sql) {
  const rows = await sql`
    select
      vj.id,
      vj.status,
      vj.credit_cost,
      vj.final_video_key,
      coalesce(
        array_remove(array_agg(distinct cl.type::text), null),
        array[]::text[]
      ) as ledger_types,
      coalesce(max(jsonb_array_length(pqr.frame_keys::jsonb)), 0) as qa_frame_count,
      max(vj.updated_at) as updated_at
    from video_jobs vj
    left join credit_ledger cl on cl.related_job_id = vj.id
    left join post_qa_results pqr on pqr.video_job_id = vj.id
    where vj.deleted_at is null
      and vj.credit_cost > 0
      and vj.status = 'deliverable'
    group by vj.id
    order by max(vj.updated_at) desc
    limit 10
  `;

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    creditCost: Number(row.credit_cost),
    ledgerTypes: asStringArray(row.ledger_types),
    finalVideoKey: row.final_video_key,
    qaFrameCount: Number(row.qa_frame_count ?? 0),
    updatedAt: row.updated_at,
  }));
}

async function loadFailureCompensationCandidates(sql) {
  const rows = await sql`
    select
      vj.id,
      vj.status,
      vj.credit_cost,
      coalesce(
        array_remove(array_agg(distinct cl.type::text), null),
        array[]::text[]
      ) as ledger_types,
      count(distinct jse.id) as state_event_count,
      max(vj.updated_at) as updated_at
    from video_jobs vj
    left join credit_ledger cl on cl.related_job_id = vj.id
    left join job_state_events jse on jse.video_job_id = vj.id
    where vj.deleted_at is null
      and vj.credit_cost > 0
      and vj.status in ('failed_released', 'failed_refunded')
    group by vj.id
    order by max(vj.updated_at) desc
    limit 10
  `;

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    creditCost: Number(row.credit_cost),
    ledgerTypes: asStringArray(row.ledger_types),
    stateEventCount: Number(row.state_event_count ?? 0),
    updatedAt: row.updated_at,
  }));
}

async function loadAuditEvidence(sql) {
  const rows = await sql`
    select action, count(*)::int as count
    from admin_audit_logs
    where action in (
      'provider_key:create',
      'provider_key:rotate',
      'credits:admin_adjust',
      'job:mark_undeliverable',
      'job:retry_segment',
      'job:reopen_post_qa'
    )
    group by action
    order by action asc
  `;

  return rows.map((row) => ({
    action: row.action,
    count: Number(row.count),
  }));
}

function printHumanReport(report) {
  console.log(report.summary);
  for (const check of report.checks) {
    const status = check.passed ? "PASS" : "BLOCKED";
    console.log(`\n[${status}] ${check.name}`);
    console.log(`Reason: ${check.reason}`);
    if (check.jobId) {
      console.log(`Job: ${check.jobId}`);
    }
    if (!check.passed && check.nextSteps.length > 0) {
      console.log("Next steps:");
      for (const step of check.nextSteps) {
        console.log(`- ${step}`);
      }
    }
  }
}

async function main() {
  const sql = neon(readEnv("DATABASE_URL"));
  const paidDeliveryRows = await loadPaidDeliveryCandidates(sql);
  const failureRows = await loadFailureCompensationCandidates(sql);
  const auditRows = await loadAuditEvidence(sql);

  const report = buildBlockerVerificationReport({
    paidDelivery: evaluatePaidDeliveryEvidence(paidDeliveryRows),
    failureCompensation: evaluateFailureCompensationEvidence(failureRows),
    auditEvidence: evaluateAuditEvidence(auditRows),
  });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
