import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, jsonSnapshot, timestamps } from "./common";

export const rightsAttestationScopeValues = [
  "upload",
  "generation_reconfirmation",
] as const;
export const rightsAttestationScopeEnum = pgEnum(
  "rights_attestation_scope",
  rightsAttestationScopeValues,
);

export const rightsRemovalStatusValues = [
  "received",
  "triaging",
  "awaiting_information",
  "action_required",
  "resolved_removed",
  "resolved_rejected",
] as const;
export const rightsRemovalStatusEnum = pgEnum(
  "rights_removal_status",
  rightsRemovalStatusValues,
);

export const rightsTypeValues = [
  "likeness",
  "copyright",
  "trademark",
  "privacy",
  "other",
] as const;
export const rightsTypeEnum = pgEnum("rights_type", rightsTypeValues);

export const rightsAttestations = pgTable("rights_attestations", {
  ...id,
  userId: text("user_id").notNull(),
  version: text("version").notNull(),
  statementSnapshot: text("statement_snapshot").notNull(),
  scope: rightsAttestationScopeEnum("scope").notNull(),
  locale: text("locale").notNull().default("zh-CN"),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  acceptedAt: timestamp("accepted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  redactedAt: timestamp("redacted_at", { withTimezone: true }),
});

export const assetRightsAttestations = pgTable(
  "asset_rights_attestations",
  {
    ...id,
    assetId: uuid("asset_id").notNull(),
    rightsAttestationId: uuid("rights_attestation_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("asset_rights_attestation_unique").on(
      table.assetId,
      table.rightsAttestationId,
    ),
  ],
);

export const rightsRemovalRequests = pgTable(
  "rights_removal_requests",
  {
    ...id,
    publicReference: text("public_reference").notNull(),
    status: rightsRemovalStatusEnum("status").notNull().default("received"),
    reporterName: text("reporter_name").notNull(),
    reporterEmail: text("reporter_email").notNull(),
    rightsType: rightsTypeEnum("rights_type").notNull(),
    contentReferences: jsonSnapshot("content_references")
      .notNull()
      .default([]),
    description: text("description").notNull(),
    goodFaithConfirmed: boolean("good_faith_confirmed").notNull(),
    accuracyConfirmed: boolean("accuracy_confirmed").notNull(),
    ipHash: text("ip_hash"),
    userAgentHash: text("user_agent_hash"),
    resolutionSummary: text("resolution_summary"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    redactedAt: timestamp("redacted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("rights_removal_public_reference_unique").on(
      table.publicReference,
    ),
  ],
);
