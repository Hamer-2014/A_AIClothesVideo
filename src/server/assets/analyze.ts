import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { assetAnalyses } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import { getStylePreset, rankTemplatesForPreset } from "@/lib/presets";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
  type ProviderPurpose,
} from "@/lib/providers/log-call";
import {
  createVisionAssetAnalysis,
  type VisionAnalysisMode,
  type VisionAssetAnalysisInput,
  type VisionAssetAnalysisResult,
} from "@/lib/providers/vision/client";
import { recommendShotTemplates } from "@/lib/templates/recommend";
import type { ShotTemplateDefinition } from "@/lib/templates/types";

import { parseAssetAnalysisJson, type ParsedAssetAnalysis } from "./analysis-schema";
import type { AssetRole } from "./analysis-schema";
import {
  buildAssetCompletenessFromAnalyses,
  isAssetAnalysisAcceptable,
} from "./classify-role";

export interface AssetAnalysisRecord {
  id: string;
  assetId: string;
  providerCallLogId: string | null;
  mode: string;
  assetRole: ParsedAssetAnalysis["assetRole"];
  garmentCategory: string | null;
  viewAngle: string | null;
  humanPresent: string;
  visibleDetails: JsonValue;
  notVisibleDetails: JsonValue;
  quality: JsonValue;
  confidence: string | null;
  riskFlags: JsonValue;
  analysisJson: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAssetAnalysisRecord {
  assetId: string;
  providerCallLogId?: string | null;
  mode: string;
  analysis: ParsedAssetAnalysis;
}

export interface AssetAnalysisStore {
  createAnalysis(input: NewAssetAnalysisRecord): Promise<AssetAnalysisRecord>;
}

function toRecordInput(input: NewAssetAnalysisRecord) {
  const quality: JsonValue = {
    isGarment: input.analysis.quality.isGarment,
    isClear: input.analysis.quality.isClear,
    isSafe: input.analysis.quality.isSafe,
    hasFlatLayOrWhiteBackground:
      input.analysis.quality.hasFlatLayOrWhiteBackground ?? false,
  };

  return {
    assetId: input.assetId,
    providerCallLogId: input.providerCallLogId ?? null,
    mode: input.mode,
    assetRole: input.analysis.assetRole,
    garmentCategory: input.analysis.garmentCategory,
    viewAngle: input.analysis.viewAngle,
    humanPresent: input.analysis.humanPresent,
    visibleDetails: input.analysis.visibleDetails,
    notVisibleDetails: input.analysis.notVisibleDetails,
    quality,
    confidence: input.analysis.confidence,
    riskFlags: input.analysis.riskFlags,
    analysisJson: input.analysis.raw,
  };
}

export function createInMemoryAssetAnalysisStore(): AssetAnalysisStore & {
  listAnalyses: () => AssetAnalysisRecord[];
} {
  const analyses: AssetAnalysisRecord[] = [];

  return {
    async createAnalysis(input) {
      const now = new Date();
      const record: AssetAnalysisRecord = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...toRecordInput(input),
      };
      analyses.push(record);
      return record;
    },
    listAnalyses() {
      return analyses;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAssetAnalysisStore(
  db: DbClient = getDb(),
): AssetAnalysisStore {
  return {
    async createAnalysis(input) {
      const [record] = await db
        .insert(assetAnalyses)
        .values(toRecordInput(input))
        .returning();

      if (!record) {
        throw new Error("Failed to create asset analysis.");
      }

      return record as AssetAnalysisRecord;
    },
  };
}

export type VisionAssetAnalysisProvider = (
  input: VisionAssetAnalysisInput,
) => Promise<VisionAssetAnalysisResult>;

function purposeForVisionMode(mode: VisionAnalysisMode): ProviderPurpose {
  switch (mode) {
    case "lite":
      return "lite_asset_check";
    case "standard":
      return "standard_asset_analysis";
    case "strict":
      return "strict_asset_review";
  }
}

function errorMessageFromUnknown(error: unknown) {
  return error instanceof Error ? error.message : "Unknown vision provider error.";
}

export function userVisibleAssetAnalysisError(error: unknown) {
  const message = errorMessageFromUnknown(error);

  if (message === "fetch failed") {
    return "素材分析服务网络连接失败，请稍后重试。";
  }

  return message;
}

function summarizeAnalysis(analysis: ParsedAssetAnalysis): JsonValue {
  return {
    assetRole: analysis.assetRole,
    garmentCategory: analysis.garmentCategory,
    viewAngle: analysis.viewAngle,
    confidence: analysis.confidence,
    riskFlags: analysis.riskFlags,
  };
}

function emptyAssetCompleteness() {
  return {
    hasFront: false,
    hasBack: false,
    hasSide: false,
    hasDetail: false,
    hasScene: false,
    hasModelFront: false,
    hasFlatLayOrWhiteBackground: false,
    detailTypes: [],
  };
}

export function buildRecommendationsFromAnalyses({
  analyses,
  templates,
  isTrial,
  declaredRoles = [],
  presetId,
}: {
  analyses: ParsedAssetAnalysis[];
  templates: ShotTemplateDefinition[];
  isTrial: boolean;
  declaredRoles?: AssetRole[];
  presetId?: string | null;
}) {
  const acceptableAnalyses = analyses.filter(isAssetAnalysisAcceptable);
  const acceptable = acceptableAnalyses.length > 0;
  const assetCompleteness = acceptable
    ? buildAssetCompletenessFromAnalyses(acceptableAnalyses, declaredRoles)
    : emptyAssetCompleteness();
  const baseRecommendations = recommendShotTemplates({
    templates,
    assetCompleteness,
    isTrial,
  });
  const recommendations = rankTemplatesForPreset({
    recommendations: baseRecommendations,
    preset: getStylePreset(presetId),
  });

  return {
    acceptable,
    assetCompleteness,
    recommendations,
  };
}

export async function analyzeAssetFromVisionResult({
  store,
  assetId,
  providerCallLogId,
  mode,
  templates,
  isTrial,
  declaredRoles = [],
  visionJson,
}: {
  store: AssetAnalysisStore;
  assetId: string;
  providerCallLogId?: string | null;
  mode: "lite" | "standard" | "strict";
  templates: ShotTemplateDefinition[];
  isTrial: boolean;
  declaredRoles?: AssetRole[];
  visionJson: unknown;
}) {
  const analysis = parseAssetAnalysisJson(visionJson);
  const record = await store.createAnalysis({
    assetId,
    providerCallLogId: providerCallLogId ?? null,
    mode,
    analysis,
  });
  const recommendationResult = buildRecommendationsFromAnalyses({
    analyses: [analysis],
    templates,
    isTrial,
    declaredRoles,
  });

  return {
    analysis,
    record,
    ...recommendationResult,
  };
}

export async function analyzeAssetWithVisionProvider({
  analysisStore = createDrizzleAssetAnalysisStore(),
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  visionProvider = createVisionAssetAnalysis,
  assetId,
  userId,
  videoJobId,
  mode,
  imageUrls,
  templates,
  isTrial,
}: {
  analysisStore?: AssetAnalysisStore;
  providerCallLogStore?: ProviderCallLogStore;
  visionProvider?: VisionAssetAnalysisProvider;
  assetId: string;
  userId?: string | null;
  videoJobId?: string | null;
  mode: VisionAnalysisMode;
  imageUrls: string[];
  templates: ShotTemplateDefinition[];
  isTrial: boolean;
}) {
  const startedAt = Date.now();
  const requestSnapshot: JsonValue = {
    assetId,
    imageCount: imageUrls.length,
    mode,
  };
  const purpose = purposeForVisionMode(mode);
  let visionResult: VisionAssetAnalysisResult;

  try {
    visionResult = await visionProvider({ mode, imageUrls });
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: "vision",
      model: "unknown",
      purpose,
      userId: userId ?? null,
      videoJobId: videoJobId ?? null,
      requestSnapshot,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "vision_provider_error",
      errorMessage: errorMessageFromUnknown(error),
    });
    throw error;
  }

  let analysis: ParsedAssetAnalysis;

  try {
    analysis = parseAssetAnalysisJson(visionResult.analysisJson);
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: visionResult.provider,
      model: visionResult.model,
      purpose,
      userId: userId ?? null,
      videoJobId: videoJobId ?? null,
      requestSnapshot,
      responseSummary: visionResult.analysisJson,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "vision_schema_error",
      errorMessage: errorMessageFromUnknown(error),
    });
    throw error;
  }

  const callLog = await providerCallLogStore.createCallLog({
    provider: visionResult.provider,
    model: visionResult.model,
    purpose,
    userId: userId ?? null,
    videoJobId: videoJobId ?? null,
    requestSnapshot,
    responseSummary: summarizeAnalysis(analysis),
    durationMs: Date.now() - startedAt,
    status: "succeeded",
  });
  const record = await analysisStore.createAnalysis({
    assetId,
    providerCallLogId: callLog.id,
    mode,
    analysis,
  });
  const recommendationResult = buildRecommendationsFromAnalyses({
    analyses: [analysis],
    templates,
    isTrial,
  });

  return {
    analysis,
    record,
    providerCallLog: callLog,
    ...recommendationResult,
  };
}
