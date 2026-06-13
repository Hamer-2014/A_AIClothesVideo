import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { costEstimate, id, jsonSnapshot, softDelete, timestamps } from "./common";

export const providerStatusValues = ["active", "paused", "exhausted", "error"] as const;
export const providerStatusEnum = pgEnum("provider_status", providerStatusValues);

export const providerPurposeValues = [
  "content_safety",
  "creem_prompt_moderation",
  "lite_asset_check",
  "standard_asset_analysis",
  "strict_asset_review",
  "storyboard",
  "video_generation",
  "post_qa",
  "experimental_video",
] as const;
export const providerPurposeEnum = pgEnum(
  "provider_purpose",
  providerPurposeValues,
);

export const providerCallStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "blocked",
] as const;
export const providerCallStatusEnum = pgEnum(
  "provider_call_status",
  providerCallStatusValues,
);

export const moderationDecisionValues = ["allow", "flag", "deny", "error"] as const;
export const moderationDecisionEnum = pgEnum(
  "moderation_decision",
  moderationDecisionValues,
);

export const modelProviders = pgTable("model_providers", {
  ...id,
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  status: providerStatusEnum("status").notNull().default("paused"),
  baseUrl: text("base_url"),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
  ...softDelete,
});

export const providerKeys = pgTable("provider_keys", {
  ...id,
  providerId: uuid("provider_id").notNull(),
  label: text("label").notNull(),
  environment: text("environment").notNull().default("development"),
  status: providerStatusEnum("status").notNull().default("paused"),
  encryptedKey: text("encrypted_key").notNull(),
  keyPreview: text("key_preview").notNull(),
  dailyCostLimit: costEstimate("daily_cost_limit"),
  currentDailyCost: costEstimate("current_daily_cost"),
  concurrentLimit: integer("concurrent_limit").notNull().default(1),
  currentConcurrency: integer("current_concurrency").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
  ...softDelete,
});

export const modelRoutes = pgTable("model_routes", {
  ...id,
  purpose: providerPurposeEnum("purpose").notNull(),
  environment: text("environment").notNull().default("development"),
  primaryProviderId: uuid("primary_provider_id"),
  primaryModel: text("primary_model").notNull(),
  fallbackProviderId: uuid("fallback_provider_id"),
  fallbackModel: text("fallback_model"),
  status: providerStatusEnum("status").notNull().default("paused"),
  minMarginPercent: integer("min_margin_percent").notNull().default(45),
  allowPublicFallback: text("allow_public_fallback").notNull().default("false"),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
});

export const providerCallLogs = pgTable("provider_call_logs", {
  ...id,
  provider: text("provider").notNull(),
  providerKeyId: uuid("provider_key_id"),
  modelRouteId: uuid("model_route_id"),
  routeSnapshot: jsonSnapshot("route_snapshot"),
  model: text("model").notNull(),
  purpose: providerPurposeEnum("purpose").notNull(),
  userId: text("user_id"),
  videoJobId: uuid("video_job_id"),
  segmentId: uuid("segment_id"),
  requestSnapshot: jsonSnapshot("request_snapshot").notNull(),
  responseSummary: jsonSnapshot("response_summary"),
  costEstimate: costEstimate(),
  durationMs: integer("duration_ms"),
  status: providerCallStatusEnum("status").notNull().default("queued"),
  fallbackReason: text("fallback_reason"),
  providerTaskId: text("provider_task_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const promptModerationResults = pgTable("prompt_moderation_results", {
  ...id,
  userId: text("user_id").notNull(),
  videoJobId: uuid("video_job_id"),
  segmentId: uuid("segment_id"),
  source: text("source").notNull(),
  promptHash: text("prompt_hash").notNull(),
  promptSummary: text("prompt_summary"),
  externalId: text("external_id"),
  moderationId: text("moderation_id"),
  decision: moderationDecisionEnum("decision").notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  latencyMs: integer("latency_ms"),
  providerCallLogId: uuid("provider_call_log_id"),
  ...timestamps,
});
