import type {
  AvailableTemplateRecommendation,
  ShotTemplateRecommendationResult,
} from "@/lib/templates/recommend";

type PresetRankableTemplate = {
  templateId: string;
  riskLevel: string;
  trialAllowed?: boolean;
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

export function requiredTemplateCount(durationSeconds: 8 | 16 | 24) {
  return durationSeconds === 8 ? 1 : durationSeconds === 16 ? 2 : 3;
}

export function rankTemplateIdsForPreset({
  recommendations,
  preset,
}: {
  recommendations: PresetRankableRecommendationResult;
  preset: StylePreset;
}) {
  const availableTemplates = sortRankableTemplates(
    [...recommendations.recommended, ...recommendations.optional],
    preset,
  );
  const rankedIds = availableTemplates.map((template) => template.templateId);

  return rankedIds.length > 0 ? rankedIds : recommendations.availableTemplateIds;
}

export function selectTemplateIdsForPreset({
  recommendations,
  preset,
  durationSeconds,
}: {
  recommendations: PresetRankableRecommendationResult;
  preset: StylePreset;
  durationSeconds: 8 | 16 | 24;
}) {
  const availableTemplateIds = rankTemplateIdsForPreset({
    recommendations,
    preset,
  });
  return availableTemplateIds.slice(0, requiredTemplateCount(durationSeconds));
}
