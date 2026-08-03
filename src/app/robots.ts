import type { MetadataRoute } from "next";

import { absoluteUrl, SITE_URL } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/billing",
        "/jobs",
        "/login",
        "/virtual-try-on",
        "/workspace",
        "/zh/admin",
        "/zh/billing",
        "/zh/jobs",
        "/zh/login",
        "/zh/virtual-try-on",
        "/zh/workspace",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
