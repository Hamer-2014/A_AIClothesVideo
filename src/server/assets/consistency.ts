import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { assetConsistencyAnalyses } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { ProviderCallLogStore } from "@/lib/providers/log-call";
import {
  createVisionConsistencyAnalysis,
  type VisionConsistencyInput,
  type VisionConsistencyResult,
} from "@/lib/providers/vision/client";

export type ConsistencyDecision = "pass" | "fail" | "unknown";
export type ModelConsistencyDecision =
  | ConsistencyDecision
  | "not_applicable";
export type ExpectedConsistencySubjectKind = "product" | "human_model";

export type ParsedConsistency = {
  status: "passed" | "failed" | "unknown";
  garmentMatch: ConsistencyDecision;
  modelMatch: ModelConsistencyDecision;
  colorMatch: boolean;
  patternMatch: boolean;
  viewCoverage: string[];
  confidence: string;
  riskFlags: string[];
  raw: JsonValue;
};

export interface AssetConsistencyRecord extends ParsedConsistency {
  id: string;
  videoJobId: string;
  analysisKind: string;
  resultJson: JsonValue;
  providerCallLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewAssetConsistencyRecord extends ParsedConsistency {
  videoJobId: string;
  analysisKind: string;
  resultJson: JsonValue;
  providerCallLogId?: string | null;
}

export interface AssetConsistencyStore {
  upsertAnalysis(
    input: NewAssetConsistencyRecord,
  ): Promise<AssetConsistencyRecord>;
}

export interface ConsistencyAssetInput {
  assetId: string;
  role: string;
  imageUrl: string;
}

export type VisionConsistencyProvider = (
  input: VisionConsistencyInput,
) => Promise<VisionConsistencyResult>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function requireDecision(
  record: Record<string, unknown>,
  field: "garment_match",
): ConsistencyDecision;
function requireDecision(
  record: Record<string, unknown>,
  field: "model_match",
): ModelConsistencyDecision;
function requireDecision(
  record: Record<string, unknown>,
  field: "garment_match" | "model_match",
) {
  const allowed =
    field === "model_match"
      ? ["pass", "fail", "unknown", "not_applicable"]
      : ["pass", "fail", "unknown"];
  const value = record[field];

  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Consistency JSON has invalid ${field}.`);
  }

  return value;
}

function requireBoolean(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "boolean") {
    throw new Error(`Consistency JSON has invalid ${field}.`);
  }

  return value;
}

function requireString(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (typeof value !== "string") {
    throw new Error(`Consistency JSON has invalid ${field}.`);
  }

  return value;
}

function requireStringArray(record: Record<string, unknown>, field: string) {
  const value = record[field];

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Consistency JSON has invalid ${field}.`);
  }

  return value as string[];
}

function consistencyStatus({
  garmentMatch,
  modelMatch,
  expectedSubjectKind,
}: {
  garmentMatch: ConsistencyDecision;
  modelMatch: ModelConsistencyDecision;
  expectedSubjectKind: ExpectedConsistencySubjectKind;
}): ParsedConsistency["status"] {
  if (
    garmentMatch === "fail" ||
    modelMatch === "fail" ||
    (expectedSubjectKind === "product" && modelMatch === "pass") ||
    (expectedSubjectKind === "human_model" && modelMatch === "not_applicable")
  ) {
    return "failed";
  }

  if (
    garmentMatch === "pass" &&
    ((expectedSubjectKind === "product" && modelMatch === "not_applicable") ||
      (expectedSubjectKind === "human_model" && modelMatch === "pass"))
  ) {
    return "passed";
  }

  return "unknown";
}

export function parseConsistencyJson(
  input: unknown,
  expectedSubjectKind: ExpectedConsistencySubjectKind,
): ParsedConsistency {
  const record = asRecord(input);
  const garmentMatch = requireDecision(record, "garment_match");
  const modelMatch = requireDecision(record, "model_match");

  return {
    status: consistencyStatus({
      garmentMatch,
      modelMatch,
      expectedSubjectKind,
    }),
    garmentMatch,
    modelMatch,
    colorMatch: requireBoolean(record, "color_match"),
    patternMatch: requireBoolean(record, "pattern_match"),
    viewCoverage: requireStringArray(record, "view_coverage"),
    confidence: requireString(record, "confidence"),
    riskFlags: requireStringArray(record, "risk_flags"),
    raw: input as JsonValue,
  };
}

function toStoredValues(input: NewAssetConsistencyRecord) {
  return {
    videoJobId: input.videoJobId,
    analysisKind: input.analysisKind,
    status: input.status,
    garmentMatch: input.garmentMatch,
    modelMatch: input.modelMatch,
    colorMatch: input.colorMatch,
    patternMatch: input.patternMatch,
    viewCoverage: input.viewCoverage,
    confidence: input.confidence,
    riskFlags: input.riskFlags,
    resultJson: input.resultJson,
    providerCallLogId: input.providerCallLogId ?? null,
  };
}

export function createInMemoryAssetConsistencyStore(): AssetConsistencyStore & {
  listAnalyses: () => AssetConsistencyRecord[];
} {
  const records: AssetConsistencyRecord[] = [];

  return {
    async upsertAnalysis(input) {
      const now = new Date();
      const existingIndex = records.findIndex(
        (record) =>
          record.videoJobId === input.videoJobId &&
          record.analysisKind === input.analysisKind,
      );
      const existing = records[existingIndex];
      const record: AssetConsistencyRecord = {
        id: existing?.id ?? randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        raw: input.raw,
        ...toStoredValues(input),
      };

      if (existingIndex >= 0) {
        records[existingIndex] = record;
      } else {
        records.push(record);
      }

      return record;
    },
    listAnalyses() {
      return records;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAssetConsistencyStore(
  db: DbClient = getDb(),
): AssetConsistencyStore {
  return {
    async upsertAnalysis(input) {
      const values = toStoredValues(input);
      const [record] = await db
        .insert(assetConsistencyAnalyses)
        .values(values)
        .onConflictDoUpdate({
          target: [
            assetConsistencyAnalyses.videoJobId,
            assetConsistencyAnalyses.analysisKind,
          ],
          set: {
            ...values,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!record) {
        throw new Error("Failed to store asset consistency analysis.");
      }

      return {
        ...(record as Omit<AssetConsistencyRecord, "raw">),
        raw: input.raw,
      };
    },
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown vision error.";
}

function unavailableConsistency(
  expectedSubjectKind: ExpectedConsistencySubjectKind,
  error: "provider_unavailable" | "invalid_provider_response",
): ParsedConsistency & { resultJson: JsonValue } {
  const resultJson: JsonValue = { error };

  return {
    status: "unknown",
    garmentMatch: "unknown",
    modelMatch:
      expectedSubjectKind === "product" ? "not_applicable" : "unknown",
    colorMatch: false,
    patternMatch: false,
    viewCoverage: [],
    confidence: "0",
    riskFlags: [error],
    raw: resultJson,
    resultJson,
  };
}

export async function runAssetConsistencyAnalysis({
  store,
  providerCallLogStore,
  videoJobId,
  analysisKind,
  expectedSubjectKind,
  assets,
  analyzeConsistency = createVisionConsistencyAnalysis,
}: {
  store: AssetConsistencyStore;
  providerCallLogStore: ProviderCallLogStore;
  videoJobId: string;
  analysisKind: string;
  expectedSubjectKind: ExpectedConsistencySubjectKind;
  assets: ConsistencyAssetInput[];
  analyzeConsistency?: VisionConsistencyProvider;
}): Promise<AssetConsistencyRecord> {
  const startedAt = Date.now();
  const requestSnapshot: JsonValue = {
    analysisKind,
    expectedSubjectKind,
    assets: assets.map(({ assetId, role }) => ({ assetId, role })),
  };
  let providerResult: VisionConsistencyResult;

  try {
    providerResult = await analyzeConsistency({
      imageUrls: assets.map((asset) => asset.imageUrl),
      declaredRoles: assets.map((asset) => asset.role),
      expectedSubjectKind,
    });
  } catch (error) {
    const callLog = await providerCallLogStore.createCallLog({
      provider: "vision",
      model: "unknown",
      purpose: "strict_asset_review",
      videoJobId,
      requestSnapshot,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "vision_provider_error",
      errorMessage: errorMessage(error),
    });
    const unavailable = unavailableConsistency(
      expectedSubjectKind,
      "provider_unavailable",
    );

    return store.upsertAnalysis({
      videoJobId,
      analysisKind,
      ...unavailable,
      providerCallLogId: callLog.id,
    });
  }

  let parsed: ParsedConsistency;

  try {
    parsed = parseConsistencyJson(
      providerResult.consistencyJson,
      expectedSubjectKind,
    );
  } catch (error) {
    const callLog = await providerCallLogStore.createCallLog({
      provider: providerResult.provider,
      model: providerResult.model,
      purpose: "strict_asset_review",
      videoJobId,
      requestSnapshot,
      responseSummary: providerResult.consistencyJson,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "vision_schema_error",
      errorMessage: errorMessage(error),
    });
    const unavailable = unavailableConsistency(
      expectedSubjectKind,
      "invalid_provider_response",
    );

    return store.upsertAnalysis({
      videoJobId,
      analysisKind,
      ...unavailable,
      providerCallLogId: callLog.id,
    });
  }

  const callLog = await providerCallLogStore.createCallLog({
    provider: providerResult.provider,
    model: providerResult.model,
    purpose: "strict_asset_review",
    videoJobId,
    requestSnapshot,
    responseSummary: {
      status: parsed.status,
      garmentMatch: parsed.garmentMatch,
      modelMatch: parsed.modelMatch,
      viewCoverage: parsed.viewCoverage,
      riskFlags: parsed.riskFlags,
    },
    durationMs: Date.now() - startedAt,
    status: "succeeded",
  });

  return store.upsertAnalysis({
    videoJobId,
    analysisKind,
    ...parsed,
    resultJson: parsed.raw,
    providerCallLogId: callLog.id,
  });
}
