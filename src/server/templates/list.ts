import { and, asc, isNull } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { shotTemplates } from "@/lib/db/schema";
import type {
  ConsistencyRequirement,
  RequiredAssetKind,
  ShotTemplateRecord,
  TemplateSubjectKind,
} from "@/lib/templates/types";

function toStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

type TemplateSourceRecord = {
  id?: string;
  templateId: string;
  version: number;
  status: ShotTemplateRecord["status"];
  riskLevel: ShotTemplateRecord["riskLevel"];
  displayName: string;
  description: string | null;
  subjectKind: string;
  requiredAssets: unknown;
  consistencyRequirements: unknown;
  autoSelectAllowed: boolean;
  blockedConditions: unknown;
  allowedMotion: unknown;
  basePromptIntent: string;
  systemConstraints: unknown;
  postQaChecks: unknown;
  isTrialAllowed: boolean;
  requiresStrictReview: boolean;
  createdBy?: string | null;
};

function normalizeTemplateRecord(
  template: TemplateSourceRecord,
): ShotTemplateRecord {
  return {
    ...template,
    description: template.description ?? "",
    subjectKind: template.subjectKind as TemplateSubjectKind,
    requiredAssets: toStringArray(template.requiredAssets) as RequiredAssetKind[],
    consistencyRequirements: toStringArray(
      template.consistencyRequirements,
    ) as ConsistencyRequirement[],
    blockedConditions: toStringArray(template.blockedConditions),
    allowedMotion: toStringArray(template.allowedMotion),
    systemConstraints: toStringArray(template.systemConstraints),
    postQaChecks: toStringArray(template.postQaChecks),
  };
}

export interface TemplateListStore {
  listTemplates(): Promise<ShotTemplateRecord[]>;
}

export function createInMemoryTemplateListStore(
  templates: ShotTemplateRecord[],
): TemplateListStore {
  return {
    async listTemplates() {
      return templates.map((template) => normalizeTemplateRecord(template));
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleTemplateListStore(
  db: DbClient = getDb(),
): TemplateListStore {
  return {
    async listTemplates() {
      const rows = await db
        .select({
          id: shotTemplates.id,
          templateId: shotTemplates.templateId,
          version: shotTemplates.version,
          status: shotTemplates.status,
          riskLevel: shotTemplates.riskLevel,
          displayName: shotTemplates.displayName,
          description: shotTemplates.description,
          subjectKind: shotTemplates.subjectKind,
          requiredAssets: shotTemplates.requiredAssets,
          consistencyRequirements: shotTemplates.consistencyRequirements,
          autoSelectAllowed: shotTemplates.autoSelectAllowed,
          blockedConditions: shotTemplates.blockedConditions,
          allowedMotion: shotTemplates.allowedMotion,
          basePromptIntent: shotTemplates.basePromptIntent,
          systemConstraints: shotTemplates.systemConstraints,
          postQaChecks: shotTemplates.postQaChecks,
          isTrialAllowed: shotTemplates.isTrialAllowed,
          requiresStrictReview: shotTemplates.requiresStrictReview,
          createdBy: shotTemplates.createdBy,
        })
        .from(shotTemplates)
        .where(and(isNull(shotTemplates.deletedAt)))
        .orderBy(asc(shotTemplates.templateId), asc(shotTemplates.version));

      return rows.map((template) => normalizeTemplateRecord(template));
    },
  };
}

export async function listStoredTemplates({
  store,
}: {
  store: TemplateListStore;
}) {
  return store.listTemplates();
}
