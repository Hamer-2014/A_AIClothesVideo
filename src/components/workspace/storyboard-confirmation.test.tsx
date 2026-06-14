// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoryboardConfirmation } from "./storyboard-confirmation";

describe("StoryboardConfirmation", () => {
  afterEach(() => {
    cleanup();
  });

  it("does not show a zero-credit confirmation summary before a draft exists", () => {
    render(
      <StoryboardConfirmation
        aspectRatio="9:16"
        creditCost={0}
        disabled
        durationSeconds={8}
        onConfirm={vi.fn()}
        segments={[]}
      />,
    );

    expect(screen.queryByText("0 点")).not.toBeInTheDocument();
    expect(screen.getByText("尚未生成分镜草稿。")).toBeInTheDocument();
  });
});
