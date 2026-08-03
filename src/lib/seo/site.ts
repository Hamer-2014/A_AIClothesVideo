export const SITE_URL = "https://aiclothesvideo.com";

export type SiteLocale = "en" | "zh-CN";

export type PublicPage = {
  path: string;
  locale: SiteLocale;
  alternatePath: string;
  lastModified: `${number}-${number}-${number}`;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
};

export const publicPages = [
  {
    path: "/",
    locale: "en",
    alternatePath: "/zh",
    lastModified: "2026-08-02",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/three-images-to-clothing-video",
    locale: "en",
    alternatePath: "/zh/three-images-to-clothing-video",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/guides",
    locale: "en",
    alternatePath: "/zh/guides",
    lastModified: "2026-08-03",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/guides/clothing-video-without-back-image",
    locale: "en",
    alternatePath: "/zh/guides/clothing-video-without-back-image",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/guides/choose-clothing-video-length",
    locale: "en",
    alternatePath: "/zh/guides/choose-clothing-video-length",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/guides/why-ai-clothing-videos-deform",
    locale: "en",
    alternatePath: "/zh/guides/why-ai-clothing-videos-deform",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/examples",
    locale: "en",
    alternatePath: "/zh/examples",
    lastModified: "2026-07-30",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/pricing",
    locale: "en",
    alternatePath: "/zh/pricing",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/faq",
    locale: "en",
    alternatePath: "/zh/faq",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/privacy",
    locale: "en",
    alternatePath: "/zh/privacy",
    lastModified: "2026-07-31",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/terms",
    locale: "en",
    alternatePath: "/zh/terms",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/acceptable-use",
    locale: "en",
    alternatePath: "/zh/acceptable-use",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/takedown",
    locale: "en",
    alternatePath: "/zh/takedown",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/zh",
    locale: "zh-CN",
    alternatePath: "/",
    lastModified: "2026-08-02",
    changeFrequency: "weekly",
    priority: 1,
  },
  {
    path: "/zh/three-images-to-clothing-video",
    locale: "zh-CN",
    alternatePath: "/three-images-to-clothing-video",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.9,
  },
  {
    path: "/zh/guides",
    locale: "zh-CN",
    alternatePath: "/guides",
    lastModified: "2026-08-03",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/zh/guides/clothing-video-without-back-image",
    locale: "zh-CN",
    alternatePath: "/guides/clothing-video-without-back-image",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/zh/guides/choose-clothing-video-length",
    locale: "zh-CN",
    alternatePath: "/guides/choose-clothing-video-length",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/zh/guides/why-ai-clothing-videos-deform",
    locale: "zh-CN",
    alternatePath: "/guides/why-ai-clothing-videos-deform",
    lastModified: "2026-08-03",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/zh/examples",
    locale: "zh-CN",
    alternatePath: "/examples",
    lastModified: "2026-07-30",
    changeFrequency: "weekly",
    priority: 0.8,
  },
  {
    path: "/zh/pricing",
    locale: "zh-CN",
    alternatePath: "/pricing",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.8,
  },
  {
    path: "/zh/faq",
    locale: "zh-CN",
    alternatePath: "/faq",
    lastModified: "2026-07-30",
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    path: "/zh/privacy",
    locale: "zh-CN",
    alternatePath: "/privacy",
    lastModified: "2026-07-31",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/zh/terms",
    locale: "zh-CN",
    alternatePath: "/terms",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/zh/acceptable-use",
    locale: "zh-CN",
    alternatePath: "/acceptable-use",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    path: "/zh/takedown",
    locale: "zh-CN",
    alternatePath: "/takedown",
    lastModified: "2026-07-30",
    changeFrequency: "yearly",
    priority: 0.3,
  },
] satisfies readonly PublicPage[];

export function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}
