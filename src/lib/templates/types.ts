import type { JsonValue } from "@/lib/db/schema/common";
import type {
  templateRiskValues,
  templateStatusValues,
} from "@/lib/db/schema/templates";

export type ShotTemplateStatus = (typeof templateStatusValues)[number];
export type ShotTemplateRisk = (typeof templateRiskValues)[number];

export type RequiredAssetKind =
  | "front"
  | "back"
  | "side"
  | "detail"
  | "scene"
  | "model_front"
  | "flat_lay_or_white_background"
  | "product_front"
  | "product_side"
  | "product_back"
  | "model_side"
  | "model_back";

export type TemplateSubjectKind = "any" | "product" | "human_model";
export type ConsistencyRequirement = "same_garment" | "same_model";

export type DetailType = "fabric" | "neckline" | "cuff" | "print";

export interface ShotTemplateDefinition {
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
  riskLevel: ShotTemplateRisk;
  displayName: string;
  description: string;
  subjectKind: TemplateSubjectKind;
  requiredAssets: RequiredAssetKind[];
  consistencyRequirements: ConsistencyRequirement[];
  autoSelectAllowed: boolean;
  detailTypes?: DetailType[];
  blockedConditions: string[];
  allowedMotion: string[];
  basePromptIntent: string;
  systemConstraints: string[];
  postQaChecks: string[];
  isTrialAllowed: boolean;
  requiresStrictReview: boolean;
}

export interface ShotTemplateRecord extends ShotTemplateDefinition {
  id?: string;
  createdBy?: string | null;
}

export type TemplateJsonField = JsonValue;
