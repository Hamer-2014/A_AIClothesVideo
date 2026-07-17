import type { JsonValue } from "@/lib/db/schema/common";
import type { assetRoleValues } from "@/lib/db/schema/assets";

export type AssetRole = (typeof assetRoleValues)[number];
export type HumanPresent = "yes" | "no" | "unknown";
export type AssetSubjectKind = "product" | "human_model" | "unknown";

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
  subjectKind: AssetSubjectKind;
  visibleDetails: string[];
  notVisibleDetails: string[];
  quality: AssetAnalysisQuality;
  confidence: string;
  riskFlags: string[];
  raw: JsonValue;
}

export interface ParseAssetAnalysisOptions {
  declaredRole?: AssetRole;
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
const assetSubjectKinds: AssetSubjectKind[] = [
  "product",
  "human_model",
  "unknown",
];
const assetRoleAliases: Record<string, AssetRole> = {
  garment: "front",
  "garment on mannequin": "front",
  garment_on_mannequin: "front",
  product: "front",
  product_photo: "front",
  "product photo": "front",
  model: "front",
  primary: "front",
  "primary garment": "front",
  primary_product: "front",
  primary_clothing_item: "front",
  main_product: "front",
  clothing_item: "front",
  "clothing item": "front",
  clothing_product_photo: "front",
  product_clothing_item: "front",
  product_clothing_item_on_mannequin: "front",
  none: "unknown",
  "n/a": "unknown",
};

function normalizeHumanPresent(value: string): HumanPresent {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("yes")) {
    return "yes";
  }

  if (normalized.startsWith("no")) {
    return "no";
  }

  return "unknown";
}

function isSceneLikeNaturalLanguage(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.includes("not a garment") ||
    normalized.includes("no garment") ||
    normalized.includes("non-garment") ||
    normalized.includes("studio lighting") ||
    normalized.includes("lighting equipment") ||
    normalized.includes("studio setup") ||
    normalized.includes("photography setup") ||
    normalized.includes("product photography") ||
    normalized.includes("background") ||
    normalized.includes("environment") ||
    normalized.includes("scene")
  );
}

function normalizeAssetRole(
  value: string,
  options: ParseAssetAnalysisOptions = {},
): AssetRole | string {
  const normalized = value.trim().toLowerCase();
  const aliased = assetRoleAliases[normalized];

  if (aliased) {
    return aliased;
  }

  if (
    options.declaredRole === "scene" &&
    isSceneLikeNaturalLanguage(normalized)
  ) {
    return "scene";
  }

  if (
    normalized.includes("no clothing") ||
    normalized.includes("no garment") ||
    normalized.includes("none visible") ||
    normalized.includes("no product") ||
    normalized === "none"
  ) {
    return "unknown";
  }

  if (
    normalized.includes("front-facing") ||
    normalized.includes("front facing") ||
    normalized.includes("front view") ||
    normalized.includes("front-view") ||
    normalized.startsWith("front")
  ) {
    return "front";
  }

  if (
    normalized.includes("back-facing") ||
    normalized.includes("back facing") ||
    normalized.includes("back view") ||
    normalized.includes("back-view") ||
    normalized.startsWith("back")
  ) {
    return "back";
  }

  if (
    normalized.includes("side view") ||
    normalized.includes("side-view") ||
    normalized.startsWith("side")
  ) {
    return "side";
  }

  if (
    normalized.includes("detail") ||
    normalized.includes("close-up") ||
    normalized.includes("closeup") ||
    normalized.includes("macro")
  ) {
    return "detail";
  }

  if (
    normalized.includes("scene") ||
    normalized.includes("background") ||
    normalized.includes("environment")
  ) {
    return "scene";
  }

  if (
    normalized.startsWith("product") ||
    normalized.startsWith("primary") ||
    normalized.startsWith("main_product") ||
    normalized.startsWith("clothing_product") ||
    normalized.startsWith("clothing_item") ||
    normalized.startsWith("garment_on_mannequin") ||
    normalized.startsWith("garment") ||
    normalized.startsWith("model")
  ) {
    return "front";
  }

  return normalized;
}

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

function subjectKindFromAnalysis({
  explicitSubjectKind,
  humanPresent,
  isGarment,
}: {
  explicitSubjectKind: AssetSubjectKind | null;
  humanPresent: HumanPresent;
  isGarment: boolean;
}): AssetSubjectKind {
  if (explicitSubjectKind) {
    return explicitSubjectKind;
  }

  if (humanPresent === "no" && isGarment) {
    return "product";
  }

  return "unknown";
}

export function parseAssetAnalysisJson(
  input: unknown,
  options: ParseAssetAnalysisOptions = {},
): ParsedAssetAnalysis {
  const record = asRecord(input);
  const assetRole = normalizeAssetRole(
    requireString(record, "asset_role"),
    options,
  );
  if (!assetRoles.includes(assetRole as AssetRole)) {
    throw new Error("Asset analysis JSON has invalid asset_role.");
  }

  const humanPresent = normalizeHumanPresent(
    requireString(record, "human_present"),
  );
  if (!humanPresenceValues.includes(humanPresent)) {
    throw new Error("Asset analysis JSON has invalid human_present.");
  }

  const quality = asRecord(record.quality);
  if (Object.keys(quality).length === 0) {
    throw new Error("Asset analysis JSON is missing required field: quality.");
  }

  const isGarment = booleanFromQuality(quality, "is_garment");
  const subjectKindValue = record.subject_kind;
  const explicitSubjectKind =
    typeof subjectKindValue === "string"
      ? subjectKindValue.trim().toLowerCase()
      : null;

  if (
    explicitSubjectKind !== null &&
    !assetSubjectKinds.includes(explicitSubjectKind as AssetSubjectKind)
  ) {
    throw new Error("Asset analysis JSON has invalid subject_kind.");
  }

  return {
    assetRole: assetRole as AssetRole,
    garmentCategory: requireString(record, "garment_category"),
    viewAngle: requireString(record, "view_angle"),
    humanPresent: humanPresent as HumanPresent,
    subjectKind: subjectKindFromAnalysis({
      explicitSubjectKind: explicitSubjectKind as AssetSubjectKind | null,
      humanPresent: humanPresent as HumanPresent,
      isGarment,
    }),
    visibleDetails: requireStringArray(record, "visible_details"),
    notVisibleDetails: requireStringArray(record, "not_visible_details"),
    quality: {
      isGarment,
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
