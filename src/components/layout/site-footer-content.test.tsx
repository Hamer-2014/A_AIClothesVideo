// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteFooterContent } from "./site-footer-content";

describe("SiteFooterContent", () => {
  it("shows the unified copyright, product copy, and trust links", () => {
    render(<SiteFooterContent />);

    expect(
      screen.getByText("2026 RunwayTools. All rights reserved."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("服装商品图生成宣传短视频工具"),
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
  });
});
