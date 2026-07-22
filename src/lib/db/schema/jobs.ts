import { sql } from "drizzle-orm";
import {
  integer,
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import {
  costEstimate,
  id,
  isTest,
  jsonSnapshot,
  lockableJobFields,
  softDelete,
  timestamps,
} from "./common";
import { captureProtocolIds } from "@/lib/video/capture-protocols";

export const captureProtocolValues = captureProtocolIds;
export const captureProtocolEnum = pgEnum(
  "capture_protocol",
  captureProtocolValues,
);

export const jobStatusValues = [
  "draft_uploaded",
  "lite_check_queued",
  "lite_check_running",
  "lite_check_passed",
  "lite_check_failed",
  "asset_analysis_queued",
  "asset_analysis_running",
  "asset_analysis_passed",
  "asset_analysis_failed",
  "storyboard_draft_ready",
  "storyboard_confirmed",
  "prompt_moderation_running",
  "prompt_moderation_passed",
  "prompt_moderation_blocked",
  "credits_reserved",
  "segments_queued",
  "segment_generating",
  "segment_succeeded",
  "segment_failed",
  "stitching_queued",
  "stitching_running",
  "stitched",
  "post_qa_queued",
  "post_qa_running",
  "post_qa_passed",
  "post_qa_failed",
  "deliverable",
  "retrying",
  "failed_released",
  "failed_refunded",
] as const;
export const jobStatusEnum = pgEnum("job_status", jobStatusValues);

export const segmentStatusValues = [
  "queued",
  "generating",
  "succeeded",
  "failed",
  "stored",
] as const;
export const segmentStatusEnum = pgEnum("segment_status", segmentStatusValues);

export const stitchStatusValues = ["queued", "running", "succeeded", "failed"] as const;
export const stitchStatusEnum = pgEnum("stitch_status", stitchStatusValues);

export const postQaModeValues = ["off", "lite", "standard", "strict"] as const;
export const postQaModeEnum = pgEnum("post_qa_mode", postQaModeValues);

export const billingModeValues = ["free_trial", "paid"] as const;
export const billingModeEnum = pgEnum("billing_mode", billingModeValues);

export const generationProfileValues = [
  "trial_540p_watermarked",
  "paid_720p_audio",
  "paid_1080p_audio",
] as const;
export const generationProfileEnum = pgEnum(
  "generation_profile",
  generationProfileValues,
);

export const postQaStatusValues = [
  "queued",
  "running",
  "passed",
  "failed",
  "manual_review",
] as const;
export const postQaStatusEnum = pgEnum("post_qa_status", postQaStatusValues);

export const videoAspectRatioValues = ["9:16", "1:1", "16:9"] as const;
export const videoAspectRatioEnum = pgEnum(
  "video_aspect_ratio",
  videoAspectRatioValues,
);

export const videoJobs = pgTable("video_jobs", {
  ...id,
  userId: text("user_id").notNull(),
  status: jobStatusEnum("status").notNull().default("draft_uploaded"),
  userVisibleStatus: text("user_visible_status").notNull().default("uploaded"),
  durationSeconds: integer("duration_seconds").notNull(),
  aspectRatio: videoAspectRatioEnum("aspect_ratio").notNull(),
  captureProtocol: captureProtocolEnum("capture_protocol")
    .notNull()
    .default("product_showcase"),
  skuName: text("sku_name"),
  presetId: text("preset_id"),
  presetSnapshot: jsonSnapshot("preset_snapshot"),
  postQaMode: postQaModeEnum("post_qa_mode").notNull().default("standard"),
  postQaRequired: text("post_qa_required").notNull().default("true"),
  postQaReason: text("post_qa_reason"),
  creditCost: integer("credit_cost").notNull().default(0),
  billingMode: billingModeEnum("billing_mode").notNull().default("paid"),
  generationProfile: generationProfileEnum("generation_profile")
    .notNull()
    .default("paid_720p_audio"),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
  trialEligibilitySnapshot: jsonSnapshot("trial_eligibility_snapshot"),
  rightsAttestationSnapshot: jsonSnapshot("rights_attestation_snapshot"),
  reservedLedgerId: uuid("reserved_ledger_id"),
  finalVideoKey: text("final_video_key"),
  coverKey: text("cover_key"),
  failureReason: text("failure_reason"),
  ...isTest,
  ...lockableJobFields,
  ...timestamps,
  ...softDelete,
});

export const videoJobAssets = pgTable("video_job_assets", {
  ...id,
  videoJobId: uuid("video_job_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  role: text("role").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  ...timestamps,
});

export const storyboards = pgTable("storyboards", {
  ...id,
  videoJobId: uuid("video_job_id").notNull(),
  version: integer("version").notNull().default(1),
  status: text("status").notNull().default("draft"),
  selectedTemplateIds: jsonSnapshot("selected_template_ids").notNull().default([]),
  presetId: text("preset_id"),
  presetSnapshot: jsonSnapshot("preset_snapshot"),
  storyboardJson: jsonSnapshot("storyboard_json").notNull(),
  finalPromptSnapshot: jsonSnapshot("final_prompt_snapshot"),
  providerCallLogId: uuid("provider_call_log_id"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  ...timestamps,
});

export const videoSegments = pgTable(
  "video_segments",
  {
    ...id,
    videoJobId: uuid("video_job_id").notNull(),
    storyboardId: uuid("storyboard_id"),
    segmentIndex: integer("segment_index").notNull(),
    status: segmentStatusEnum("status").notNull().default("queued"),
    templateId: text("template_id").notNull(),
    prompt: text("prompt").notNull(),
    inputAssetSnapshot: jsonSnapshot("input_asset_snapshot").notNull(),
    provider: text("provider"),
    model: text("model"),
    providerTaskId: text("provider_task_id"),
    providerCallLogId: uuid("provider_call_log_id"),
    videoKey: text("video_key"),
    costEstimate: costEstimate(),
    generationProfile: generationProfileEnum("generation_profile")
      .notNull()
      .default("paid_720p_audio"),
    resolution: text("resolution").notNull().default("720p"),
    audioEnabled: boolean("audio_enabled").notNull().default(true),
    watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
    ...isTest,
    ...lockableJobFields,
    ...timestamps,
  },
  (table) => [
    uniqueIndex("video_segments_storyboard_segment_unique")
      .on(table.storyboardId, table.segmentIndex)
      .where(sql`${table.storyboardId} is not null`),
  ],
);

export const freeTrialUsages = pgTable("free_trial_usages", {
  ...id,
  userId: text("user_id").notNull(),
  videoJobId: uuid("video_job_id").notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  durationSeconds: integer("duration_seconds").notNull(),
  generationProfile: generationProfileEnum("generation_profile").notNull(),
  resolution: text("resolution").notNull(),
  watermarkEnabled: boolean("watermark_enabled").notNull().default(true),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  ...timestamps,
});

export const stitchJobs = pgTable("stitch_jobs", {
  ...id,
  videoJobId: uuid("video_job_id").notNull(),
  status: stitchStatusEnum("status").notNull().default("queued"),
  segmentKeys: jsonSnapshot("segment_keys").notNull().default([]),
  finalVideoKey: text("final_video_key"),
  coverKey: text("cover_key"),
  frameKeys: jsonSnapshot("frame_keys").notNull().default([]),
  callbackSnapshot: jsonSnapshot("callback_snapshot"),
  ...isTest,
  ...lockableJobFields,
  ...timestamps,
});

export const postQaResults = pgTable("post_qa_results", {
  ...id,
  videoJobId: uuid("video_job_id").notNull(),
  stitchJobId: uuid("stitch_job_id"),
  status: postQaStatusEnum("status").notNull().default("queued"),
  mode: postQaModeEnum("mode").notNull(),
  frameKeys: jsonSnapshot("frame_keys").notNull().default([]),
  resultJson: jsonSnapshot("result_json"),
  failureCategory: text("failure_category"),
  providerCallLogId: uuid("provider_call_log_id"),
  ...isTest,
  ...lockableJobFields,
  ...timestamps,
});

export const jobStateEvents = pgTable("job_state_events", {
  ...id,
  videoJobId: uuid("video_job_id").notNull(),
  segmentId: uuid("segment_id"),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actorType: text("actor_type").notNull().default("system"),
  actorId: text("actor_id"),
  eventSnapshot: jsonSnapshot("event_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
