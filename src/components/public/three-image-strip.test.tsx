// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThreeImageStrip } from "./three-image-strip";

describe("ThreeImageStrip", () => {
  it("uses the adult burgundy dress source set by default", () => {
    render(<ThreeImageStrip />);

    expect(screen.getByAltText("Front product image of an adult burgundy midi dress"))
      .toHaveAttribute(
        "src",
        expect.stringContaining("/demo/cases/burgundy-midi-dress/front.webp"),
      );
    expect(screen.getByAltText("Back image of an adult burgundy midi dress"))
      .toBeInTheDocument();
    expect(screen.getByAltText("Detail image of an adult burgundy midi dress"))
      .toBeInTheDocument();
  });
});
