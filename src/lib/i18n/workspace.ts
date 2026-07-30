import type { SiteLocale } from "./config";
import type {
  CaptureProtocol,
  CaptureProtocolId,
} from "@/lib/video/capture-protocols";
import type { StylePreset, StylePresetId } from "@/lib/presets";

type PresetCopy = Pick<
  StylePreset,
  "label" | "shortDescription" | "defaultIntent"
>;

const protocolCopy: Record<
  CaptureProtocolId,
  Pick<CaptureProtocol, "label" | "shortLabel" | "description" | "slots">
> = {
  product_showcase: {
    label: "Three-image product showcase",
    shortLabel: "Product showcase",
    description:
      "Use front, back, and detail images of the same garment for a controlled product video.",
    slots: [
      { role: "front", label: "Front image", hint: "Show the full garment silhouette clearly" },
      { role: "back", label: "Back image", hint: "Show the back structure and fit" },
      { role: "detail", label: "Detail image", hint: "Fabric, neckline, cuff, or print" },
    ],
  },
  product_rotation: {
    label: "Product rotation",
    shortLabel: "Product rotation",
    description:
      "Use front, side, and back images of the same garment-only product. Paid Beta.",
    slots: [
      { role: "front", label: "Product front", hint: "No person; keep the background consistent" },
      { role: "side", label: "Product side", hint: "Side view of the same product" },
      { role: "back", label: "Product back", hint: "Back view of the same product" },
    ],
  },
  model_turn: {
    label: "Model turn",
    shortLabel: "Model turn",
    description:
      "Use three consecutive views of the same model wearing the same garment. Paid Beta.",
    slots: [
      { role: "front", label: "Model front", hint: "Same model and same garment" },
      { role: "side", label: "Model side", hint: "Keep the person, garment, and lighting consistent" },
      { role: "back", label: "Model back", hint: "Back view of the same person" },
    ],
  },
};

const presetCopy: Record<StylePresetId, PresetCopy> = {
  minimal_studio: {
    label: "Minimal studio",
    shortDescription:
      "A clean background that highlights the garment silhouette for product pages.",
    defaultIntent:
      "Highlight the garment silhouette and overall shape with a clean background and stable camera movement. Avoid exaggerated motion.",
  },
  marketplace_clean: {
    label: "Marketplace clean",
    shortDescription:
      "Clean motion for white-background or flat-lay product imagery.",
    defaultIntent:
      "Present a marketplace-ready product image with a clean background, prioritizing the front silhouette and visible details.",
  },
  social_lifestyle: {
    label: "Social lifestyle",
    shortDescription:
      "A restrained lifestyle mood for TikTok and Reels product testing.",
    defaultIntent:
      "Create a light lifestyle product video for social testing. Preserve the garment and do not invent scenes, back views, or details that are absent from the source images.",
  },
};

const templateCopy: Record<string, { displayName: string; description: string }> = {
  front_push_in: {
    displayName: "Front slow push-in",
    description: "A subtle push-in on the front image to highlight the overall silhouette.",
  },
  front_pan: {
    displayName: "Front subtle pan",
    description: "A restrained horizontal pan for a front-facing product image.",
  },
  product_float: {
    displayName: "Floating product",
    description: "Subtle floating motion for a flat-lay or white-background product, without generating a person.",
  },
  model_front_pose: {
    displayName: "Subtle front model pose",
    description: "A small pose change based only on the front-facing model image.",
  },
  front_crop_detail: {
    displayName: "Visible front crop",
    description: "A low-risk close crop using only areas visible in the front image.",
  },
  fabric_macro: {
    displayName: "Fabric macro",
    description: "A macro texture shot based on an uploaded fabric detail image.",
  },
  neckline_closeup: {
    displayName: "Neckline close-up",
    description: "A close-up based on an uploaded neckline detail image.",
  },
  cuff_closeup: {
    displayName: "Cuff close-up",
    description: "A close-up based on an uploaded cuff detail image.",
  },
  print_closeup: {
    displayName: "Print close-up",
    description: "A close-up based on an uploaded print detail image.",
  },
  back_display: {
    displayName: "Back view display",
    description: "A static back-view display based only on the uploaded back image.",
  },
  front_to_back_cut: {
    displayName: "Front-to-back cut",
    description: "A cut between uploaded front and back images, without generating a 360-degree turn.",
  },
  scene_lifestyle_showcase: {
    displayName: "Lifestyle scene showcase",
    description: "Uses the scene image only for background and atmosphere while preserving the garment.",
  },
  minimal_studio: {
    displayName: "Minimal studio",
    description: "A restrained studio presentation based on the front image.",
  },
  product_quarter_rotation: {
    displayName: "Product rotation 15-45 degrees",
    description: "A limited rotation using matching front and side garment-only product images. Paid Beta.",
  },
  product_half_rotation: {
    displayName: "Product rotation 180 degrees",
    description: "A half rotation using matching front, side, and back garment-only product images. Paid Beta.",
  },
  model_quarter_turn: {
    displayName: "Model turn 15-45 degrees",
    description: "A limited turn using matching front and side images of the same model and garment. Paid Beta.",
  },
  model_half_turn: {
    displayName: "Model turn 180 degrees",
    description: "A half turn using matching front, side, and back images of the same model and garment. Paid Beta.",
  },
};

export function workspaceText(
  language: SiteLocale,
  english: string,
  chinese: string,
) {
  return language === "en" ? english : chinese;
}

export function localizeCaptureProtocol(
  protocol: CaptureProtocol,
  language: SiteLocale,
): CaptureProtocol {
  if (language !== "en") return protocol;
  return { ...protocol, ...protocolCopy[protocol.id] };
}

export function localizeStylePreset(
  preset: StylePreset,
  language: SiteLocale,
): StylePreset {
  if (language !== "en") return preset;
  return { ...preset, ...presetCopy[preset.id] };
}

export function localizeTemplate<
  T extends { templateId: string; displayName: string; description: string },
>(
  template: T,
  language: SiteLocale,
): T {
  if (language !== "en") return template;
  return {
    ...template,
    ...(templateCopy[template.templateId] ?? {
      displayName: template.templateId.replaceAll("_", " "),
      description:
        "Availability is determined from the uploaded image roles and consistency checks.",
    }),
  };
}

export function localizeRiskLevel(riskLevel: string, language: SiteLocale) {
  const labels: Record<string, { en: string; "zh-CN": string }> = {
    low: { en: "Low", "zh-CN": "低风险" },
    medium: { en: "Medium", "zh-CN": "中风险" },
    medium_high: { en: "Medium-high", "zh-CN": "中高风险" },
    high: { en: "High", "zh-CN": "高风险" },
    unknown: { en: "Unknown", "zh-CN": "未知" },
  };
  return labels[riskLevel]?.[language] ?? riskLevel.replaceAll("_", " ");
}

export function safeWorkspaceMessage(
  message: string | null | undefined,
  language: SiteLocale,
  englishFallback: string,
  chineseFallback: string,
) {
  if (!message) return workspaceText(language, englishFallback, chineseFallback);
  if (language === "en" && /[\u3400-\u9fff]/u.test(message)) return englishFallback;
  return message;
}
