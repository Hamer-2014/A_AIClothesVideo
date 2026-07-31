import type { SiteLocale } from "@/lib/i18n/config";

export interface LocalizedText {
  en: string;
  "zh-CN": string;
}

export type DemoSourceRole = "front" | "back" | "detail";
export type DemoSourceType = "internal-demo" | "synthetic-demo";
export type DemoCaseStatus = "published" | "source-ready";

export interface DemoSourceAsset {
  role: DemoSourceRole;
  src: string;
  alt: LocalizedText;
}

export interface DemoFeaturedOutput {
  videoSrc: string;
  posterSrc: string;
  presetId: "unknown" | "minimal_studio" | "marketplace_clean" | "social_lifestyle";
}

export interface DemoCase {
  slug: string;
  category: "dress" | "blazer" | "cardigan";
  sourceType: DemoSourceType;
  status: DemoCaseStatus;
  title: LocalizedText;
  summary: LocalizedText;
  sourceNote: LocalizedText;
  boundaryNote: LocalizedText;
  featuredImage: string;
  sourceAssets: readonly DemoSourceAsset[];
  featuredOutput: DemoFeaturedOutput | null;
}

export function localizedText(value: LocalizedText, locale: SiteLocale) {
  return value[locale];
}
