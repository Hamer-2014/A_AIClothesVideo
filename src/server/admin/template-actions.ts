import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { shotTemplates } from "@/lib/db/schema";
import type { ShotTemplateStatus } from "@/lib/templates/types";
import { canRolePerformAdminAction, type AdminRole } from "@/server/auth/admin-access";

import {
  type AdminAuditActor,
  type AdminAuditRequestMeta,
  type AdminAuditStore,
  normalizeAdminReason,
  toAuditSnapshot,
  writeAdminAuditLog,
} from "./audit";

export interface TemplateActionActor extends AdminAuditActor {
  role: AdminRole;
}

export interface TemplateStatusRecord {
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
}

export interface TemplateActionStore {
  findTemplate(input: {
    templateId: string;
    version: number;
  }): Promise<TemplateStatusRecord | null>;
  updateTemplateStatus(input: {
    templateId: string;
    version: number;
    status: ShotTemplateStatus;
  }): Promise<TemplateStatusRecord>;
}

export async function updateTemplateStatusByAdmin({
  store,
  auditStore,
  actor,
  templateId,
  version,
  status,
  reason,
  requestMeta,
}: {
  store: TemplateActionStore;
  auditStore: AdminAuditStore;
  actor: TemplateActionActor;
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "template:update_status")) {
    throw new Error("Actor cannot update template status.");
  }

  const normalizedReason = normalizeAdminReason(reason);
  const before = await store.findTemplate({ templateId, version });
  if (!before) {
    throw new Error(`Shot template not found: ${templateId}@${version}.`);
  }

  const after = await store.updateTemplateStatus({
    templateId,
    version,
    status,
  });

  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "template:update_status",
    targetType: "shot_template",
    targetId: `${templateId}@${version}`,
    reason: normalizedReason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return after;
}

export function createInMemoryTemplateActionStore(
  records: TemplateStatusRecord[],
): TemplateActionStore {
  const templates = new Map(
    records.map((record) => [`${record.templateId}:${record.version}`, { ...record }]),
  );

  return {
    async findTemplate({ templateId, version }) {
      const record = templates.get(`${templateId}:${version}`);
      return record ? { ...record } : null;
    },
    async updateTemplateStatus({ templateId, version, status }) {
      const key = `${templateId}:${version}`;
      const existing = templates.get(key);

      if (!existing) {
        throw new Error(`Shot template not found: ${templateId}@${version}.`);
      }

      const updated = { ...existing, status };
      templates.set(key, updated);
      return { ...updated };
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleTemplateActionStore(
  db: DbClient = getDb(),
): TemplateActionStore {
  return {
    async findTemplate({ templateId, version }) {
      const [record] = await db
        .select({
          templateId: shotTemplates.templateId,
          version: shotTemplates.version,
          status: shotTemplates.status,
        })
        .from(shotTemplates)
        .where(
          and(
            eq(shotTemplates.templateId, templateId),
            eq(shotTemplates.version, version),
          ),
        )
        .limit(1);

      return (record as TemplateStatusRecord | undefined) ?? null;
    },
    async updateTemplateStatus({ templateId, version, status }) {
      const [record] = await db
        .update(shotTemplates)
        .set({ status })
        .where(
          and(
            eq(shotTemplates.templateId, templateId),
            eq(shotTemplates.version, version),
          ),
        )
        .returning({
          templateId: shotTemplates.templateId,
          version: shotTemplates.version,
          status: shotTemplates.status,
        });

      if (!record) {
        throw new Error(`Shot template not found: ${templateId}@${version}.`);
      }

      return record as TemplateStatusRecord;
    },
  };
}
