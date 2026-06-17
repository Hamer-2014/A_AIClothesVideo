import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { id, jsonSnapshot } from "./common";

export const adminAuditLogs = pgTable("admin_audit_logs", {
  ...id,
  adminUserId: text("admin_user_id"),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  reason: text("reason"),
  beforeSnapshot: jsonSnapshot("before_snapshot"),
  afterSnapshot: jsonSnapshot("after_snapshot"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const abuseEvents = pgTable("abuse_events", {
  ...id,
  userId: text("user_id"),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("medium"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: jsonSnapshot("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAccessEvents = pgTable("user_access_events", {
  ...id,
  userId: text("user_id"),
  eventType: text("event_type").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  path: text("path"),
  metadata: jsonSnapshot("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminJobNotes = pgTable("admin_job_notes", {
  ...id,
  jobId: uuid("job_id").notNull(),
  adminUserId: text("admin_user_id").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trialAbuseSignals = pgTable("trial_abuse_signals", {
  ...id,
  userId: text("user_id").notNull(),
  videoJobId: uuid("video_job_id"),
  emailHash: text("email_hash"),
  oauthProvider: text("oauth_provider"),
  oauthAccountIdHash: text("oauth_account_id_hash"),
  ipHash: text("ip_hash"),
  deviceFingerprintHash: text("device_fingerprint_hash"),
  userAgentHash: text("user_agent_hash"),
  eventType: text("event_type").notNull(),
  decision: text("decision").notNull(),
  riskScore: integer("risk_score").notNull().default(0),
  reasonCodes: jsonSnapshot("reason_codes").notNull().default([]),
  metadata: jsonSnapshot("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
