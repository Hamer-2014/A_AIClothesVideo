// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PricingPage from "./page";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  recordFunnelEventSafely: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/server/analytics/funnel-events", () => ({
  recordFunnelEventSafely: mocks.recordFunnelEventSafely,
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出</button>,
}));

describe("PricingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("shows the enabled 40-second paid Beta price and segment count", async () => {
    vi.stubEnv("VIDEO_DURATION_40_ENABLED", "true");
    mocks.getServerSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(screen.getByText("40 秒 Beta")).toBeInTheDocument();
    expect(screen.getByText("310 点 · 5 个片段")).toBeInTheDocument();
  });

  it("explains public trial, packages, duration credit costs, and failed generation credit handling", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    render(await PricingPage());

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getByText("约 1 条 8 秒视频")).toBeInTheDocument();
    expect(screen.getByText("约 2 条 16 秒视频")).toBeInTheDocument();
    expect(screen.getByText("约 5 条 24 秒视频")).toBeInTheDocument();
    expect(screen.getByText(/按当前点数消耗估算/)).toBeInTheDocument();
    expect(screen.getAllByText(/8 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/16 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/免费试用/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "免费生成 1 条试用视频" }),
    ).toHaveAttribute("href", "/workspace?mode=trial&preset=minimal_studio");
    expect(screen.getByText(/失败会释放或退回点数/)).toBeInTheDocument();
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "pricing_viewed",
        source: "server",
        userId: null,
        path: "/pricing",
        metadata: { sourcePage: "pricing" },
      }),
    );
  });

  it("shows a signed-in workspace CTA instead of anonymous header actions", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "merchant@example.com" },
    });

    render(await PricingPage());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "进入工作台" })[0]).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "免费试用" }),
    ).not.toBeInTheDocument();
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "pricing_viewed",
        source: "server",
        userId: "user-1",
        path: "/pricing",
        metadata: { sourcePage: "pricing" },
      }),
    );
  });
});
