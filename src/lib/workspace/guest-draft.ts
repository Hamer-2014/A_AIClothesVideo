import { getStylePreset, type StylePresetId, type WorkspaceEntryMode } from "@/lib/presets";
import {
  getCaptureProtocol,
  type CaptureProtocolId,
} from "@/lib/video/capture-protocols";
import { isVideoDuration, type VideoDuration } from "@/lib/video/specs";

export const WORKSPACE_GUEST_DRAFT_KEY = "runwaytools_workspace_guest_draft_v1";

export type WorkspaceDraftDuration = VideoDuration;
export type WorkspaceDraftAspectRatio = "9:16" | "1:1" | "16:9";
export type WorkspaceDraftAssetRole = "front" | "back" | "side" | "detail" | "scene";

export interface WorkspaceGuestDraft {
  mode: WorkspaceEntryMode;
  presetId: StylePresetId;
  durationSeconds: WorkspaceDraftDuration;
  aspectRatio: WorkspaceDraftAspectRatio;
  captureProtocol: CaptureProtocolId;
  skuName: string;
  userPrompt: string;
  intendedAssetRoles: WorkspaceDraftAssetRole[];
  fileNames: string[];
}

const validAspectRatios = new Set(["9:16", "1:1", "16:9"]);
const validModes = new Set(["trial", "paid"]);
const validAssetRoles = new Set(["front", "back", "side", "detail", "scene"]);

function normalizeDuration(value: unknown): WorkspaceDraftDuration {
  return isVideoDuration(value) ? value : 8;
}

function normalizeAspectRatio(value: unknown): WorkspaceDraftAspectRatio {
  return typeof value === "string" && validAspectRatios.has(value)
    ? (value as WorkspaceDraftAspectRatio)
    : "9:16";
}

function normalizeMode(value: unknown): WorkspaceEntryMode {
  return typeof value === "string" && validModes.has(value)
    ? (value as WorkspaceEntryMode)
    : "paid";
}

function normalizeAssetRoles(value: unknown): WorkspaceDraftAssetRole[] {
  return Array.isArray(value)
    ? value.filter(
        (role): role is WorkspaceDraftAssetRole =>
          typeof role === "string" && validAssetRoles.has(role),
      )
    : [];
}

function normalizeFileNames(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((fileName): fileName is string => typeof fileName === "string")
    : [];
}

export function serializeWorkspaceGuestDraft(draft: WorkspaceGuestDraft) {
  return JSON.stringify({
    mode: draft.mode,
    presetId: getStylePreset(draft.presetId).id,
    durationSeconds: draft.durationSeconds,
    aspectRatio: draft.aspectRatio,
    captureProtocol: getCaptureProtocol(draft.captureProtocol).id,
    skuName: draft.skuName.trim().slice(0, 80),
    userPrompt: draft.userPrompt,
    intendedAssetRoles: draft.intendedAssetRoles,
    fileNames: draft.fileNames,
  });
}

export function parseWorkspaceGuestDraft(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      mode: normalizeMode(parsed.mode),
      presetId: getStylePreset(
        typeof parsed.presetId === "string" ? parsed.presetId : null,
      ).id,
      durationSeconds: normalizeDuration(parsed.durationSeconds),
      aspectRatio: normalizeAspectRatio(parsed.aspectRatio),
      captureProtocol: getCaptureProtocol(parsed.captureProtocol).id,
      skuName:
        typeof parsed.skuName === "string"
          ? parsed.skuName.trim().slice(0, 80)
          : "",
      userPrompt: typeof parsed.userPrompt === "string" ? parsed.userPrompt : "",
      intendedAssetRoles: normalizeAssetRoles(parsed.intendedAssetRoles),
      fileNames: normalizeFileNames(parsed.fileNames),
    } satisfies WorkspaceGuestDraft;
  } catch {
    return null;
  }
}
