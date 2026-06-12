import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { userAccessEvents } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { AdminRole } from "@/server/auth/admin-access";

export interface AdminAccessEventRecord {
  id: string;
  userId: string | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  path: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
}

export interface AdminAccessEventView extends AdminAccessEventRecord {
  hasIp: boolean;
}

export interface AdminAccessEventStore {
  listAccessEvents(): Promise<AdminAccessEventRecord[]>;
}

export function createInMemoryAdminAccessEventStore(
  events: AdminAccessEventRecord[],
): AdminAccessEventStore {
  return {
    async listAccessEvents() {
      return [...events].sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      );
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminAccessEventStore(
  db: DbClient = getDb(),
): AdminAccessEventStore {
  return {
    async listAccessEvents() {
      return db
        .select({
          id: userAccessEvents.id,
          userId: userAccessEvents.userId,
          eventType: userAccessEvents.eventType,
          ipAddress: userAccessEvents.ipAddress,
          userAgent: userAccessEvents.userAgent,
          path: userAccessEvents.path,
          metadata: userAccessEvents.metadata,
          createdAt: userAccessEvents.createdAt,
        })
        .from(userAccessEvents)
        .orderBy(desc(userAccessEvents.createdAt));
    },
  };
}

export async function listAdminAccessEvents({
  store,
  role,
}: {
  store: AdminAccessEventStore;
  role: AdminRole;
}): Promise<AdminAccessEventView[]> {
  const events = await store.listAccessEvents();
  const canViewFullIp = role === "admin";

  return events.map((event) => ({
    ...event,
    hasIp: Boolean(event.ipAddress),
    ipAddress: canViewFullIp ? event.ipAddress : null,
  }));
}
