import { randomUUID } from "node:crypto";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import pg from "pg";

const required = ["APP_URL", "DATABASE_URL", "CRON_JOB_SECRET", "APIMART_API_KEY", "VIRTUAL_TRYON_MODEL_BASE_KEY", "CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_BUCKET", "VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST", "VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST", "VISION_PROVIDER", "VISION_API_KEY", "VISION_MODEL_STRICT", "PROMPT_MODERATION_MODE", "CREEM_MODERATION_API_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());
if (process.env.VISION_PROVIDER && process.env.VISION_PROVIDER !== "openai" && !process.env.VISION_BASE_URL?.trim()) missing.push("VISION_BASE_URL");
if (process.env.APP_ENV !== "staging" || process.env.VIRTUAL_TRYON_SMOKE_ACKNOWLEDGE_COST !== "true" || missing.length) {
  const reasons = [process.env.APP_ENV !== "staging" ? "APP_ENV=staging" : null, process.env.VIRTUAL_TRYON_SMOKE_ACKNOWLEDGE_COST !== "true" ? "VIRTUAL_TRYON_SMOKE_ACKNOWLEDGE_COST=true" : null, ...missing].filter(Boolean);
  console.log(`SKIP: virtual try-on staging smoke requires ${reasons.join(", ")}`);
  process.exit(0);
}

const appUrl = process.env.APP_URL.replace(/\/+$/, "");
const existingJobId = process.env.VIRTUAL_TRYON_SMOKE_JOB_ID?.trim();
let jobId = existingJobId;
let createdByScript = false;
if (!jobId) {
  const cookie = process.env.VIRTUAL_TRYON_SMOKE_SESSION_COOKIE?.trim();
  const frontAssetId = process.env.VIRTUAL_TRYON_SMOKE_FRONT_ASSET_ID?.trim();
  if (!cookie || !frontAssetId) {
    console.log("SKIP: virtual try-on staging smoke requires VIRTUAL_TRYON_SMOKE_JOB_ID or VIRTUAL_TRYON_SMOKE_SESSION_COOKIE and VIRTUAL_TRYON_SMOKE_FRONT_ASSET_ID");
    process.exit(0);
  }
  const response = await fetch(`${appUrl}/api/virtual-try-on`, { method: "POST", headers: { "content-type": "application/json", cookie, "idempotency-key": `virtual-try-on-smoke:${randomUUID()}` }, body: JSON.stringify({ mode: "front_only", skuName: "staging-smoke", isTest: true, sourceAssetIds: { front: frontAssetId } }) });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body.jobId !== "string") throw new Error(`virtual_tryon_smoke_create_failed_${response.status}`);
  jobId = body.jobId;
  createdByScript = true;
}

const deadline = Date.now() + 12 * 60_000;
let terminal;
while (Date.now() < deadline) {
  const response = await fetch(`${appUrl}/api/internal/virtual-try-on/tick`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${process.env.CRON_JOB_SECRET}` }, body: JSON.stringify({ limit: 1 }) });
  if (!response.ok) throw new Error(`virtual_tryon_smoke_tick_failed_${response.status}`);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query("select status, is_test from virtual_tryon_jobs where id = $1", [jobId]);
    terminal = rows[0]?.status;
  } finally { await pool.end(); }
  if (["ready", "locked", "failed_unreserved", "failed_released", "failed_refunded"].includes(terminal)) break;
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
if (!terminal || !["ready", "locked"].includes(terminal)) throw new Error(`virtual_tryon_smoke_terminal_${terminal ?? "timeout"}`);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query("select j.status, j.is_test, j.reserved_ledger_id, j.captured_ledger_id, p.id as pack_id, a.r2_key, f.verdict, (select count(*)::int from garment_fidelity_results x where x.appearance_pack_id = p.id and x.scope = 'cross_view') as cross_count, reserve_entry.id as reserve_entry_id, reserve_entry.type as reserve_type, reserve_entry.related_job_id as reserve_job_id, capture_entry.id as capture_entry_id, capture_entry.type as capture_type, capture_entry.related_job_id as capture_job_id from virtual_tryon_jobs j join appearance_packs p on p.virtual_tryon_job_id = j.id join appearance_pack_assets a on a.appearance_pack_id = p.id and a.view = 'front' left join garment_fidelity_results f on f.appearance_pack_id = p.id and f.scope = 'view' and f.view = 'front' left join credit_ledger reserve_entry on reserve_entry.id = j.reserved_ledger_id left join credit_ledger capture_entry on capture_entry.id = j.captured_ledger_id where j.id = $1 order by p.version desc limit 1", [jobId]);
  const row = rows[0];
  if (!row?.reserved_ledger_id || !row?.captured_ledger_id || !row?.reserve_entry_id || row.reserve_type !== "reserve" || row.reserve_job_id !== jobId || !row?.capture_entry_id || row.capture_type !== "capture" || row.capture_job_id !== jobId || !row?.r2_key || row.verdict !== "pass" || row.cross_count !== 0 || (createdByScript && row.is_test !== true)) throw new Error("virtual_tryon_smoke_delivery_verification_failed");
  const r2 = new S3Client({ region: "auto", endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY } });
  await r2.send(new HeadObjectCommand({ Bucket: process.env.CLOUDFLARE_R2_BUCKET, Key: row.r2_key }));
  console.log(`OK: virtual try-on smoke job=${jobId} status=${row.status} is_test=${row.is_test === true}`);
  if (createdByScript) await pool.query("update virtual_tryon_jobs set deleted_at = now() where id = $1", [jobId]);
} finally { await pool.end(); }
