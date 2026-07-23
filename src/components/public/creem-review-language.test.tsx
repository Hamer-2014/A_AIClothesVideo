// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AcceptableUsePage from "@/app/acceptable-use/page";
import Home from "@/app/page";
import PricingPage from "@/app/pricing/page";
import PrivacyPage from "@/app/privacy/page";
import TakedownPage from "@/app/takedown/page";
import TermsPage from "@/app/terms/page";

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

const cjkPattern = /[\u3400-\u9fff]/;

describe("Creem review public English surface", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    ["/", Home],
    ["/pricing", PricingPage],
    ["/privacy", PrivacyPage],
    ["/terms", TermsPage],
    ["/acceptable-use", AcceptableUsePage],
    ["/takedown", TakedownPage],
  ])("renders %s without user-visible CJK text", async (_path, Page) => {
    mocks.getServerSession.mockResolvedValue(null);

    const { container } = render(await Page());

    expect(container.textContent).not.toMatch(cjkPattern);
  });
});
