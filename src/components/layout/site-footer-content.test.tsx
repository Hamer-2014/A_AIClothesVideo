// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooterContent } from "./site-footer-content";

describe("SiteFooterContent", () => {
  it("shows the unified copyright, product copy, and trust links", () => {
    render(<SiteFooterContent />);

    expect(
      screen.getByText("2026 AI Clothes Video. All rights reserved."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("三张服装图，生成可发布宣传视频"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "隐私" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "条款" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(screen.getByRole("link", { name: "价格" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: "侵权删除" })).toHaveAttribute(
      "href",
      "/takedown",
    );
  });
});
