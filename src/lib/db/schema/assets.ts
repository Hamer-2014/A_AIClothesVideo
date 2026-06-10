import {
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { id, jsonSnapshot, softDelete, timestamps } from "./common";

export const assetRoleValues = [
  "front",
  "back",
  "side",
  "detail",
  "scene",
  "logo",
  "unknown",
] as const;
export const assetRoleEnum = pgEnum("asset_role", assetRoleValues);

export const assetStatusValues = [
  "uploaded",
  "analyzing",
  "ready",
  "rejected",
  "deleted",
] as const;
export const assetStatusEnum = pgEnum("asset_status", assetStatusValues);

export const assets = pgTable("assets", {
  ...id,
  userId: text("user_id").notNull(),
  status: assetStatusEnum("status").notNull().default("uploaded"),
  originalKey: text("original_key").notNull(),
  thumbKey: text("thumb_key"),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  detectedRole: assetRoleEnum("detected_role").default("unknown"),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
  ...softDelete,
});

export const assetAnalyses = pgTable("asset_analyses", {
  ...id,
  assetId: uuid("asset_id").notNull(),
  providerCallLogId: uuid("provider_call_log_id"),
  mode: text("mode").notNull(),
  assetRole: assetRoleEnum("asset_role").notNull().default("unknown"),
  garmentCategory: text("garment_category"),
  viewAngle: text("view_angle"),
  humanPresent: text("human_present").notNull().default("unknown"),
  visibleDetails: jsonSnapshot("visible_details").notNull().default([]),
  notVisibleDetails: jsonSnapshot("not_visible_details").notNull().default([]),
  quality: jsonSnapshot("quality").notNull().default({}),
  confidence: text("confidence"),
  riskFlags: jsonSnapshot("risk_flags").notNull().default([]),
  analysisJson: jsonSnapshot("analysis_json").notNull(),
  ...timestamps,
});
