import {
  getTemplateRiskWarnings,
  getTemplateUnavailableReasons,
  type AssetCompleteness,
  type TemplateUnavailableReason,
} from "./rules";
import type { ShotTemplateDefinition, ShotTemplateRisk } from "./types";

export interface AvailableTemplateRecommendation {
  templateId: string;
  version: number;
  riskLevel: ShotTemplateRisk;
  trialAllowed: boolean;
  autoSelectAllowed: boolean;
  riskWarnings: string[];
}

export interface UnavailableTemplateRecommendation {
  templateId: string;
  reasons: TemplateUnavailableReason[];
}

export interface ShotTemplateRecommendationResult {
  recommended: AvailableTemplateRecommendation[];
  optional: AvailableTemplateRecommendation[];
  unavailable: UnavailableTemplateRecommendation[];
  availableTemplateIds: string[];
}

function toAvailableTemplate(
  template: ShotTemplateDefinition,
): AvailableTemplateRecommendation {
  return {
    templateId: template.templateId,
    version: template.version,
    riskLevel: template.riskLevel,
    trialAllowed: template.isTrialAllowed,
    autoSelectAllowed: template.autoSelectAllowed,
    riskWarnings: getTemplateRiskWarnings(template),
  };
}

export function recommendShotTemplates({
  templates,
  assetCompleteness,
  isTrial,
}: {
  templates: ShotTemplateDefinition[];
  assetCompleteness: AssetCompleteness;
  isTrial: boolean;
}): ShotTemplateRecommendationResult {
  const recommended: AvailableTemplateRecommendation[] = [];
  const optional: AvailableTemplateRecommendation[] = [];
  const unavailable: UnavailableTemplateRecommendation[] = [];

  for (const template of templates) {
    const reasons = getTemplateUnavailableReasons({
      template,
      assetCompleteness,
      isTrial,
    });

    if (reasons.length > 0) {
      unavailable.push({ templateId: template.templateId, reasons });
      continue;
    }

    const available = toAvailableTemplate(template);
    if (template.riskLevel === "low" && template.isTrialAllowed) {
      recommended.push(available);
    } else {
      optional.push(available);
    }
  }

  return {
    recommended,
    optional,
    unavailable,
    availableTemplateIds: [...recommended, ...optional].map(
      (template) => template.templateId,
    ),
  };
}
