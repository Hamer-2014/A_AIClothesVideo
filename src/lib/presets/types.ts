export type StylePresetId =
  | "minimal_studio"
  | "marketplace_clean"
  | "social_lifestyle";

export type WorkspaceEntryMode = "trial" | "paid";

export interface StylePreset {
  id: StylePresetId;
  label: string;
  shortDescription: string;
  defaultIntent: string;
  promptStyleHint: string;
  preferredTemplateIds: string[];
  discouragedTemplateIds?: string[];
  trialAllowed: boolean;
  allowedDurationSeconds: VideoDuration[];
  defaultDurationSeconds: VideoDuration;
  defaultAspectRatio: "9:16" | "1:1" | "16:9";
  riskLevel: "low" | "medium";
}

export interface StylePresetSnapshot {
  id: StylePresetId;
  label: string;
  preferredTemplateIds: string[];
  promptStyleHint: string;
}
import type { VideoDuration } from "@/lib/video/specs";
