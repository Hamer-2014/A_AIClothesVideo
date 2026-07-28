// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ThreeImagesLandingPage from "./page";

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
  SignOutButton: () => <button type="button">退出登录</button>,
}));

describe("ThreeImagesLandingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("解释三图协议、镜头权限和真实案例，不复制首页职责", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const { container } = render(await ThreeImagesLandingPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "用三张同款服装图，生成更可控的商品视频",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("正面主图 + 背面图 + 细节图")).toBeInTheDocument();
    expect(screen.getByText("商品旋转（付费 Beta）")).toBeInTheDocument();
    expect(screen.getByText("真人模特转身（付费 Beta）")).toBeInTheDocument();
    expect(screen.getByText(/提示词不能越权/)).toBeInTheDocument();
    expect(
      screen.getByText(/细节图仍需由你确认同款/),
    ).toBeInTheDocument();
    expect(screen.getByText(/这是一次真实工作流结果/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/100%|零幻觉|任意三张/);
  });

  it("记录专题页访问并保留匿名试用目的地", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await ThreeImagesLandingPage());

    expect(screen.getAllByRole("link", { name: "用三张图开始生成" })[0]).toHaveAttribute(
      "href",
      "/workspace?mode=trial&preset=minimal_studio",
    );
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        source: "server",
        userId: null,
        path: "/three-images-to-clothing-video",
        metadata: { sourcePage: "three_images_landing" },
      }),
    );
  });
});
