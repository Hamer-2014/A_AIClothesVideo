// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrialCtaLink } from "./cta-link";

const analyticsMocks = vi.hoisted(() => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: analyticsMocks.trackFunnelEvent,
}));

describe("TrialCtaLink", () => {
  it("tracks trial CTA clicks without changing the destination", () => {
    render(<TrialCtaLink sourcePage="landing">免费试用</TrialCtaLink>);

    const link = screen.getByRole("link", { name: "免费试用" });
    fireEvent.click(link);

    expect(link).toHaveAttribute(
      "href",
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio",
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "trial_cta_clicked",
      {
        sourcePage: "landing",
        presetId: "minimal_studio",
        mode: "trial",
      },
    );
  });
});
