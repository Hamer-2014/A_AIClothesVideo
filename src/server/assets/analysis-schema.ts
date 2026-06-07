import type { JsonValue } from "@/lib/db/schema/common";
import type { assetRoleValues } from "@/lib/db/schema/assets";

export type AssetRole = (typeof assetRoleValues)[number];
export type HumanPresent = "yes" | "no" | "unknown";

export interface AssetAnalysisQuality {
  isGarment: boolean;
  isClear: boolean;
  isSafe: boolean;
  hasFlatLayOrWhiteBackground?: boolean;
}

export interface ParsedAssetAnalysis {
  assetRole: AssetRole;
  garmentCategory: string;
  viewAngle: string;
  humanPresent: HumanPresent;
  visibleDetails: string[];
  notVisibleDetails: string[];
  quality: AssetAnalysisQuality;
  confidence: string;
  riskFlags: string[];
  raw: JsonValue;
}

const assetRoles: AssetRole[] = [
  "front",
  "back",
  "side",
  "detail",
  "scene",
  "logo",
  "unknown",
];
const humanPresenceValues: HumanPresent[] = ["yes", "no", "unknown"];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function requireString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Asset analysis JSON is missing required field: ${field}.`);
  }

  return value;
}

function requireStringArray(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Asset analysis JSON is missing required field: ${field}.`);
  }

  return value as string[];
}

function booleanFromQuality(
  quality: Record<string, unknown>,
  field: string,
  defaultValue = false,
) {
  const value = quality[field];
  return typeof value === "boolean" ? value : defaultValue;
}

export function parseAssetAnalysisJson(input: unknown): ParsedAssetAnalysis {
  const record = asRecord(input);
  const assetRole = requireString(record, "asset_role");
  if (!assetRoles.includes(assetRole as AssetRole)) {
    throw new Error("Asset analysis JSON has invalid asset_role.");
  }

  const humanPresent = requireString(record, "human_present");
  if (!humanPresenceValues.includes(humanPresent as HumanPresent)) {
    throw new Error("Asset analysis JSON has invalid human_present.");
  }

  const quality = asRecord(record.quality);
  if (Object.keys(quality).length === 0) {
    throw new Error("Asset analysis JSON is missing required field: quality.");
  }

  return {
    assetRole: assetRole as AssetRole,
    garmentCategory: requireString(record, "garment_category"),
    viewAngle: requireString(record, "view_angle"),
    humanPresent: humanPresent as HumanPresent,
    visibleDetails: requireStringArray(record, "visible_details"),
    notVisibleDetails: requireStringArray(record, "not_visible_details"),
    quality: {
      isGarment: booleanFromQuality(quality, "is_garment"),
      isClear: booleanFromQuality(quality, "is_clear"),
      isSafe: booleanFromQuality(quality, "is_safe"),
      hasFlatLayOrWhiteBackground: booleanFromQuality(
        quality,
        "has_flat_lay_or_white_background",
      ),
    },
    confidence: requireString(record, "confidence"),
    riskFlags: requireStringArray(record, "risk_flags"),
    raw: input as JsonValue,
  };
}
