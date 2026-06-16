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
  allowedDurationSeconds: Array<8 | 16 | 24>;
  defaultDurationSeconds: 8 | 16 | 24;
  defaultAspectRatio: "9:16" | "1:1" | "16:9";
  riskLevel: "low" | "medium";
}

export interface StylePresetSnapshot {
  id: StylePresetId;
  label: string;
  preferredTemplateIds: string[];
  promptStyleHint: string;
}
