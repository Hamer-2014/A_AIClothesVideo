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
  SignOutButton: () => <button type="button">Sign out</button>,
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

    expect(screen.getByText("40-second Beta")).toBeInTheDocument();
    expect(screen.getByText("310 credits · 5 segments")).toBeInTheDocument();
  });

  it("explains public trial, packages, duration credit costs, and failed generation credit handling", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    render(await PricingPage());

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("$9.99")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getAllByText("Free trial").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Credits are reserved before generation/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/only captured after quality checks pass/).length).toBeGreaterThan(0);
    expect(screen.getByText("About one 8-second video")).toBeInTheDocument();
    expect(screen.getByText("About two 16-second videos")).toBeInTheDocument();
    expect(screen.getByText("About five 24-second videos")).toBeInTheDocument();
    expect(screen.getByText(/Estimates are based on current credit costs/)).toBeInTheDocument();
    expect(screen.getAllByText(/8 seconds/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/16 seconds/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24 seconds/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Free trial/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: "Create one free trial video" }),
    ).toHaveAttribute("href", "/workspace?mode=trial&preset=minimal_studio");
    expect(screen.getByText(/will be released or returned/)).toBeInTheDocument();
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
    vi.stubEnv("CREEM_PURCHASES_ENABLED", "true");
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "merchant@example.com" },
    });

    render(await PricingPage());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Go to workspace" })[0]).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Free trial" }),
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
    expect(screen.getByRole("button", { name: "Buy Starter" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Buy Creator" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Buy Studio" })).toBeEnabled();
  });

  it("preserves package selection when anonymous users sign in to buy", async () => {
    vi.stubEnv("CREEM_PURCHASES_ENABLED", "true");
    mocks.getServerSession.mockResolvedValue(null);

    render(await PricingPage());

    expect(
      screen.getByRole("link", { name: "Sign in to buy Starter" }),
    ).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/pricing?package=starter#credit-packs")}`,
    );
    expect(
      screen.getByRole("link", { name: "Sign in to buy Creator" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sign in to buy Studio" }),
    ).toBeInTheDocument();
  });
});
