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
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("Home", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("用中文核心承诺和真实三图证据建立首页首屏", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "三张服装图，生成一条商品宣传视频",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/上传同一件服装的正面、背面与细节图/)).toBeInTheDocument();
    expect(screen.getByText(/没有背面图，不生成背面/)).toBeInTheDocument();
    expect(
      screen.getByText(/细节图是否属于同一件服装仍需由你确认/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("landing-hero-video")).toHaveAttribute(
      "src",
      "/demo/red-dress-video.mp4",
    );
    expect(screen.getByAltText("红色连衣裙正面主图")).toHaveAttribute(
      "src",
      expect.stringContaining("/demo/red-dress-front.webp"),
    );
    expect(screen.getByAltText("红色连衣裙背面图")).toBeInTheDocument();
    expect(screen.getByAltText("红色连衣裙细节图")).toBeInTheDocument();
  });

  it("明确真实样例不代表所有服装会得到相同结果", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await Home());

    expect(
      screen.getByText(
        /样例展示真实工作流结果，不代表所有服装都会得到完全相同的动作、画面或生成时长/,
      ),
    ).toBeInTheDocument();
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
      screen.getAllByRole("link", { name: "免费生成 1 条试用视频" })[0],
    ).toHaveAttribute("href", "/workspace?mode=trial&preset=minimal_studio");
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        source: "server",
        userId: null,
        path: "/",
        metadata: { sourcePage: "homepage" },
      }),
    );
  });

  it("shows signed-in workspace actions instead of anonymous trial actions", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "merchant@example.com" },
    });

    render(await Home());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "进入工作台" })[0]).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getAllByRole("link", { name: "进入工作台" })[1]).toHaveAttribute(
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
        metadata: { sourcePage: "homepage" },
      }),
    );
  });
});
