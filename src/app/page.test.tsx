// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

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

describe("Home", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("leads with the AI Clothes Video brand and real three-image proof", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", { level: 1, name: "AI Clothes Video" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/上传 3 张服装图/)).toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-video")).toHaveAttribute(
      "src",
      "/demo/red-dress-video.mp4",
    );
    expect(screen.getByAltText("红色礼服正面原始素材")).toHaveAttribute(
      "src",
      expect.stringContaining("/demo/red-dress-front.webp"),
    );
    expect(screen.getByAltText("红色礼服背面原始素材")).toBeInTheDocument();
    expect(screen.getByAltText("红色礼服细节原始素材")).toBeInTheDocument();
  });

  it("shows anonymous trial actions to visitors", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "免费试用" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "免费生成 1 条试用视频" }),
    ).toHaveAttribute("href", "/workspace?mode=trial&preset=minimal_studio");
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        source: "server",
        userId: null,
        path: "/",
        metadata: { sourcePage: "landing" },
      }),
    );
  });

  it("shows signed-in workspace actions instead of anonymous trial actions", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "merchant@example.com" },
    });

    render(await Home());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("link", { name: "进入工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "免费试用" }),
    ).not.toBeInTheDocument();
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        source: "server",
        userId: "user-1",
        path: "/",
        metadata: { sourcePage: "landing" },
      }),
    );
  });
});
