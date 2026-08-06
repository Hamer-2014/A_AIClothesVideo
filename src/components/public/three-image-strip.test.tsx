// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreeImageStrip } from "./three-image-strip";

describe("ThreeImageStrip", () => {
  it("uses the adult burgundy dress source set by default", () => {
    render(<ThreeImageStrip />);

    expect(screen.getByAltText("Front appearance reference of an adult woman wearing a burgundy midi dress"))
      .toHaveAttribute(
        "src",
        expect.stringContaining("/demo/cases/burgundy-midi-dress/appearance-front.webp"),
      );
    expect(screen.getByAltText("Side appearance reference of an adult woman wearing a burgundy midi dress"))
      .toBeInTheDocument();
    expect(screen.getByAltText("Back appearance reference of an adult woman wearing a burgundy midi dress"))
      .toBeInTheDocument();
  });
});
