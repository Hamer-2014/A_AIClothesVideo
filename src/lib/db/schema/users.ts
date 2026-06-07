import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { id, jsonSnapshot, softDelete, timestamps } from "./common";

export const adminRoleValues = ["admin", "operator"] as const;
export const adminRoleEnum = pgEnum("admin_role", adminRoleValues);

export const userStatusValues = ["active", "paused", "banned"] as const;
export const userStatusEnum = pgEnum("user_status", userStatusValues);

export const userProfiles = pgTable("user_profiles", {
  ...id,
  userId: uuid("user_id").notNull().unique(),
  status: userStatusEnum("status").notNull().default("active"),
  displayName: text("display_name"),
  companyName: text("company_name"),
  country: text("country"),
  freeTrialGrantedAt: timestamp("free_trial_granted_at", {
    withTimezone: true,
  }),
  freeTrialSource: text("free_trial_source"),
  metadata: jsonSnapshot("metadata"),
  ...timestamps,
  ...softDelete,
});

export const adminRoles = pgTable("admin_roles", {
  ...id,
  userId: uuid("user_id").notNull(),
  email: text("email").notNull(),
  role: adminRoleEnum("role").notNull(),
  grantedBy: uuid("granted_by"),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ...timestamps,
});
