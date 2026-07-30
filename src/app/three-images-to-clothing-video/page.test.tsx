// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
