import {
  boolean,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const id = {
  id: uuid("id").defaultRandom().primaryKey(),
};

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const softDelete = {
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const lockableJobFields = {
  lockedBy: text("locked_by"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastError: text("last_error"),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
};

export const isTest = {
  isTest: boolean("is_test").notNull().default(false),
};

export const jsonSnapshot = (name: string) => jsonb(name).$type<JsonValue>();

export const costEstimate = (name = "cost_estimate") =>
  numeric(name, { precision: 12, scale: 6 }).notNull().default("0");
