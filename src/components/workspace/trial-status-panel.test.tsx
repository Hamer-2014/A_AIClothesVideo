// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrialStatusPanel } from "./trial-status-panel";

describe("TrialStatusPanel", () => {
  it("shows trial limits when available", () => {
    render(
      <TrialStatusPanel
        status={{
          state: "available",
          message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
          limits: {
            durationSeconds: 8,
            qualityLabel: "低分辨率",
            audioLabel: "无音频",
            watermarkEnabled: true,
          },
        }}
      />,
    );

    expect(screen.getByText("试用可用")).toBeInTheDocument();
    expect(screen.getByText("8 秒")).toBeInTheDocument();
    expect(screen.getByText("低分辨率")).toBeInTheDocument();
    expect(screen.getByText("无音频")).toBeInTheDocument();
    expect(screen.getByText("带水印")).toBeInTheDocument();
  });

  it("shows paid entry copy after trial was used", () => {
    render(
      <TrialStatusPanel
        status={{
          state: "used",
          message: "你的免费试用已使用。可以购买点数生成高清无水印视频。",
          limits: null,
        }}
      />,
    );

    expect(screen.getByText("试用已使用")).toBeInTheDocument();
    expect(
      screen.getByText("你的免费试用已使用。可以购买点数生成高清无水印视频。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "购买点数" })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("shows unified unavailable copy without internal reason details", () => {
    render(
      <TrialStatusPanel
        status={{
          state: "unavailable",
          message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
          limits: null,
        }}
      />,
    );
    const serialized = document.body.textContent ?? "";

    expect(screen.getByText("试用暂不可用")).toBeInTheDocument();
    expect(
      screen.getByText("当前账号暂时无法使用免费试用，可以购买点数继续生成。"),
    ).toBeInTheDocument();
    expect(serialized).not.toContain("riskScore");
    expect(serialized).not.toContain("reasonCodes");
    expect(serialized).not.toContain("ip_trial_limit");
    expect(serialized).not.toContain("hash");
  });
});
