// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AppFooter } from "./app-footer";
import { SiteFooterContent } from "./site-footer-content";

describe("SiteFooterContent", () => {
  afterEach(() => cleanup());

  it("organizes the English footer into product, use, and trust navigation", () => {
    render(<SiteFooterContent />);

    expect(
      screen.getByText("2026 AI Clothes Video. All rights reserved."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Three clothing images. One product video."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.queryByRole("link", { name: "FAQ" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: "Virtual try-on" })).toHaveAttribute(
      "href",
      "/virtual-try-on",
    );
    expect(screen.getByRole("link", { name: "Takedown requests" })).toHaveAttribute(
      "href",
      "/takedown",
    );
    expect(screen.getByRole("navigation", { name: "Product" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Use" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Trust and support" })).toBeInTheDocument();
  });

  it("shows a structured Chinese footer with the product boundary", () => {
    render(<SiteFooterContent language="zh-CN" />);

    expect(screen.getByText("按协议上传三张同款有效素材，生成更可控的服装商品视频。"))
      .toBeInTheDocument();
    expect(screen.getByText("素材没有的背面与细节，不会作为可用镜头生成。"))
      .toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "产品" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "使用" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "信任与支持" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "三图生成视频" })).toHaveAttribute(
      "href",
      "/zh/three-images-to-clothing-video",
    );
    expect(screen.getByRole("link", { name: "虚拟试穿" })).toHaveAttribute(
      "href",
      "/zh/virtual-try-on",
    );
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute(
      "href",
      "/zh/privacy",
    );
  });

  it("uses Chinese in the dashboard footer shell", () => {
    render(<AppFooter />);

    expect(screen.getByRole("navigation", { name: "信任与支持" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Trust and support" }))
      .not.toBeInTheDocument();
  });
});
