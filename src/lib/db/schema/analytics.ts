import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { id, jsonSnapshot } from "./common";

export const funnelEvents = pgTable(
  "funnel_events",
  {
    ...id,
    userId: text("user_id"),
    anonymousId: text("anonymous_id"),
    sessionId: text("session_id"),
    eventName: text("event_name").notNull(),
    source: text("source").notNull(),
    path: text("path"),
    metadata: jsonSnapshot("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("funnel_events_created_at_idx").on(table.createdAt),
    index("funnel_events_event_name_idx").on(table.eventName),
    index("funnel_events_user_id_idx").on(table.userId),
    index("funnel_events_anonymous_id_idx").on(table.anonymousId),
  ],
);
