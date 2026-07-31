import { Children, isValidElement } from "react";
import Script from "next/script";
import { describe, expect, it, vi } from "vitest";

import RootLayout, { buildRootMetadata } from "./layout";

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: vi.fn().mockResolvedValue("en"),
}));

describe("root metadata", () => {
  it("uses English product metadata by default", () => {
    const metadata = buildRootMetadata("en");

    expect(metadata.title).toBe("AI Clothes Video");
    expect(metadata.description).toBe(
      "Upload three clothing images to create a product marketing video.",
    );
    const icons = JSON.stringify(metadata.icons);
    expect(icons).toContain("/icon.svg?v=4");
    expect(icons).not.toContain("/icon.svg?v=3");
    expect(icons).toContain("image/svg+xml");
    expect(icons).not.toContain("/favicon.ico");
    expect(icons).not.toContain("/brand/logo.png");
  });

  it("provides Chinese metadata for Chinese URLs", () => {
    const metadata = buildRootMetadata("zh-CN");

    expect(metadata.title).toBe("AI Clothes Video");
    expect(metadata.description).toBe(
      "上传 3 张服装图，生成可发布的商品宣传视频。",
    );
  });

  it("installs the Google Analytics tag for every page", async () => {
    const layout = await RootLayout({ children: <main /> });
    const body = layout.props.children;
    const scripts = Children.toArray(body.props.children).filter(isValidElement);

    expect(scripts).toContainEqual(
      expect.objectContaining({
        type: Script,
        props: expect.objectContaining({
          id: "google-analytics-loader",
          src: "https://www.googletagmanager.com/gtag/js?id=G-NDXCM536QP",
          strategy: "afterInteractive",
        }),
      }),
    );
    expect(scripts).toContainEqual(
      expect.objectContaining({
        type: Script,
        props: expect.objectContaining({
          id: "google-analytics-config",
          strategy: "afterInteractive",
          children: expect.stringContaining("gtag('config', 'G-NDXCM536QP')"),
        }),
      }),
    );
  });
});
