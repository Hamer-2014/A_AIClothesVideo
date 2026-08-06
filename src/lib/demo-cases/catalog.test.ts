import { describe, expect, it } from "vitest";

import { demoCases, getDemoCase } from "./catalog";

describe("demo case catalog", () => {
  it("publishes three distinct garment categories with truthful source types", () => {
    expect(demoCases.map((item) => item.slug)).toEqual([
      "burgundy-midi-dress",
      "structured-blazer",
      "knit-cardigan",
    ]);
    expect(new Set(demoCases.map((item) => item.category)).size).toBe(3);
    expect(demoCases.map((item) => item.sourceType)).toEqual([
      "synthetic-demo",
      "synthetic-demo",
      "synthetic-demo",
    ]);
  });

  it("keeps exactly three source roles for every SKU", () => {
    expect(getDemoCase("burgundy-midi-dress")?.sourceAssets.map((asset) => asset.role))
      .toEqual(["front", "side", "back"]);
    for (const item of demoCases.filter((item) => item.slug !== "burgundy-midi-dress")) {
      expect(item.sourceAssets.map((asset) => asset.role)).toEqual(["front", "back", "detail"]);
    }

    expect(getDemoCase("structured-blazer")?.sourceAssets[0]?.src)
      .toBe("/demo/cases/structured-blazer/front.webp");
    expect(getDemoCase("knit-cardigan")?.sourceAssets[2]?.src)
      .toBe("/demo/cases/knit-cardigan/detail.webp");
  });

  it("does not invent outputs for source-ready synthetic cases", () => {
    expect(getDemoCase("burgundy-midi-dress")?.status).toBe("published");
    expect(getDemoCase("burgundy-midi-dress")?.featuredOutput).toEqual({
      videoSrc: "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s.mp4",
      posterSrc: "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s-poster.webp",
      presetId: "minimal_studio",
    });
    expect(getDemoCase("burgundy-midi-dress")?.sourceNote.en)
      .toContain("virtual-try-on workflow");
    expect(getDemoCase("burgundy-midi-dress")?.boundaryNote.en)
      .toContain("24-second version is not published");
    expect(JSON.stringify(demoCases)).not.toContain("/demo/red-dress-");
    expect(getDemoCase("structured-blazer")?.status).toBe("source-ready");
    expect(getDemoCase("structured-blazer")?.featuredOutput).toBeNull();
    expect(getDemoCase("knit-cardigan")?.status).toBe("source-ready");
    expect(getDemoCase("knit-cardigan")?.featuredOutput).toBeNull();
  });

  it("returns null for an unknown slug", () => {
    expect(getDemoCase("missing")).toBeNull();
  });
});
