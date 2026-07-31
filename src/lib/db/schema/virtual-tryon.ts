import { sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, jsonSnapshot, lockableJobFields, softDelete, timestamps } from "./common";

export const virtualTryonModeValues = ["front_only", "three_view"] as const;
export const virtualTryonModeEnum = pgEnum("virtual_tryon_mode", virtualTryonModeValues);
export const virtualTryonJobStatusValues = ["draft", "queued", "generating", "qa_queued", "capturing", "ready", "locked", "failed_unreserved", "recovering_release", "recovering_refund", "failed_released", "failed_refunded"] as const;
export const virtualTryonJobStatusEnum = pgEnum("virtual_tryon_job_status", virtualTryonJobStatusValues);
export const appearancePackStatusValues = ["draft", "generating", "qa_queued", "ready", "locked", "failed"] as const;
export const appearancePackStatusEnum = pgEnum("appearance_pack_status", appearancePackStatusValues);
export const appearanceViewValues = ["front", "side", "back"] as const;
export const appearanceViewEnum = pgEnum("appearance_view", appearanceViewValues);

export const virtualTryonJobs = pgTable("virtual_tryon_jobs", {
  ...id,
  userId: text("user_id").notNull(),
  mode: virtualTryonModeEnum("mode").notNull(),
  status: virtualTryonJobStatusEnum("status").notNull().default("draft"),
  skuName: text("sku_name"),
  createIdempotencyKey: text("create_idempotency_key").notNull(),
  sourceSnapshot: jsonSnapshot("source_snapshot").notNull(),
  modelSnapshot: jsonSnapshot("model_snapshot").notNull(),
  rightsSnapshot: jsonSnapshot("rights_snapshot").notNull(),
  creditCost: integer("credit_cost").notNull(),
  reservedLedgerId: uuid("reserved_ledger_id"),
  capturedLedgerId: uuid("captured_ledger_id"),
  releasedLedgerId: uuid("released_ledger_id"),
  deliveryPersistAttemptCount: integer("delivery_persist_attempt_count").notNull().default(0),
  ...lockableJobFields,
  ...timestamps,
  ...softDelete,
}, (table) => [uniqueIndex("virtual_tryon_jobs_owner_idempotency_unique").on(table.userId, table.createIdempotencyKey)]);

export const appearancePacks = pgTable("appearance_packs", {
  ...id,
  virtualTryonJobId: uuid("virtual_tryon_job_id").notNull(),
  version: integer("version").notNull(),
  requiredViews: jsonSnapshot("required_views").notNull(),
  status: appearancePackStatusEnum("status").notNull().default("draft"),
  qaSummary: jsonSnapshot("qa_summary"),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("appearance_packs_job_version_unique").on(table.virtualTryonJobId, table.version)]);

export const appearancePackAssets = pgTable("appearance_pack_assets", {
  ...id,
  appearancePackId: uuid("appearance_pack_id").notNull(),
  view: appearanceViewEnum("view").notNull(),
  providerTaskId: text("provider_task_id"),
  providerStatus: text("provider_status").notNull().default("pending"),
  attemptCount: integer("attempt_count").notNull().default(0),
  r2Key: text("r2_key"),
  origin: text("origin").notNull().default("generated_apimart_gpt_image_2"),
  provenance: jsonSnapshot("provenance").notNull(),
  lastErrorCode: text("last_error_code"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("appearance_pack_assets_pack_view_unique").on(table.appearancePackId, table.view)]);

export const garmentFidelityResults = pgTable("garment_fidelity_results", {
  ...id,
  appearancePackId: uuid("appearance_pack_id").notNull(),
  scope: text("scope").notNull(),
  view: appearanceViewEnum("view"),
  verdict: text("verdict").notNull(),
  resultJson: jsonSnapshot("result_json").notNull(),
  providerCallLogId: uuid("provider_call_log_id"),
  ...timestamps,
}, (table) => [uniqueIndex("garment_fidelity_results_view_unique").on(table.appearancePackId, table.scope, table.view).where(sql`${table.view} is not null`), uniqueIndex("garment_fidelity_results_cross_unique").on(table.appearancePackId, table.scope).where(sql`${table.view} is null`)]);

export const virtualTryonStateEvents = pgTable("virtual_tryon_state_events", {
  ...id,
  virtualTryonJobId: uuid("virtual_tryon_job_id").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason").notNull(),
  actorType: text("actor_type").notNull().default("system"),
  eventSnapshot: jsonSnapshot("event_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
