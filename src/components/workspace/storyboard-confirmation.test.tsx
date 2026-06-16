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

  it("keeps generated segments in a compact confirmation region", () => {
    render(
      <StoryboardConfirmation
        aspectRatio="9:16"
        creditCost={70}
        durationSeconds={8}
        moderationPendingMessage="确认后先审核，再冻结点数并进入片段生成。"
        onConfirm={vi.fn()}
        segments={[
          {
            index: 0,
            durationSeconds: 8,
            templateId: "front_push_in",
            prompt: "保持服装版型稳定，正面慢推近。",
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "分镜确认" })).toBeInTheDocument();
    expect(screen.getByText("片段 1 / 1")).toBeInTheDocument();
    expect(screen.getByText("70 点")).toBeInTheDocument();
  });

  it("uses the brand accent for the confirmation CTA instead of the default ink button", () => {
    render(
      <StoryboardConfirmation
        aspectRatio="9:16"
        creditCost={70}
        durationSeconds={8}
        onConfirm={vi.fn()}
        segments={[
          {
            index: 0,
            durationSeconds: 8,
            templateId: "front_push_in",
            prompt: "保持服装版型稳定，正面慢推近。",
          },
        ]}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "确认分镜并生成" });
    expect(confirmButton.className).toContain("bg-[var(--accent)]");
    expect(confirmButton.className).not.toContain("bg-[var(--ink)]");
  });
});
