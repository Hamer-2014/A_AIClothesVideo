export const GLOBAL_INTENT_VERSION = "global_intent_v1";

export interface GlobalUserIntent {
  sourcePromptSummary: string | null;
  styleIntent: string | null;
  sellingPoints: string[];
  negativeIntent: string[];
}

const MAX_SOURCE_SUMMARY_LENGTH = 160;

function normalizePrompt(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";

  if (!normalized) {
    return null;
  }

  if (normalized.length <= MAX_SOURCE_SUMMARY_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_SOURCE_SUMMARY_LENGTH - 3)}...`;
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function sentenceCase(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}.`;
}

export function buildGlobalUserIntent(input: {
  userPrompt?: string | null;
  hasDetailAsset?: boolean;
}): GlobalUserIntent {
  const sourcePromptSummary = normalizePrompt(input.userPrompt);
  const prompt = sourcePromptSummary?.toLowerCase() ?? "";
  const sellingPoints: string[] = [];
  const negativeIntent: string[] = [];

  const hasPremiumIntent = hasAny(prompt, [/高级/, /高端/, /\bpremium\b/]);
  const hasCleanEcommerceIntent = hasAny(prompt, [
    /\bclean\b/,
    /独立站/,
    /商品页/,
    /\becommerce\b/,
    /\bproduct page\b/,
  ]);

  const styleIntent =
    hasPremiumIntent || hasCleanEcommerceIntent
      ? `${hasPremiumIntent ? "premium " : ""}clean ecommerce product video`
      : null;

  if (hasAny(prompt, [/裙摆/, /廓形/, /\bsilhouette\b/])) {
    sellingPoints.push("emphasize visible garment silhouette");
  }

  if (hasAny(prompt, [/面料/, /质感/, /\bfabric\b/, /\btexture\b/, /\blayering\b/])) {
    sellingPoints.push(
      input.hasDetailAsset === true
        ? "emphasize visible fabric texture and layering"
        : "emphasize visible fabric texture from the provided garment images",
    );
  }

  if (hasAny(prompt, [/不走秀/, /不要真人走秀/, /\bno runway\b/, /\brunway walk\b/])) {
    negativeIntent.push("avoid runway-walk presentation");
  }

  return {
    sourcePromptSummary,
    styleIntent,
    sellingPoints,
    negativeIntent,
  };
}

export function formatGlobalUserIntentForPrompt(intent: GlobalUserIntent): string[] {
  const formatted = [
    intent.styleIntent ? sentenceCase(intent.styleIntent) : null,
    ...intent.sellingPoints.map(sentenceCase),
    ...intent.negativeIntent.map(sentenceCase),
  ].filter((item): item is string => Boolean(item?.trim()));

  if (formatted.length > 0) {
    return formatted;
  }

  return ["Clean ecommerce product video."];
}
