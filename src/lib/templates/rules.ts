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
  hasModelSide: boolean;
  hasModelBack: boolean;
  hasFlatLayOrWhiteBackground: boolean;
  hasProductFront: boolean;
  hasProductSide: boolean;
  hasProductBack: boolean;
  garmentConsistency: "pass" | "fail" | "unknown";
  modelGarmentConsistency: "pass" | "fail" | "unknown";
  modelConsistency: "pass" | "fail" | "unknown";
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
  | "model_side_asset_required"
  | "model_back_asset_required"
  | "flat_lay_or_white_background_required"
  | "product_front_asset_required"
  | "product_side_asset_required"
  | "product_back_asset_required"
  | "matching_product_views_required"
  | "product_view_consistency_failed"
  | "product_only_template"
  | "matching_model_garment_views_required"
  | "model_garment_consistency_failed"
  | "matching_model_views_required"
  | "model_view_consistency_failed"
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
  product_front: "product_front_asset_required",
  product_side: "product_side_asset_required",
  product_back: "product_back_asset_required",
  model_side: "model_side_asset_required",
  model_back: "model_back_asset_required",
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
    case "product_front":
      return assets.hasProductFront;
    case "product_side":
      return assets.hasProductSide;
    case "product_back":
      return assets.hasProductBack;
    case "model_side":
      return assets.hasModelSide;
    case "model_back":
      return assets.hasModelBack;
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

  if (
    template.subjectKind === "product" &&
    !assetCompleteness.hasProductFront &&
    !assetCompleteness.hasProductSide &&
    !assetCompleteness.hasProductBack
  ) {
    reasons.push("product_only_template");
  }

  if (template.consistencyRequirements.includes("same_garment")) {
    const garmentConsistency =
      template.subjectKind === "human_model"
        ? assetCompleteness.modelGarmentConsistency
        : assetCompleteness.garmentConsistency;

    if (garmentConsistency !== "pass") {
      reasons.push(
        template.subjectKind === "human_model"
          ? "matching_model_garment_views_required"
          : "matching_product_views_required",
      );
      if (garmentConsistency === "fail") {
        reasons.push(
          template.subjectKind === "human_model"
            ? "model_garment_consistency_failed"
            : "product_view_consistency_failed",
        );
      }
    }
  }

  if (
    template.consistencyRequirements.includes("same_model") &&
    assetCompleteness.modelConsistency !== "pass"
  ) {
    reasons.push("matching_model_views_required");
    if (assetCompleteness.modelConsistency === "fail") {
      reasons.push("model_view_consistency_failed");
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
