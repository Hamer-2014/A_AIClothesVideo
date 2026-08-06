// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ExamplesPage from "./page";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  recordFunnelEventSafely: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

vi.mock("@/server/analytics/funnel-events", () => ({
  recordFunnelEventSafely: mocks.recordFunnelEventSafely,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/examples",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">Sign out</button>,
}));

describe("ExamplesPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows generated multi-SKU source material in English", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("en");

    render(await ExamplesPage());

    expect(screen.getByRole("heading", { level: 2, name: "Adult burgundy midi dress" }))
      .toBeInTheDocument();
    expect(screen.getByTestId("demo-case-video")).toHaveAttribute(
      "src",
      "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s.mp4",
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Three garments. Three traceable source sets.",
      }),
    ).toBeInTheDocument();
    const blazerPreview = screen.getByAltText(
      "Cobalt structured blazer source preview",
    );
    const cardiganPreview = screen.getByAltText(
      "Sage rib-knit cardigan source preview",
    );

    expect(decodeURIComponent(blazerPreview.getAttribute("src") ?? ""))
      .toContain("/demo/cases/structured-blazer/front.webp");
    expect(decodeURIComponent(cardiganPreview.getAttribute("src") ?? ""))
      .toContain("/demo/cases/knit-cardigan/front.webp");
    expect(
      screen.getByText(
        "Synthetic inputs are labeled and traceable. They are not customer cases.",
      ),
    ).toBeInTheDocument();
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "landing_viewed",
        path: "/examples",
        metadata: { sourcePage: "examples" },
      }),
    );
  });

  it("shows the same source material in Chinese without English claims", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await ExamplesPage());

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "三件服装，三套可追溯素材",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("合成输入会明确标注并保留来源记录，不是客户案例。"))
      .toBeInTheDocument();
    expect(
      screen.queryByText(
        "Synthetic inputs are labeled and traceable. They are not customer cases.",
      ),
    ).not.toBeInTheDocument();
    expect(mocks.recordFunnelEventSafely).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/zh/examples" }),
    );
  });
});
