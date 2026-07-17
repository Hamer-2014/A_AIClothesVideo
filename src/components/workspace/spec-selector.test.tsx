// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SpecSelector } from "./spec-selector";

describe("SpecSelector", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses brand accent tokens for active segmented controls", () => {
    render(
      <SpecSelector
        aspectRatio="9:16"
        durationSeconds={8}
        onAspectRatioChange={vi.fn()}
        onDurationChange={vi.fn()}
      />,
    );

    const activeDuration = screen.getByRole("button", { name: "8 秒" });
    expect(activeDuration.className).toContain("bg-[var(--accent)]");
    expect(activeDuration.className).toContain("border-[var(--accent-strong)]");
    expect(activeDuration.className).not.toContain("bg-[var(--ink)]");
  });

  it("keeps segmented controls interactive", () => {
    const onDurationChange = vi.fn();
    const onAspectRatioChange = vi.fn();

    render(
      <SpecSelector
        aspectRatio="9:16"
        durationSeconds={8}
        onAspectRatioChange={onAspectRatioChange}
        onDurationChange={onDurationChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "16 秒" }));
    fireEvent.click(screen.getByRole("button", { name: "1:1" }));

    expect(onDurationChange).toHaveBeenCalledWith(16);
    expect(onAspectRatioChange).toHaveBeenCalledWith("1:1");
  });

  it("shows the gated 40-second Beta option only when enabled", () => {
    const onDurationChange = vi.fn();
    const { rerender } = render(
      <SpecSelector
        aspectRatio="9:16"
        duration40Enabled={false}
        durationSeconds={8}
        onAspectRatioChange={vi.fn()}
        onDurationChange={onDurationChange}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "40 秒 Beta" }),
    ).not.toBeInTheDocument();

    rerender(
      <SpecSelector
        aspectRatio="9:16"
        duration40Enabled
        durationSeconds={8}
        onAspectRatioChange={vi.fn()}
        onDurationChange={onDurationChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "40 秒 Beta" }));

    expect(onDurationChange).toHaveBeenCalledWith(40);
  });
});
