import { describe, expect, it } from "vitest";

import {
  defaultLocale,
  localeFromPathname,
  localizeHref,
  stripLocalePrefix,
} from "./config";

describe("site locale routing", () => {
  it("uses English for unprefixed paths and Chinese for /zh paths", () => {
    expect(defaultLocale).toBe("en");
    expect(localeFromPathname("/")).toBe("en");
    expect(localeFromPathname("/pricing")).toBe("en");
    expect(localeFromPathname("/zh")).toBe("zh-CN");
    expect(localeFromPathname("/zh/pricing")).toBe("zh-CN");
    expect(localeFromPathname("/zh-hans/pricing")).toBe("en");
  });

  it("removes only the Chinese route prefix", () => {
    expect(stripLocalePrefix("/zh")).toBe("/");
    expect(stripLocalePrefix("/zh/faq")).toBe("/faq");
    expect(stripLocalePrefix("/pricing")).toBe("/pricing");
  });

  it("localizes internal links while preserving query strings and hashes", () => {
    expect(localizeHref("/pricing?package=starter", "zh-CN")).toBe(
      "/zh/pricing?package=starter",
    );
    expect(localizeHref("/zh/pricing?package=starter#plans", "en")).toBe(
      "/pricing?package=starter#plans",
    );
    expect(localizeHref("/zh/faq", "zh-CN")).toBe("/zh/faq");
  });

  it("leaves non-route targets unchanged", () => {
    expect(localizeHref("mailto:support@aiclothesvideo.com", "zh-CN")).toBe(
      "mailto:support@aiclothesvideo.com",
    );
    expect(localizeHref("https://example.com", "zh-CN")).toBe(
      "https://example.com",
    );
    expect(localizeHref("#proof", "zh-CN")).toBe("#proof");
  });
});
