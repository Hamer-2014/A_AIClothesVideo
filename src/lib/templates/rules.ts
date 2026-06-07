import type {
  DetailType,
  RequiredAssetKind,
  ShotTemplateDefinition,
} from "./types";

export interface AssetCompleteness {
  hasFront: boolean;
  hasBack: boolean;
  hasSide: boolean;
  hasDetail: boolean;
  hasScene: boolean;
  hasModelFront: boolean;
  hasFlatLayOrWhiteBackground: boolean;
  detailTypes: DetailType[];
}

export type TemplateUnavailableReason =
  | "template_draft"
  | "template_paused"
  | "front_asset_required"
  | "back_asset_required"
  | "side_asset_required"
  | "detail_asset_required"
  | "scene_asset_required"
  | "model_front_asset_required"
  | "flat_lay_or_white_background_required"
  | "fabric_detail_required"
  | "neckline_detail_required"
  | "cuff_detail_required"
  | "print_detail_required"
  | "trial_requires_low_risk_template";

const requiredAssetReason: Record<RequiredAssetKind, TemplateUnavailableReason> = {
  front: "front_asset_required",
  back: "back_asset_required",
  side: "side_asset_required",
  detail: "detail_asset_required",
  scene: "scene_asset_required",
  model_front: "model_front_asset_required",
  flat_lay_or_white_background: "flat_lay_or_white_background_required",
};

function hasRequiredAsset(kind: RequiredAssetKind, assets: AssetCompleteness) {
  switch (kind) {
    case "front":
      return assets.hasFront;
    case "back":
      return assets.hasBack;
    case "side":
      return assets.hasSide;
    case "detail":
      return assets.hasDetail;
    case "scene":
      return assets.hasScene;
    case "model_front":
      return assets.hasModelFront;
    case "flat_lay_or_white_background":
      return assets.hasFlatLayOrWhiteBackground;
  }
}

function detailReason(detailType: DetailType): TemplateUnavailableReason {
  switch (detailType) {
    case "fabric":
      return "fabric_detail_required";
    case "neckline":
      return "neckline_detail_required";
    case "cuff":
      return "cuff_detail_required";
    case "print":
      return "print_detail_required";
  }
}

export function getTemplateUnavailableReasons({
  template,
  assetCompleteness,
  isTrial,
}: {
  template: ShotTemplateDefinition;
  assetCompleteness: AssetCompleteness;
  isTrial: boolean;
}) {
  const reasons: TemplateUnavailableReason[] = [];

  if (template.status === "draft") {
    reasons.push("template_draft");
  }
  if (template.status === "paused") {
    reasons.push("template_paused");
  }

  for (const requiredAsset of template.requiredAssets) {
    if (!hasRequiredAsset(requiredAsset, assetCompleteness)) {
      reasons.push(requiredAssetReason[requiredAsset]);
    }
  }

  for (const detailType of template.detailTypes ?? []) {
    if (!assetCompleteness.detailTypes.includes(detailType)) {
      reasons.push(detailReason(detailType));
    }
  }

  if (isTrial && template.riskLevel !== "low") {
    reasons.push("trial_requires_low_risk_template");
  }

  return [...new Set(reasons)];
}

export function getTemplateRiskWarnings(template: ShotTemplateDefinition) {
  const warnings: string[] = [];

  if (template.riskLevel === "medium_high" || template.riskLevel === "high") {
    warnings.push("high_risk_motion");
  }

  if (template.requiresStrictReview) {
    warnings.push("strict_review_required");
  }

  return warnings;
}
