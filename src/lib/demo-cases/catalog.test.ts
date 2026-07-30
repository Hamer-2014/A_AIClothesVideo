import { describe, expect, it } from "vitest";

import { demoCases, getDemoCase } from "./catalog";

describe("demo case catalog", () => {
  it("publishes three distinct garment categories with truthful source types", () => {
    expect(demoCases.map((item) => item.slug)).toEqual([
      "red-dress",
      "structured-blazer",
      "knit-cardigan",
    ]);
    expect(new Set(demoCases.map((item) => item.category)).size).toBe(3);
    expect(demoCases.map((item) => item.sourceType)).toEqual([
      "internal-demo",
      "synthetic-demo",
      "synthetic-demo",
    ]);
  });

  it("keeps exactly three source roles for every SKU", () => {
    for (const item of demoCases) {
      expect(item.sourceAssets.map((asset) => asset.role)).toEqual([
        "front",
        "back",
        "detail",
      ]);
    }

    expect(getDemoCase("structured-blazer")?.sourceAssets[0]?.src)
      .toBe("/demo/cases/structured-blazer/front.webp");
    expect(getDemoCase("knit-cardigan")?.sourceAssets[2]?.src)
      .toBe("/demo/cases/knit-cardigan/detail.webp");
  });

  it("does not invent outputs for source-ready synthetic cases", () => {
    expect(getDemoCase("red-dress")?.status).toBe("published");
    expect(getDemoCase("red-dress")?.featuredOutput?.videoSrc)
      .toBe("/demo/red-dress-video.mp4");
    expect(getDemoCase("structured-blazer")?.status).toBe("source-ready");
    expect(getDemoCase("structured-blazer")?.featuredOutput).toBeNull();
    expect(getDemoCase("knit-cardigan")?.status).toBe("source-ready");
    expect(getDemoCase("knit-cardigan")?.featuredOutput).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(getDemoCase("missing")).toBeNull();
  });
});
