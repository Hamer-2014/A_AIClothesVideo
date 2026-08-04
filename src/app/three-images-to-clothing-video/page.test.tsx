// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ThreeImagesLandingPage from "./page";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  recordFunnelEventSafely: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/server/analytics/funnel-events", () => ({
  recordFunnelEventSafely: mocks.recordFunnelEventSafely,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/three-images-to-clothing-video",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出登录</button>,
}));

describe("ThreeImagesLandingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("explains the three-image protocol, shot permissions, and real evidence in English", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("en");

    const { container } = render(await ThreeImagesLandingPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Three matched clothing images. A more controllable product video.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Front product image + back image + detail image")).toBeInTheDocument();
    expect(screen.getByText("Product rotation (Paid Beta)")).toBeInTheDocument();
    expect(screen.getByText("Model turn (Paid Beta)")).toBeInTheDocument();
    expect(screen.getByText(/Prompts cannot override these permissions/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You must still confirm that the detail image matches the same garment/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/This is a real workflow result/i)).toBeInTheDocument();
    const guides = screen.getByRole("navigation", { name: "Practical guides" });
    expect(within(guides).getByRole("link", { name: "Can you make a clothing video without a back image?" }))
      .toHaveAttribute("href", "/guides/clothing-video-without-back-image");
    expect(within(guides).getByRole("link", { name: "Should a clothing product video be 8, 16, 24, or 32 seconds?" }))
      .toHaveAttribute("href", "/guides/choose-clothing-video-length");
    expect(within(guides).getByRole("link", { name: "Why do AI clothing videos deform or drift?" }))
      .toHaveAttribute("href", "/guides/why-ai-clothing-videos-deform");
    expect(container.textContent).not.toMatch(/100%|zero hallucination|any three images/i);
  });

  it("keeps the Chinese protocol page and localized trial destination", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await ThreeImagesLandingPage());

    expect(screen.getByRole("heading", { level: 1, name: "用三张同款服装图，生成更可控的商品视频" }))
      .toBeInTheDocument();
    expect(screen.getByText("商品旋转（付费 Beta）")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "用三张图开始生成" })[0]).toHaveAttribute(
      "href",
      "/zh/workspace?mode=trial&preset=minimal_studio",
    );
    const guides = screen.getByRole("navigation", { name: "实用指南" });
    expect(within(guides).getByRole("link", { name: "没有背面图可以生成服装视频吗？" }))
      .toHaveAttribute("href", "/zh/guides/clothing-video-without-back-image");
    expect(within(guides).getByRole("link", { name: "服装商品视频做 8 秒、16 秒、24 秒还是 32 秒？" }))
      .toHaveAttribute("href", "/zh/guides/choose-clothing-video-length");
    expect(within(guides).getByRole("link", { name: "AI 服装视频为什么会变形或漂移？" }))
      .toHaveAttribute("href", "/zh/guides/why-ai-clothing-videos-deform");
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        source: "server",
        userId: null,
        path: "/zh/three-images-to-clothing-video",
        metadata: { sourcePage: "three_images_landing" },
      }),
    );
  });
});
