import { describe, expect, it } from "vitest";

import {
  buildGlobalUserIntent,
  formatGlobalUserIntentForPrompt,
} from "./global-intent";

describe("global user intent", () => {
  it("extracts premium ecommerce style and visible silhouette selling point", () => {
    const intent = buildGlobalUserIntent({
      userPrompt: "高级独立站商品页风格，突出裙摆和廓形。",
      hasDetailAsset: true,
    });

    expect(intent.sourcePromptSummary).toBe("高级独立站商品页风格，突出裙摆和廓形。");
    expect(intent.styleIntent).toBe("premium clean ecommerce product video");
    expect(intent.sellingPoints).toContain("emphasize visible garment silhouette");
  });

  it("downgrades fabric texture intent when no detail asset is available", () => {
    const intent = buildGlobalUserIntent({
      userPrompt: "突出面料质感和 layering，不要做微距特写",
      hasDetailAsset: false,
    });

    expect(intent.sellingPoints).toContain(
      "emphasize visible fabric texture from the provided garment images",
    );
    expect(intent.sellingPoints.join(" ")).not.toMatch(/macro/i);
  });

  it("extracts runway-walk negative intent", () => {
    const intent = buildGlobalUserIntent({
      userPrompt: "clean product page video, no runway walk please",
      hasDetailAsset: true,
    });

    expect(intent.negativeIntent).toContain("avoid runway-walk presentation");
  });

  it("formats an empty prompt as a clean ecommerce fallback", () => {
    const intent = buildGlobalUserIntent({ userPrompt: "   " });

    expect(intent).toEqual({
      sourcePromptSummary: null,
      styleIntent: null,
      sellingPoints: [],
      negativeIntent: [],
    });
    expect(formatGlobalUserIntentForPrompt(intent)).toEqual([
      "Clean ecommerce product video.",
    ]);
  });

  it("trims, collapses whitespace, and truncates source summary", () => {
    const longPrompt = `  高级   独立站\n${"突出面料质感".repeat(30)}  `;
    const intent = buildGlobalUserIntent({
      userPrompt: longPrompt,
      hasDetailAsset: true,
    });

    expect(intent.sourcePromptSummary).toHaveLength(160);
    expect(intent.sourcePromptSummary?.endsWith("...")).toBe(true);
    expect(intent.sourcePromptSummary).not.toMatch(/\s{2,}|\n/);
  });
});
