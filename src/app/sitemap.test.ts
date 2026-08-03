import { describe, expect, it } from "vitest";

import sitemap from "./sitemap";

const SITE_URL = "https://aiclothesvideo.com";

const expectedLastModified: Record<string, string> = {
  "/": "2026-08-02",
  "/three-images-to-clothing-video": "2026-07-30",
  "/guides": "2026-08-03",
  "/guides/clothing-video-without-back-image": "2026-08-03",
  "/guides/choose-clothing-video-length": "2026-08-03",
  "/guides/why-ai-clothing-videos-deform": "2026-08-03",
  "/examples": "2026-07-30",
  "/pricing": "2026-07-30",
  "/faq": "2026-07-30",
  "/privacy": "2026-07-31",
  "/terms": "2026-07-30",
  "/acceptable-use": "2026-07-30",
  "/takedown": "2026-07-30",
  "/zh": "2026-08-02",
  "/zh/three-images-to-clothing-video": "2026-07-30",
  "/zh/guides": "2026-08-03",
  "/zh/guides/clothing-video-without-back-image": "2026-08-03",
  "/zh/guides/choose-clothing-video-length": "2026-08-03",
  "/zh/guides/why-ai-clothing-videos-deform": "2026-08-03",
  "/zh/examples": "2026-07-30",
  "/zh/pricing": "2026-07-30",
  "/zh/faq": "2026-07-30",
  "/zh/privacy": "2026-07-31",
  "/zh/terms": "2026-07-30",
  "/zh/acceptable-use": "2026-07-30",
  "/zh/takedown": "2026-07-30",
};

describe("sitemap", () => {
  it("contains each public localized page once with its maintained update date", () => {
    const entries = sitemap();

    expect(entries).toHaveLength(Object.keys(expectedLastModified).length);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(entries.length);

    for (const [path, date] of Object.entries(expectedLastModified)) {
      const entry = entries.find((candidate) => candidate.url === `${SITE_URL}${path}`);

      expect(entry, `missing sitemap entry for ${path}`).toBeDefined();
      expect(entry?.lastModified).toEqual(new Date(`${date}T00:00:00.000Z`));
    }
  });

  it("publishes English, Chinese, and default alternates for every page", () => {
    for (const entry of sitemap()) {
      const path = new URL(entry.url).pathname;
      const englishPath = path === "/zh" ? "/" : path.replace(/^\/zh\//, "/");
      const chinesePath = englishPath === "/" ? "/zh" : `/zh${englishPath}`;

      expect(entry.alternates?.languages).toEqual({
        en: `${SITE_URL}${englishPath}`,
        "zh-CN": `${SITE_URL}${chinesePath}`,
        "x-default": `${SITE_URL}${englishPath}`,
      });
    }
  });

  it("does not expose authenticated, administrative, or API routes", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    const privatePrefixes = [
      "/login",
      "/workspace",
      "/jobs",
      "/billing",
      "/admin",
      "/api",
      "/virtual-try-on",
    ];

    expect(
      urls.some((path) =>
        privatePrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)),
      ),
    ).toBe(false);
  });
});
