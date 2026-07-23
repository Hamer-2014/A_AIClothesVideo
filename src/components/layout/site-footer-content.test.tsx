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
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: "Takedown requests" })).toHaveAttribute(
      "href",
      "/takedown",
    );
  });
});
