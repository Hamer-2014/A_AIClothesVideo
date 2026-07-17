import type { JsonValue } from "@/lib/db/schema/common";

export const funnelEventNames = [
  "landing_viewed",
  "trial_cta_clicked",
  "pricing_viewed",
  "login_viewed",
  "login_completed",
  "workspace_entered",
  "guest_asset_selected",
  "guest_config_changed",
  "guest_generate_clicked",
  "guest_draft_restored",
  "authenticated_asset_reselected",
  "trial_status_viewed",
  "asset_uploaded",
  "job_created",
  "asset_analysis_passed",
  "asset_analysis_failed",
  "storyboard_generated",
  "storyboard_confirmed",
  "trial_generation_started",
  "paid_generation_started",
  "generation_deliverable",
  "generation_failed",
  "video_downloaded",
  "upgrade_cta_clicked",
  "checkout_started",
  "payment_succeeded",
] as const;

export type FunnelEventName = (typeof funnelEventNames)[number];

export const allowedFunnelMetadataKeys = [
  "presetId",
  "durationSeconds",
  "aspectRatio",
  "billingMode",
  "jobId",
  "sourcePage",
  "status",
  "reasonCategory",
  "mode",
  "assetRole",
  "draftRestored",
] as const;

export type FunnelMetadata = Partial<
  Record<(typeof allowedFunnelMetadataKeys)[number], JsonValue>
>;
