import { describe, expect, it } from "vitest";

import { guideArticles, guideSlugs } from "./catalog";

describe("guide catalog", () => {
  it("publishes three complete English-first bilingual guides", () => {
    expect(guideSlugs).toEqual([
      "clothing-video-without-back-image",
      "choose-clothing-video-length",
      "why-ai-clothing-videos-deform",
    ]);

    for (const slug of guideSlugs) {
      const guide = guideArticles[slug];

      expect(guide.en.title).toBeTruthy();
      expect(guide.en.description).toBeTruthy();
      expect(guide.en.sections.length).toBeGreaterThanOrEqual(4);
      expect(guide["zh-CN"].title).toBeTruthy();
      expect(guide["zh-CN"].description).toBeTruthy();
      expect(guide["zh-CN"].sections.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("gives every article a parent, conversion target, and two distinct peers", () => {
    for (const slug of guideSlugs) {
      const guide = guideArticles[slug];

      expect(guide.parentHref).toBe("/three-images-to-clothing-video");
      expect(guide.ctaHref).toBe(
        "/workspace?mode=trial&preset=minimal_studio",
      );
      expect(guide.relatedSlugs).toHaveLength(2);
      expect(new Set(guide.relatedSlugs).size).toBe(2);
      expect(guide.relatedSlugs).not.toContain(slug);
      expect(guide.relatedSlugs.every((peer) => guideSlugs.includes(peer)))
        .toBe(true);
    }
  });
});
