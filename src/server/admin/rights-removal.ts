import { randomUUID } from "node:crypto";

import { and, desc, eq, type SQL } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { rightsRemovalRequests } from "@/lib/db/schema";
import type {
  RightsRemovalRequestRecord,
  RightsRemovalStatus,
  RightsType,
} from "@/server/compliance/rights-removal";
import {
  normalizeAdminReason,
  toAuditSnapshot,
  writeAdminAuditLog,
  type AdminAuditRequestMeta,
  type AdminAuditStore,
} from "./audit";
import {
  canRolePerformAdminAction,
  type AdminRole,
} from "@/server/auth/admin-access";

export interface RightsRemovalStatusRecord {
  id: string;
  publicReference: string;
  status: RightsRemovalStatus;
  resolutionSummary: string | null;
  resolvedAt: Date | null;
}

export interface AdminRightsRemovalStore {
  findById(id: string): Promise<RightsRemovalStatusRecord | null>;
  updateStatus(input: {
    id: string;
    status: RightsRemovalStatus;
    resolutionSummary: string | null;
    resolvedAt: Date | null;
    updatedAt: Date;
  }): Promise<RightsRemovalStatusRecord>;
  listRequests(filters: {
    status?: RightsRemovalStatus;
    rightsType?: RightsType;
    limit: number;
  }): Promise<RightsRemovalRequestRecord[]>;
}

const allowedRightsRemovalTransitions: Record<
  RightsRemovalStatus,
  readonly RightsRemovalStatus[]
> = {
  received: ["triaging"],
  triaging: ["awaiting_information", "action_required", "resolved_rejected"],
  awaiting_information: ["triaging", "action_required", "resolved_rejected"],
  action_required: ["triaging", "resolved_removed", "resolved_rejected"],
  resolved_removed: [],
  resolved_rejected: [],
};

const finalStatuses = new Set<RightsRemovalStatus>([
  "resolved_removed",
  "resolved_rejected",
]);

export async function updateRightsRemovalStatus({
  store,
  auditStore,
  actor,
  requestId,
  status,
  reason,
  resolutionSummary,
  requestMeta,
  now = new Date(),
}: {
  store: AdminRightsRemovalStore;
  auditStore: AdminAuditStore;
  actor: { userId: string; email: string; role: AdminRole };
  requestId: string;
  status: RightsRemovalStatus;
  reason: string;
  resolutionSummary?: string | null;
  requestMeta?: AdminAuditRequestMeta;
  now?: Date;
}) {
  const action = finalStatuses.has(status)
    ? "rights_removal:resolve"
    : "rights_removal:triage";
  if (!canRolePerformAdminAction(actor.role, action)) {
    throw new Error(
      finalStatuses.has(status)
        ? "Actor cannot resolve rights removal requests."
        : "Actor cannot triage rights removal requests.",
    );
  }

  const normalizedReason = normalizeAdminReason(reason);
  const normalizedSummary = resolutionSummary?.trim() || null;
  if (finalStatuses.has(status) && (!normalizedSummary || normalizedSummary.length < 6)) {
    throw new Error("Resolution summary is required.");
  }

  const before = await store.findById(requestId);
  if (!before) {
    throw new Error("Rights removal request not found.");
  }
  if (!allowedRightsRemovalTransitions[before.status].includes(status)) {
    throw new Error("Invalid rights removal status transition.");
  }

  const after = await store.updateStatus({
    id: requestId,
    status,
    resolutionSummary: finalStatuses.has(status) ? normalizedSummary : null,
    resolvedAt: finalStatuses.has(status) ? now : null,
    updatedAt: now,
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action,
    targetType: "rights_removal_request",
    targetId: requestId,
    reason: normalizedReason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return after;
}

export async function listRightsRemovalRequests({
  store,
  filters = {},
}: {
  store: AdminRightsRemovalStore;
  filters?: {
    status?: RightsRemovalStatus;
    rightsType?: RightsType;
    limit?: number;
  };
}) {
  const limit = Math.min(
    Math.max(Number.isFinite(filters.limit) ? Math.trunc(filters.limit!) : 50, 1),
    100,
  );
  return store.listRequests({
    status: filters.status,
    rightsType: filters.rightsType,
    limit,
  });
}

function defaultRequest(
  record: RightsRemovalStatusRecord,
): RightsRemovalRequestRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    ...record,
    reporterName: "测试权利人",
    reporterEmail: "owner@example.com",
    rightsType: "other",
    contentReferences: [],
    description: "用于后台权利案件内存存储的测试说明内容，不包含任何真实的个人信息或业务数据。",
    goodFaithConfirmed: true,
    accuracyConfirmed: true,
    ipHash: null,
    userAgentHash: null,
    redactedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInMemoryAdminRightsRemovalStore(
  initial: Array<RightsRemovalStatusRecord | RightsRemovalRequestRecord>,
): AdminRightsRemovalStore & { listAll(): RightsRemovalRequestRecord[] } {
  const records = new Map(
    initial.map((record) => [
      record.id,
      "reporterName" in record ? { ...record } : defaultRequest(record),
    ]),
  );

  return {
    async findById(id) {
      const record = records.get(id);
      return record
        ? {
            id: record.id,
            publicReference: record.publicReference,
            status: record.status,
            resolutionSummary: record.resolutionSummary,
            resolvedAt: record.resolvedAt,
          }
        : null;
    },
    async updateStatus(input) {
      const record = records.get(input.id);
      if (!record) {
        throw new Error("Rights removal request not found.");
      }
      const next = { ...record, ...input };
      records.set(input.id, next);
      return {
        id: next.id,
        publicReference: next.publicReference,
        status: next.status,
        resolutionSummary: next.resolutionSummary,
        resolvedAt: next.resolvedAt,
      };
    },
    async listRequests(filters) {
      return Array.from(records.values())
        .filter((record) => !filters.status || record.status === filters.status)
        .filter(
          (record) => !filters.rightsType || record.rightsType === filters.rightsType,
        )
        .toSorted(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, filters.limit)
        .map((record) => ({ ...record }));
    },
    listAll: () => Array.from(records.values()).map((record) => ({ ...record })),
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminRightsRemovalStore(
  db: DbClient = getDb(),
): AdminRightsRemovalStore {
  return {
    async findById(id) {
      const [record] = await db
        .select({
          id: rightsRemovalRequests.id,
          publicReference: rightsRemovalRequests.publicReference,
          status: rightsRemovalRequests.status,
          resolutionSummary: rightsRemovalRequests.resolutionSummary,
          resolvedAt: rightsRemovalRequests.resolvedAt,
        })
        .from(rightsRemovalRequests)
        .where(eq(rightsRemovalRequests.id, id))
        .limit(1);
      return (record as RightsRemovalStatusRecord | undefined) ?? null;
    },
    async updateStatus(input) {
      const [record] = await db
        .update(rightsRemovalRequests)
        .set({
          status: input.status,
          resolutionSummary: input.resolutionSummary,
          resolvedAt: input.resolvedAt,
          updatedAt: input.updatedAt,
        })
        .where(eq(rightsRemovalRequests.id, input.id))
        .returning({
          id: rightsRemovalRequests.id,
          publicReference: rightsRemovalRequests.publicReference,
          status: rightsRemovalRequests.status,
          resolutionSummary: rightsRemovalRequests.resolutionSummary,
          resolvedAt: rightsRemovalRequests.resolvedAt,
        });
      if (!record) {
        throw new Error("Rights removal request not found.");
      }
      return record as RightsRemovalStatusRecord;
    },
    async listRequests(filters) {
      const conditions: SQL[] = [];
      if (filters.status) {
        conditions.push(eq(rightsRemovalRequests.status, filters.status));
      }
      if (filters.rightsType) {
        conditions.push(eq(rightsRemovalRequests.rightsType, filters.rightsType));
      }
      const rows = await db
        .select()
        .from(rightsRemovalRequests)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(rightsRemovalRequests.createdAt))
        .limit(filters.limit);
      return rows as RightsRemovalRequestRecord[];
    },
  };
}
