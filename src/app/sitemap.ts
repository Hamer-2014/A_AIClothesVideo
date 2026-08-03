import type { MetadataRoute } from "next";

import { absoluteUrl, publicPages } from "@/lib/seo/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((page) => {
    const englishPath = page.locale === "en" ? page.path : page.alternatePath;
    const chinesePath = page.locale === "zh-CN" ? page.path : page.alternatePath;

    return {
      url: absoluteUrl(page.path),
      lastModified: new Date(`${page.lastModified}T00:00:00.000Z`),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          en: absoluteUrl(englishPath),
          "zh-CN": absoluteUrl(chinesePath),
          "x-default": absoluteUrl(englishPath),
        },
      },
    };
  });
}
