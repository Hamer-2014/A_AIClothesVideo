// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
