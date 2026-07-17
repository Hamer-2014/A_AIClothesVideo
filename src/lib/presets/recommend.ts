import type {
  AvailableTemplateRecommendation,
  ShotTemplateRecommendationResult,
} from "@/lib/templates/recommend";
import { getVideoSpec, type VideoDuration } from "@/lib/video/specs";

type PresetRankableTemplate = {
  templateId: string;
  riskLevel: string;
  trialAllowed?: boolean;
  autoSelectAllowed?: boolean;
};

type PresetRankableRecommendationResult = {
  recommended: PresetRankableTemplate[];
  optional: PresetRankableTemplate[];
  unavailable: unknown[];
  availableTemplateIds: string[];
};

import { defaultStylePresetId, stylePresets } from "./catalog";
import type { StylePreset, StylePresetId, StylePresetSnapshot } from "./types";

export function getStylePreset(value: string | null | undefined): StylePreset {
  return (
    stylePresets.find((preset) => preset.id === value) ??
    stylePresets.find((preset) => preset.id === defaultStylePresetId) ??
    stylePresets[0]
  );
}

export function createPresetSnapshot(preset: StylePreset): StylePresetSnapshot {
  return {
    id: preset.id as StylePresetId,
    label: preset.label,
    preferredTemplateIds: [...preset.preferredTemplateIds],
    promptStyleHint: preset.promptStyleHint,
  };
}

function rankTemplate(
  template: PresetRankableTemplate,
  preset: StylePreset,
) {
  const preferredIndex = preset.preferredTemplateIds.indexOf(template.templateId);
  const discouragedIndex =
    preset.discouragedTemplateIds?.indexOf(template.templateId) ?? -1;
  const preferredScore = preferredIndex >= 0 ? 1000 - preferredIndex * 10 : 0;
  const discouragedScore =
    discouragedIndex >= 0 ? -500 - discouragedIndex * 10 : 0;
  const riskScore = template.riskLevel === "low" ? 50 : 0;
  const trialScore = template.trialAllowed === false ? 0 : 10;

  return preferredScore + discouragedScore + riskScore + trialScore;
}

function sortAvailable(
  templates: AvailableTemplateRecommendation[],
  preset: StylePreset,
) {
  return [...templates].sort((left, right) => {
    const scoreDiff = rankTemplate(right, preset) - rankTemplate(left, preset);
    return scoreDiff !== 0
      ? scoreDiff
      : left.templateId.localeCompare(right.templateId);
  });
}

function sortRankableTemplates(
  templates: PresetRankableTemplate[],
  preset: StylePreset,
) {
  return [...templates].sort((left, right) => {
    const scoreDiff = rankTemplate(right, preset) - rankTemplate(left, preset);
    return scoreDiff !== 0
      ? scoreDiff
      : left.templateId.localeCompare(right.templateId);
  });
}

export function rankTemplatesForPreset({
  recommendations,
  preset,
}: {
  recommendations: ShotTemplateRecommendationResult;
  preset: StylePreset;
}): ShotTemplateRecommendationResult {
  const allAvailable = sortAvailable(
    [...recommendations.recommended, ...recommendations.optional],
    preset,
  );
  const recommended = allAvailable.filter(
    (template) => template.riskLevel === "low" && template.trialAllowed,
  );
  const optional = allAvailable.filter(
    (template) => !(template.riskLevel === "low" && template.trialAllowed),
  );

  return {
    recommended,
    optional,
    unavailable: recommendations.unavailable,
    availableTemplateIds: allAvailable.map((template) => template.templateId),
  };
}

export function requiredTemplateCount(durationSeconds: VideoDuration) {
  return getVideoSpec(durationSeconds).segmentCount;
}

export function rankTemplateIdsForPreset({
  recommendations,
  preset,
}: {
  recommendations: PresetRankableRecommendationResult;
  preset: StylePreset;
}) {
  const recommendationObjects = [
    ...recommendations.recommended,
    ...recommendations.optional,
  ];
  const availableTemplates = sortRankableTemplates(
    recommendationObjects,
    preset,
  ).filter((template) => template.autoSelectAllowed !== false);
  const rankedIds = availableTemplates.map((template) => template.templateId);

  return recommendationObjects.length > 0
    ? rankedIds
    : recommendations.availableTemplateIds;
}

export function selectTemplateIdsForPreset({
  recommendations,
  preset,
  durationSeconds,
}: {
  recommendations: PresetRankableRecommendationResult;
  preset: StylePreset;
  durationSeconds: VideoDuration;
}) {
  const rankedIds = rankTemplateIdsForPreset({
    recommendations,
    preset,
  });
  const target = requiredTemplateCount(durationSeconds);

  if (durationSeconds !== 40) {
    return rankedIds.slice(0, target);
  }
  if (new Set(rankedIds).size < 3) {
    return rankedIds;
  }

  const selected: string[] = [];
  for (let pass = 0; selected.length < target && pass < 2; pass += 1) {
    for (const templateId of rankedIds) {
      if (selected.length >= target) break;
      if (selected.at(-1) === templateId) continue;
      if (selected.filter((id) => id === templateId).length >= 2) continue;
      selected.push(templateId);
    }
  }

  return selected;
}
