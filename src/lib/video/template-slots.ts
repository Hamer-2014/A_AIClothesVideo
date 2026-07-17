import { getVideoSpec, type VideoDuration } from "./specs";

export type TemplateSlotReason =
  | "template_count_mismatch"
  | "too_few_distinct_templates"
  | "template_repeated_too_often"
  | "adjacent_duplicate_template"
  | "too_many_high_risk_templates";

export function validateTemplateSlots({
  durationSeconds,
  templateIds,
  highRiskTemplateIds,
}: {
  durationSeconds: VideoDuration;
  templateIds: string[];
  highRiskTemplateIds: string[];
}): TemplateSlotReason[] {
  const reasons: TemplateSlotReason[] = [];
  const spec = getVideoSpec(durationSeconds);
  const counts = new Map<string, number>();

  for (const templateId of templateIds) {
    counts.set(templateId, (counts.get(templateId) ?? 0) + 1);
  }

  if (templateIds.length !== spec.segmentCount) {
    reasons.push("template_count_mismatch");
  }

  if (durationSeconds === 40) {
    if (new Set(templateIds).size < 3) {
      reasons.push("too_few_distinct_templates");
    }
    if ([...counts.values()].some((count) => count > 2)) {
      reasons.push("template_repeated_too_often");
    }
    if (
      templateIds.some(
        (templateId, index) =>
          index > 0 && templateId === templateIds[index - 1],
      )
    ) {
      reasons.push("adjacent_duplicate_template");
    }
    if (
      templateIds.filter((templateId) =>
        highRiskTemplateIds.includes(templateId),
      ).length > 1
    ) {
      reasons.push("too_many_high_risk_templates");
    }
  }

  return [...new Set(reasons)];
}
