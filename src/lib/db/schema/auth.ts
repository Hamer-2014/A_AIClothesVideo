import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { id, timestamps } from "./common";

export const authEmailEventTypeValues = [
  "sign_in_otp",
  "magic_link",
  "email_verification",
] as const;
export const authEmailEventTypeEnum = pgEnum(
  "auth_email_event_type",
  authEmailEventTypeValues,
);

export const authEmailEventStatusValues = ["sent", "failed"] as const;
export const authEmailEventStatusEnum = pgEnum(
  "auth_email_event_status",
  authEmailEventStatusValues,
);

export const users = pgTable("users", {
  ...id,
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  ...id,
  userId: text("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  ...timestamps,
});

export const accounts = pgTable("accounts", {
  ...id,
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verifications = pgTable("verifications", {
  ...id,
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const authEmailEvents = pgTable("auth_email_events", {
  ...id,
  userId: uuid("user_id"),
  email: text("email").notNull(),
  type: authEmailEventTypeEnum("type").notNull(),
  status: authEmailEventStatusEnum("status").notNull(),
  provider: text("provider").notNull().default("resend"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
