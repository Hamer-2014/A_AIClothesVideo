// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SampleVideo } from "./sample-video";

const analyticsMocks = vi.hoisted(() => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: analyticsMocks.trackFunnelEvent,
}));

describe("SampleVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("tracks play start and the 50 percent milestone once", () => {
    render(<SampleVideo controls sourcePage="three_images_landing" testId="sample" />);
    const video = screen.getByTestId("sample") as HTMLVideoElement;

    fireEvent.play(video);
    Object.defineProperty(video, "duration", { configurable: true, value: 8 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 4.2 });
    fireEvent.timeUpdate(video);
    fireEvent.timeUpdate(video);

    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "sample_video_play_started",
      { sourcePage: "three_images_landing", milestone: "started" },
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "sample_video_played_50",
      { sourcePage: "three_images_landing", milestone: "50_percent" },
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledTimes(2);
  });

  it("does not count hero autoplay as sample engagement", () => {
    render(<SampleVideo autoPlay sourcePage="homepage" testId="hero" />);
    const video = screen.getByTestId("hero") as HTMLVideoElement;

    fireEvent.play(video);
    Object.defineProperty(video, "duration", { configurable: true, value: 8 });
    Object.defineProperty(video, "currentTime", { configurable: true, value: 5 });
    fireEvent.timeUpdate(video);

    expect(analyticsMocks.trackFunnelEvent).not.toHaveBeenCalled();
  });

  it("exposes an accessible label for a meaningful result video", () => {
    render(
      <SampleVideo
        ariaLabel="Generated adult burgundy midi dress product video"
        controls
        sourcePage="homepage"
      />,
    );

    expect(screen.getByLabelText("Generated adult burgundy midi dress product video"))
      .toHaveAttribute(
        "src",
        "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s.mp4",
      );
    expect(screen.getByLabelText("Generated adult burgundy midi dress product video"))
      .toHaveAttribute(
        "poster",
        "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s-poster.webp",
      );
  });

  it("renders accepted case media when custom paths are provided", () => {
    render(
      <SampleVideo
        controls
        poster="/demo/cases/structured-blazer/minimal-studio-poster.webp"
        sourcePage="examples"
        src="/demo/cases/structured-blazer/minimal-studio.mp4"
        testId="case-video"
      />,
    );

    expect(screen.getByTestId("case-video"))
      .toHaveAttribute(
        "src",
        "/demo/cases/structured-blazer/minimal-studio.mp4",
      );
    expect(screen.getByTestId("case-video"))
      .toHaveAttribute(
        "poster",
        "/demo/cases/structured-blazer/minimal-studio-poster.webp",
      );
  });

  it("pauses autoplay media when reduced motion is requested", () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({ matches: true }),
    );

    render(<SampleVideo autoPlay sourcePage="homepage" testId="hero" />);

    expect(pause).toHaveBeenCalledTimes(1);
  });
});
