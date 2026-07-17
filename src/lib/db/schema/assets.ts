import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
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
  "pending_upload",
  "uploaded",
  "analyzing",
  "ready",
  "rejected",
  "deleted",
] as const;
export const assetStatusEnum = pgEnum("asset_status", assetStatusValues);

export const assetSubjectKindValues = [
  "product",
  "human_model",
  "unknown",
] as const;
export const assetSubjectKindEnum = pgEnum(
  "asset_subject_kind",
  assetSubjectKindValues,
);

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
  subjectKind: assetSubjectKindEnum("subject_kind")
    .notNull()
    .default("unknown"),
  visibleDetails: jsonSnapshot("visible_details").notNull().default([]),
  notVisibleDetails: jsonSnapshot("not_visible_details").notNull().default([]),
  quality: jsonSnapshot("quality").notNull().default({}),
  confidence: text("confidence"),
  riskFlags: jsonSnapshot("risk_flags").notNull().default([]),
  analysisJson: jsonSnapshot("analysis_json").notNull(),
  ...timestamps,
});

export const assetConsistencyAnalyses = pgTable(
  "asset_consistency_analyses",
  {
    ...id,
    videoJobId: uuid("video_job_id").notNull(),
    analysisKind: text("analysis_kind").notNull(),
    status: text("status").notNull(),
    garmentMatch: text("garment_match").notNull(),
    modelMatch: text("model_match").notNull(),
    colorMatch: boolean("color_match").notNull().default(false),
    patternMatch: boolean("pattern_match").notNull().default(false),
    viewCoverage: jsonSnapshot("view_coverage").notNull().default([]),
    confidence: text("confidence"),
    riskFlags: jsonSnapshot("risk_flags").notNull().default([]),
    resultJson: jsonSnapshot("result_json").notNull(),
    providerCallLogId: uuid("provider_call_log_id"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("asset_consistency_job_kind_unique").on(
      table.videoJobId,
      table.analysisKind,
    ),
  ],
);
