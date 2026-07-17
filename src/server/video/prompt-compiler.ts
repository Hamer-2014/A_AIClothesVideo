import {
  assetFactsSnapshotFromAssets,
  buildGlobalHardConstraints,
} from "@/server/storyboard/global-constraints";
import { mvpShotTemplates } from "@/lib/templates/catalog";

export const COMPILED_PROMPT_VERSION = "global_intent_constraints_v1" as const;

const DEFAULT_HARD_CONSTRAINT =
  "Do not invent garment details not visible in the uploaded assets.";
const DEFAULT_USER_INTENT_LINE = "Clean ecommerce product video.";
const SCENE_ENVIRONMENT_CONSTRAINT =
  "Use scene/background reference only for environment, lighting, and mood.";
const SCENE_COPY_CONSTRAINT =
  "Do not copy people, faces, logos, storefront names, or readable text from the scene/background reference.";
const PRODUCT_ONLY_CONSTRAINT =
  "Do not create a person, hand, body, or model.";

export type CompileVideoPromptInput = {
  finalPromptSnapshot?: unknown;
  segment: {
    prompt: string;
    segmentIndex?: number;
    templateId?: string;
    inputAssetSnapshot?: unknown;
  };
  inputAssetSnapshot?: unknown;
};

export type CompiledVideoPrompt = {
  prompt: string;
  compiledPromptVersion: typeof COMPILED_PROMPT_VERSION;
  globalHardConstraints: string[];
  globalUserIntent: Record<string, unknown> | null;
  globalUserIntentLines: string[];
  segmentInstruction: string;
  compiledPromptSections: [
    "GLOBAL HARD CONSTRAINTS",
    "GLOBAL USER INTENT",
    "SEGMENT INSTRUCTION",
  ];
};

type AssetRole = {
  role: string;
  subjectKind?: string;
  sortOrder?: number;
};

export function compileVideoPromptForSegment(
  input: CompileVideoPromptInput,
): CompiledVideoPrompt {
  const finalPromptSnapshot = asRecord(input.finalPromptSnapshot);
  const segmentInstruction = input.segment.prompt.trim();
  const globalUserIntent = readGlobalUserIntent(finalPromptSnapshot);
  const globalUserIntentLines = formatGlobalUserIntent(globalUserIntent);
  const snapshots = [
    input.inputAssetSnapshot,
    input.segment.inputAssetSnapshot,
  ];
  const templateConstraints = mvpShotTemplates.find(
    (template) => template.templateId === input.segment.templateId,
  )?.systemConstraints ?? [];
  const globalHardConstraints = uniqueStrings([
    ...addAssetRoleConstraints(
      readHardConstraints(finalPromptSnapshot, snapshots),
      snapshots,
    ),
    ...templateConstraints,
  ]);

  return {
    prompt: [
      "GLOBAL HARD CONSTRAINTS:",
      ...globalHardConstraints.map((constraint) => `- ${constraint}`),
      "",
      "GLOBAL USER INTENT:",
      ...globalUserIntentLines.map((line) => `- ${line}`),
      "",
      "SEGMENT INSTRUCTION:",
      segmentInstruction,
    ].join("\n"),
    compiledPromptVersion: COMPILED_PROMPT_VERSION,
    globalHardConstraints,
    globalUserIntent,
    globalUserIntentLines,
    segmentInstruction,
    compiledPromptSections: [
      "GLOBAL HARD CONSTRAINTS",
      "GLOBAL USER INTENT",
      "SEGMENT INSTRUCTION",
    ],
  };
}

function readHardConstraints(
  finalPromptSnapshot: Record<string, unknown> | null,
  snapshots: unknown[],
): string[] {
  const constraints = readStringArray(finalPromptSnapshot?.globalHardConstraints);

  if (constraints.length > 0) {
    return constraints;
  }

  const systemConstraints = readStringArray(finalPromptSnapshot?.systemConstraints);

  if (systemConstraints.length > 0) {
    return systemConstraints;
  }

  const assetRoles = snapshots.flatMap(readAssetRoles);
  if (assetRoles.length > 0) {
    const facts = assetFactsSnapshotFromAssets(assetRoles);
    return buildGlobalHardConstraints({
      hasBackAsset: facts.hasBack,
      hasDetailAsset: facts.hasDetail,
      hasSceneAsset: facts.hasScene,
      hasModelFront: facts.hasModelFront,
      hasModelBack: facts.hasModelBack,
    });
  }

  return [DEFAULT_HARD_CONSTRAINT];
}

function readGlobalUserIntent(
  finalPromptSnapshot: Record<string, unknown> | null,
): Record<string, unknown> | null {
  const intent = asRecord(finalPromptSnapshot?.globalUserIntent);

  if (!intent || Object.keys(intent).length === 0) {
    return null;
  }

  return intent;
}

function formatGlobalUserIntent(
  globalUserIntent: Record<string, unknown> | null,
): string[] {
  if (!globalUserIntent) {
    return [DEFAULT_USER_INTENT_LINE];
  }

  const lines = [
    ...formatIntentValue(globalUserIntent.styleIntent),
    ...formatIntentValue(globalUserIntent.sellingPoints),
    ...formatIntentValue(globalUserIntent.negativeIntent),
  ];

  return lines.length > 0 ? lines : [DEFAULT_USER_INTENT_LINE];
}

function formatIntentValue(value: unknown): string[] {
  if (typeof value === "string") {
    const normalized = formatPromptLine(value);
    return normalized ? [normalized] : [];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map(formatPromptLine)
    .filter((item) => item.length > 0);
}

function formatPromptLine(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

function addAssetRoleConstraints(
  constraints: string[],
  snapshots: unknown[],
): string[] {
  const assetRoles = snapshots.flatMap(readAssetRoles);

  if (assetRoles.length === 0) {
    return uniqueStrings(constraints);
  }

  const roleConstraints = assetRoles.map((asset, index) =>
    buildImageRoleConstraint(asset.role, index + 1, asset.subjectKind),
  );
  const hasSceneRole = assetRoles.some((asset) => isSceneRole(asset.role));
  const hasProductOnlyRole = assetRoles.some(
    (asset) => asset.subjectKind === "product",
  );
  const sceneConstraints = hasSceneRole
    ? [SCENE_ENVIRONMENT_CONSTRAINT, SCENE_COPY_CONSTRAINT]
    : [];

  return uniqueStrings([
    ...constraints,
    ...roleConstraints,
    ...sceneConstraints,
    ...(hasProductOnlyRole ? [PRODUCT_ONLY_CONSTRAINT] : []),
  ]);
}

function readAssetRoles(snapshot: unknown): AssetRole[] {
  const record = asRecord(snapshot);
  const rawAssets = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(record?.assets)
      ? record.assets
      : Array.isArray(record?.inputAssets)
        ? record.inputAssets
        : [];

  return rawAssets
    .map(asRecord)
    .filter((asset): asset is Record<string, unknown> => asset !== null)
    .map((asset) => ({
      role: typeof asset.role === "string" ? asset.role.trim().toLowerCase() : "",
      subjectKind:
        typeof asset.subjectKind === "string"
          ? asset.subjectKind.trim().toLowerCase()
          : undefined,
      sortOrder:
        typeof asset.sortOrder === "number" ? asset.sortOrder : undefined,
    }))
    .filter((asset) => asset.role.length > 0);
}

function buildImageRoleConstraint(
  role: string,
  imageIndex: number,
  subjectKind?: string,
): string {
  if (isSceneRole(role)) {
    return `Image ${imageIndex} is a scene/background reference.`;
  }

  return subjectKind === "product"
    ? `Image ${imageIndex} is a ${role} product-only garment reference.`
    : subjectKind === "human_model"
      ? `Image ${imageIndex} is a ${role} human-model garment reference.`
      : `Image ${imageIndex} is a ${role} garment reference.`;
}

function isSceneRole(role: string): boolean {
  return role === "scene" || role === "background";
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}
