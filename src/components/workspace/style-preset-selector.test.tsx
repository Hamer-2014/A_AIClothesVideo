// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StylePresetSelector } from "./style-preset-selector";

describe("StylePresetSelector", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders MVP presets and marks the selected preset", () => {
    render(
      <StylePresetSelector
        onChange={vi.fn()}
        selectedPresetId="minimal_studio"
      />,
    );

    expect(screen.getByText("极简棚拍")).toBeInTheDocument();
    expect(screen.getByText("电商主图动效")).toBeInTheDocument();
    expect(screen.getByText("社媒氛围短片")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /极简棚拍/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("emits preset id when the user changes preset", () => {
    const onChange = vi.fn();
    render(
      <StylePresetSelector
        onChange={onChange}
        selectedPresetId="minimal_studio"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /电商主图动效/ }));

    expect(onChange).toHaveBeenCalledWith("marketplace_clean");
  });

  it("keeps preset choices compact and shows only the selected description", () => {
    render(
      <StylePresetSelector
        onChange={vi.fn()}
        selectedPresetId="minimal_studio"
      />,
    );

    expect(screen.getByRole("group", { name: "选择风格预设" })).toHaveClass(
      "grid-cols-3",
    );
    expect(screen.getByText("干净背景，突出服装版型，适合商品页展示。")).toBeInTheDocument();
    expect(
      screen.queryByText("适合白底图和平铺图，把静态商品图做成干净动效。"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "极简棚拍" })).toHaveClass(
      "min-h-11",
    );
  });
});
