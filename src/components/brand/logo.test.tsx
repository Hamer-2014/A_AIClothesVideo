// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoLockup, LogoMark } from "./logo";

describe("AI Clothes Video logo", () => {
  it("uses the product name and three garment motion frames", () => {
    const { container, rerender } = render(<LogoLockup />);

    expect(screen.getByText("AI Clothes Video")).toBeInTheDocument();
    expect(container.querySelector(".lucide-play")).not.toBeInTheDocument();
    expect(
      container.querySelector('[data-brand-mark="garment-motion"]'),
    ).toBeInTheDocument();
    expect(container.querySelector('[data-brand-mark="film-motion"]'))
      .not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-garment-frame]")).toHaveLength(3);
    expect(container.querySelector("[data-video-symbol]"))
      .toBeInTheDocument();

    rerender(<LogoMark />);
    expect(
      screen.getByRole("img", { name: "AI Clothes Video" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 40 40");
  });
});
