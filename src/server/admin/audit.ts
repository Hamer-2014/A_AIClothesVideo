import { randomUUID } from "node:crypto";

import { and, desc, eq, type SQL } from "drizzle-orm";
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

export interface AdminAuditFilters {
  actorEmail?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
}

export interface AdminAuditQueryStore extends AdminAuditStore {
  listAuditLogs(filters: {
    actorEmail?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit: number;
  }): Promise<AdminAuditRecord[]>;
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

const sensitiveSnapshotKeyPattern =
  /(^|_)(plain)?key$|encryptedkey|apikey|api_key|secret|token|prompt/i;

export function redactAuditSnapshot(value: JsonValue): JsonValue {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactAuditSnapshot(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        sensitiveSnapshotKeyPattern.test(key)
          ? "[REDACTED]"
          : redactAuditSnapshot(nested),
      ]),
    );
  }

  return value;
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
    beforeSnapshot: redactAuditSnapshot(toAuditSnapshot(beforeSnapshot)),
    afterSnapshot: redactAuditSnapshot(toAuditSnapshot(afterSnapshot)),
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

function normalizeAuditLimit(limit: number | undefined) {
  const parsed = Number.isFinite(limit) ? Number(limit) : 50;
  return Math.min(Math.max(parsed || 50, 1), 100);
}

export async function listAdminAuditLogs({
  store,
  filters = {},
}: {
  store: AdminAuditQueryStore;
  filters?: AdminAuditFilters;
}) {
  return store.listAuditLogs({
    actorEmail: filters.actorEmail,
    action: filters.action,
    targetType: filters.targetType,
    targetId: filters.targetId,
    limit: normalizeAuditLimit(filters.limit),
  });
}

export function createInMemoryAdminAuditStore(): AdminAuditStore & {
  listAuditLogs: {
    (): AdminAuditRecord[];
    (filters: {
      actorEmail?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      limit: number;
    }): Promise<AdminAuditRecord[]>;
  };
} {
  const records: AdminAuditRecord[] = [];
  const listAuditLogs = ((filters?: {
    actorEmail?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    limit: number;
  }) => {
    let rows = records.toSorted(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    );

    if (filters?.actorEmail) {
      rows = rows.filter((record) => record.actorEmail === filters.actorEmail);
    }
    if (filters?.action) {
      rows = rows.filter((record) => record.action === filters.action);
    }
    if (filters?.targetType) {
      rows = rows.filter((record) => record.targetType === filters.targetType);
    }
    if (filters?.targetId) {
      rows = rows.filter((record) => record.targetId === filters.targetId);
    }

    const result = rows
      .slice(0, filters?.limit ?? records.length)
      .map((record) => ({ ...record }));

    return filters ? Promise.resolve(result) : result;
  }) as {
    (): AdminAuditRecord[];
    (filters: {
      actorEmail?: string;
      action?: string;
      targetType?: string;
      targetId?: string;
      limit: number;
    }): Promise<AdminAuditRecord[]>;
  };

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
    listAuditLogs,
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminAuditStore(
  db: DbClient = getDb(),
): AdminAuditQueryStore {
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
    async listAuditLogs(filters) {
      const whereClauses: SQL[] = [];

      if (filters.actorEmail) {
        whereClauses.push(eq(adminAuditLogs.actorEmail, filters.actorEmail));
      }
      if (filters.action) {
        whereClauses.push(eq(adminAuditLogs.action, filters.action));
      }
      if (filters.targetType) {
        whereClauses.push(eq(adminAuditLogs.targetType, filters.targetType));
      }
      if (filters.targetId) {
        whereClauses.push(eq(adminAuditLogs.targetId, filters.targetId));
      }

      const rows = await db
        .select()
        .from(adminAuditLogs)
        .where(whereClauses.length > 0 ? and(...whereClauses) : undefined)
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(filters.limit);

      return rows as AdminAuditRecord[];
    },
  };
}
