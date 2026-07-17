import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { shotTemplates } from "@/lib/db/schema";
import type {
  ShotTemplateDefinition,
  ShotTemplateRecord,
  ShotTemplateStatus,
} from "@/lib/templates/types";
import {
  canRolePerformAdminAction,
  type AdminRole,
} from "@/server/auth/admin-access";

export interface ShotTemplateStore {
  upsertTemplate(template: ShotTemplateDefinition): Promise<ShotTemplateRecord>;
  updateTemplateStatus(input: {
    templateId: string;
    version: number;
    status: ShotTemplateStatus;
  }): Promise<ShotTemplateRecord>;
}

export function createInMemoryShotTemplateStore(): ShotTemplateStore & {
  listTemplates: () => ShotTemplateRecord[];
} {
  const templates = new Map<string, ShotTemplateRecord>();
  const keyFor = (templateId: string, version: number) => `${templateId}:${version}`;

  return {
    async upsertTemplate(template) {
      const key = keyFor(template.templateId, template.version);
      const existing = templates.get(key);
      const record: ShotTemplateRecord = {
        ...existing,
        ...template,
      };
      templates.set(key, record);
      return record;
    },
    async updateTemplateStatus({ templateId, version, status }) {
      const key = keyFor(templateId, version);
      const existing = templates.get(key);
      if (!existing) {
        throw new Error(`Shot template not found: ${templateId}@${version}.`);
      }

      const updated = { ...existing, status };
      templates.set(key, updated);
      return updated;
    },
    listTemplates() {
      return Array.from(templates.values());
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleShotTemplateStore(
  db: DbClient = getDb(),
): ShotTemplateStore {
  return {
    async upsertTemplate(template) {
      const [existing] = await db
        .select()
        .from(shotTemplates)
        .where(
          and(
            eq(shotTemplates.templateId, template.templateId),
            eq(shotTemplates.version, template.version),
          ),
        )
        .limit(1);

      const values = {
        templateId: template.templateId,
        version: template.version,
        status: template.status,
        riskLevel: template.riskLevel,
        displayName: template.displayName,
        description: template.description,
        subjectKind: template.subjectKind,
        requiredAssets: template.requiredAssets,
        consistencyRequirements: template.consistencyRequirements,
        autoSelectAllowed: template.autoSelectAllowed,
        blockedConditions: template.blockedConditions,
        allowedMotion: template.allowedMotion,
        basePromptIntent: template.basePromptIntent,
        systemConstraints: template.systemConstraints,
        postQaChecks: template.postQaChecks,
        isTrialAllowed: template.isTrialAllowed,
        requiresStrictReview: template.requiresStrictReview,
      };

      if (existing) {
        const [updated] = await db
          .update(shotTemplates)
          .set(values)
          .where(eq(shotTemplates.id, existing.id))
          .returning();

        if (!updated) {
          throw new Error("Failed to update shot template.");
        }

        return updated as ShotTemplateRecord;
      }

      const [created] = await db.insert(shotTemplates).values(values).returning();
      if (!created) {
        throw new Error("Failed to create shot template.");
      }

      return created as ShotTemplateRecord;
    },
    async updateTemplateStatus({ templateId, version, status }) {
      const [updated] = await db
        .update(shotTemplates)
        .set({ status })
        .where(
          and(
            eq(shotTemplates.templateId, templateId),
            eq(shotTemplates.version, version),
          ),
        )
        .returning();

      if (!updated) {
        throw new Error(`Shot template not found: ${templateId}@${version}.`);
      }

      return updated as ShotTemplateRecord;
    },
  };
}

export async function seedShotTemplates({
  store,
  templates,
}: {
  store: ShotTemplateStore;
  templates: ShotTemplateDefinition[];
}) {
  const results: ShotTemplateRecord[] = [];

  for (const template of templates) {
    results.push(await store.upsertTemplate(template));
  }

  return results;
}

export async function updateShotTemplateStatus({
  store,
  actorRole,
  templateId,
  version,
  status,
}: {
  store: ShotTemplateStore;
  actorRole: AdminRole | "viewer";
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
}) {
  const isKnownAdminRole = actorRole === "admin" || actorRole === "operator";

  if (
    !isKnownAdminRole ||
    !canRolePerformAdminAction(actorRole, "template:update_status")
  ) {
    throw new Error("Actor cannot update template status.");
  }

  return store.updateTemplateStatus({ templateId, version, status });
}
