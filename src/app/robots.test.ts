import { describe, expect, it } from "vitest";

import robots from "./robots";

describe("robots", () => {
  it("advertises the canonical sitemap", () => {
    expect(robots().sitemap).toBe("https://aiclothesvideo.com/sitemap.xml");
  });

  it("allows public pages and blocks private application routes", () => {
    expect(robots().rules).toEqual({
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
    });
  });
});
