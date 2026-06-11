import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { adminAuditLogs } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";

export interface AdminAuditActor {
  userId: string;
  email: string;
}

export interface AdminAuditRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditRecord {
  id: string;
  adminUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  reason: string | null;
  beforeSnapshot: JsonValue | null;
  afterSnapshot: JsonValue | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface NewAdminAuditRecord {
  adminUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  beforeSnapshot?: JsonValue | null;
  afterSnapshot?: JsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AdminAuditStore {
  createAuditLog(input: NewAdminAuditRecord): Promise<AdminAuditRecord>;
}

export function normalizeAdminReason(reason: string | undefined) {
  const normalized = reason?.trim() ?? "";

  if (normalized.length < 6) {
    throw new Error("Admin action reason must be at least 6 characters.");
  }

  return normalized;
}

export function toAuditSnapshot(value: unknown): JsonValue {
  if (value === undefined || value === null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toAuditSnapshot(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        toAuditSnapshot(nested),
      ]),
    );
  }

  return String(value);
}

export async function writeAdminAuditLog({
  store,
  actor,
  action,
  targetType,
  targetId,
  reason,
  beforeSnapshot,
  afterSnapshot,
  requestMeta,
}: {
  store: AdminAuditStore;
  actor: AdminAuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  beforeSnapshot?: JsonValue | null;
  afterSnapshot?: JsonValue | null;
  requestMeta?: AdminAuditRequestMeta;
}) {
  return store.createAuditLog({
    adminUserId: actor.userId,
    actorEmail: actor.email,
    action,
    targetType,
    targetId: targetId ?? null,
    reason: reason ?? null,
    beforeSnapshot: toAuditSnapshot(beforeSnapshot),
    afterSnapshot: toAuditSnapshot(afterSnapshot),
    ipAddress: requestMeta?.ipAddress ?? null,
    userAgent: requestMeta?.userAgent ?? null,
  });
}

export function getRequestMeta(request: Request): AdminAuditRequestMeta {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null,
    userAgent: request.headers.get("user-agent"),
  };
}

export function createInMemoryAdminAuditStore(): AdminAuditStore & {
  listAuditLogs: () => AdminAuditRecord[];
} {
  const records: AdminAuditRecord[] = [];

  return {
    async createAuditLog(input) {
      const record: AdminAuditRecord = {
        id: randomUUID(),
        adminUserId: input.adminUserId ?? null,
        actorEmail: input.actorEmail ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        reason: input.reason ?? null,
        beforeSnapshot: input.beforeSnapshot ?? null,
        afterSnapshot: input.afterSnapshot ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        createdAt: new Date(),
      };
      records.push(record);
      return { ...record };
    },
    listAuditLogs() {
      return records.map((record) => ({ ...record }));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminAuditStore(
  db: DbClient = getDb(),
): AdminAuditStore {
  return {
    async createAuditLog(input) {
      const [record] = await db
        .insert(adminAuditLogs)
        .values({
          adminUserId: input.adminUserId ?? null,
          actorEmail: input.actorEmail ?? null,
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId ?? null,
          reason: input.reason ?? null,
          beforeSnapshot: input.beforeSnapshot ?? null,
          afterSnapshot: input.afterSnapshot ?? null,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent ?? null,
        })
        .returning();

      if (!record) {
        throw new Error("Failed to create admin audit log.");
      }

      return record as AdminAuditRecord;
    },
  };
}
