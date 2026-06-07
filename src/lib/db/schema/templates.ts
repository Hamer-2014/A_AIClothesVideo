import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import { id, jsonSnapshot, softDelete, timestamps } from "./common";

export const templateStatusValues = ["draft", "beta", "active", "paused"] as const;
export const templateStatusEnum = pgEnum(
  "shot_template_status",
  templateStatusValues,
);

export const templateRiskValues = ["low", "medium", "medium_high", "high"] as const;
export const templateRiskEnum = pgEnum("shot_template_risk", templateRiskValues);

export const shotTemplates = pgTable("shot_templates", {
  ...id,
  templateId: text("template_id").notNull(),
  version: integer("version").notNull().default(1),
  status: templateStatusEnum("status").notNull().default("draft"),
  riskLevel: templateRiskEnum("risk_level").notNull(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  requiredAssets: jsonSnapshot("required_assets").notNull().default([]),
  blockedConditions: jsonSnapshot("blocked_conditions").notNull().default([]),
  allowedMotion: jsonSnapshot("allowed_motion").notNull().default([]),
  basePromptIntent: text("base_prompt_intent").notNull(),
  systemConstraints: jsonSnapshot("system_constraints").notNull().default([]),
  postQaChecks: jsonSnapshot("post_qa_checks").notNull().default([]),
  isTrialAllowed: boolean("is_trial_allowed").notNull().default(false),
  requiresStrictReview: boolean("requires_strict_review").notNull().default(false),
  createdBy: uuid("created_by"),
  ...timestamps,
  ...softDelete,
});

export const shotTemplateMetrics = pgTable("shot_template_metrics", {
  ...id,
  shotTemplateId: uuid("shot_template_id").notNull(),
  useCount: integer("use_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  postQaPassCount: integer("post_qa_pass_count").notNull().default(0),
  retryCount: integer("retry_count").notNull().default(0),
  refundCount: integer("refund_count").notNull().default(0),
  averageCost: text("average_cost"),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
});
