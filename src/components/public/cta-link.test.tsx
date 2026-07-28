// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrialCtaLink, WorkspaceCtaLink } from "./cta-link";

const analyticsMocks = vi.hoisted(() => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: analyticsMocks.trackFunnelEvent,
}));

describe("TrialCtaLink", () => {
  it("tracks trial CTA clicks without changing the destination", () => {
    render(
      <TrialCtaLink ctaPosition="hero" sourcePage="homepage">
        免费试用
      </TrialCtaLink>,
    );

    const link = screen.getByRole("link", { name: "免费试用" });
    fireEvent.click(link);

    expect(link).toHaveAttribute(
      "href",
      "/workspace?mode=trial&preset=minimal_studio",
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "trial_cta_clicked",
      {
        sourcePage: "homepage",
        ctaPosition: "hero",
        userState: "anonymous",
        presetId: "minimal_studio",
        mode: "trial",
      },
    );
  });

  it("tracks signed-in workspace CTA source and position", () => {
    render(
      <WorkspaceCtaLink ctaPosition="final" sourcePage="three_images_landing">
        进入工作台
      </WorkspaceCtaLink>,
    );

    fireEvent.click(screen.getByRole("link", { name: "进入工作台" }));

    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "workspace_cta_clicked",
      {
        sourcePage: "three_images_landing",
        ctaPosition: "final",
        userState: "authenticated",
      },
    );
  });
});
