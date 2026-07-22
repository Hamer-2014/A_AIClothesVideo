// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LogoLockup, LogoMark } from "./logo";

describe("AI Clothes Video logo", () => {
  it("uses the current product name and an accessible mark", () => {
    const { rerender } = render(<LogoLockup />);

    expect(screen.getByText("AI Clothes Video")).toBeInTheDocument();

    rerender(<LogoMark />);
    expect(
      screen.getByRole("img", { name: "AI Clothes Video" }),
    ).toBeInTheDocument();
  });
});
