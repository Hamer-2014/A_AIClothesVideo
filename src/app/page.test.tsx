// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

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
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("Home", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses English by default and anchors the homepage in real evidence", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("en");

    render(await Home());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Three clothing images. One product video.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/front, back, and detail images of the same garment/i)).toBeInTheDocument();
    expect(screen.getByText(/No back image means no back view/i)).toBeInTheDocument();
    expect(
      screen.getByText(/You still verify that the detail image belongs to that garment/i),
    ).toBeInTheDocument();
    const workflowTitle = screen.getByRole("heading", {
      level: 2,
      name: "A controlled workflow from upload to delivery",
    });
    const workflowSection = workflowTitle.closest("section");
    expect(workflowSection).not.toBeNull();
    expect(within(workflowSection as HTMLElement).getAllByRole("listitem"))
      .toHaveLength(4);
    expect(
      within(workflowSection as HTMLElement).getByRole("heading", {
        level: 3,
        name: "Map image evidence",
      }),
    ).toBeInTheDocument();
    expect(
      within(workflowSection as HTMLElement).getByRole("heading", {
        level: 3,
        name: "Match eligible shots",
      }),
    ).toBeInTheDocument();
    const presetTitle = screen.getByRole("heading", {
      level: 2,
      name: "Tell the system where the video will be used",
    });
    const presetSection = presetTitle.closest("section");
    expect(presetSection).not.toBeNull();
    expect(within(presetSection as HTMLElement).getByRole("list"))
      .toHaveClass("md:grid-cols-2", "lg:grid-cols-3");
    expect(screen.getByTestId("landing-hero-video")).toHaveAttribute(
      "src",
      "/demo/red-dress-video.mp4",
    );
    expect(screen.getByAltText("Front product image of a red dress")).toHaveAttribute(
      "src",
      expect.stringContaining("/demo/red-dress-front.webp"),
    );
    expect(screen.getByAltText("Back image of a red dress")).toBeInTheDocument();
    expect(screen.getByAltText("Detail image of a red dress")).toBeInTheDocument();
  });

  it("keeps the Chinese homepage at /zh without mixing languages", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await Home());

    expect(screen.getByRole("heading", { level: 1, name: "三张服装图，生成一条商品宣传视频" }))
      .toBeInTheDocument();
    expect(
      screen.getByText(
        /样例展示真实工作流结果，不代表所有服装都会得到完全相同的动作、画面或生成时长/,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "免费生成 1 条试用视频" })[0])
      .toHaveAttribute("href", "/zh/workspace?mode=trial&preset=minimal_studio");
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "从上传到交付，每一步都有明确边界",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "读取素材依据" }))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "匹配可用镜头" }))
      .toBeInTheDocument();
  });

  it("shows anonymous trial actions to visitors", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("en");

    render(await Home());

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "Free trial" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Create a free trial video" })[0],
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
    mocks.getRequestLocale.mockResolvedValue("en");

    render(await Home());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Workspace" })[0]).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getAllByRole("link", { name: "Open workspace" })[0]).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Free trial" }),
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
