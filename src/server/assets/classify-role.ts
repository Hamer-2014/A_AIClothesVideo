import type { AssetCompleteness } from "@/lib/templates/rules";
import type { DetailType } from "@/lib/templates/types";
import type { AssetRole } from "@/server/assets/analysis-schema";

import type { ParsedAssetAnalysis } from "./analysis-schema";
import type { ParsedConsistency } from "./consistency";

const knownDetailTypes: DetailType[] = ["fabric", "neckline", "cuff", "print"];

export function isAssetAnalysisAcceptable(analysis: ParsedAssetAnalysis) {
  return (
    analysis.quality.isGarment &&
    analysis.quality.isClear &&
    analysis.quality.isSafe
  );
}

function detailTypesFromVisibleDetails(details: string[]) {
  return knownDetailTypes.filter((detailType) =>
    details.includes(detailType),
  );
}

export function buildAssetCompletenessFromAnalyses(
  analyses: ParsedAssetAnalysis[],
  declaredRoles: AssetRole[] = [],
  consistency?: Pick<ParsedConsistency, "garmentMatch" | "modelMatch"> | null,
  modelViewConsistency?: Pick<
    ParsedConsistency,
    "garmentMatch" | "modelMatch"
  > | null,
): AssetCompleteness {
  const detailTypes = new Set<DetailType>();

  for (const analysis of analyses) {
    for (const detailType of detailTypesFromVisibleDetails(
      analysis.visibleDetails,
    )) {
      detailTypes.add(detailType);
    }
  }

  return {
    hasFront:
      declaredRoles.includes("front") ||
      analyses.some((analysis) => analysis.assetRole === "front"),
    hasBack:
      declaredRoles.includes("back") ||
      analyses.some((analysis) => analysis.assetRole === "back"),
    hasSide:
      declaredRoles.includes("side") ||
      analyses.some((analysis) => analysis.assetRole === "side"),
    hasDetail:
      declaredRoles.includes("detail") ||
      analyses.some((analysis) => analysis.assetRole === "detail"),
    hasScene:
      declaredRoles.includes("scene") ||
      analyses.some((analysis) => analysis.assetRole === "scene"),
    hasModelFront: analyses.some(
      (analysis) =>
        analysis.assetRole === "front" &&
        analysis.subjectKind === "human_model",
    ),
    hasModelSide: analyses.some(
      (analysis) =>
        analysis.assetRole === "side" &&
        analysis.subjectKind === "human_model",
    ),
    hasModelBack: analyses.some(
      (analysis) =>
        analysis.assetRole === "back" &&
        analysis.subjectKind === "human_model",
    ),
    hasFlatLayOrWhiteBackground: analyses.some(
      (analysis) => analysis.quality.hasFlatLayOrWhiteBackground === true,
    ),
    hasProductFront: analyses.some(
      (analysis) =>
        analysis.subjectKind === "product" && analysis.assetRole === "front",
    ),
    hasProductSide: analyses.some(
      (analysis) =>
        analysis.subjectKind === "product" && analysis.assetRole === "side",
    ),
    hasProductBack: analyses.some(
      (analysis) =>
        analysis.subjectKind === "product" && analysis.assetRole === "back",
    ),
    garmentConsistency:
      consistency?.modelMatch === "not_applicable"
        ? consistency.garmentMatch
        : (modelViewConsistency?.garmentMatch ??
          consistency?.garmentMatch ??
          "unknown"),
    modelGarmentConsistency:
      modelViewConsistency?.garmentMatch ??
      (consistency?.modelMatch !== "not_applicable"
        ? consistency?.garmentMatch
        : undefined) ??
      "unknown",
    modelConsistency:
      modelViewConsistency?.modelMatch === "pass" ||
      modelViewConsistency?.modelMatch === "fail" ||
      modelViewConsistency?.modelMatch === "unknown"
        ? modelViewConsistency.modelMatch
        : consistency?.modelMatch === "pass" ||
            consistency?.modelMatch === "fail" ||
            consistency?.modelMatch === "unknown"
          ? consistency.modelMatch
          : "unknown",
    detailTypes: declaredRoles.includes("detail") && detailTypes.size === 0
      ? ["fabric"]
      : Array.from(detailTypes),
  };
}
