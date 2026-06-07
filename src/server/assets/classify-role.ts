import type { AssetCompleteness } from "@/lib/templates/rules";
import type { DetailType } from "@/lib/templates/types";

import type { ParsedAssetAnalysis } from "./analysis-schema";

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
    hasFront: analyses.some((analysis) => analysis.assetRole === "front"),
    hasBack: analyses.some((analysis) => analysis.assetRole === "back"),
    hasSide: analyses.some((analysis) => analysis.assetRole === "side"),
    hasDetail: analyses.some((analysis) => analysis.assetRole === "detail"),
    hasScene: analyses.some((analysis) => analysis.assetRole === "scene"),
    hasModelFront: analyses.some(
      (analysis) =>
        analysis.assetRole === "front" && analysis.humanPresent === "yes",
    ),
    hasFlatLayOrWhiteBackground: analyses.some(
      (analysis) => analysis.quality.hasFlatLayOrWhiteBackground === true,
    ),
    detailTypes: Array.from(detailTypes),
  };
}
