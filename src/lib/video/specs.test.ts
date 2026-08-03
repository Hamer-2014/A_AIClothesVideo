import { describe, expect, it } from "vitest";

import {
  getVideoSpec,
  isVideoDuration,
  isVideoDurationEnabled,
} from "./specs";

describe("video specs", () => {
  it("defines the active 32-second paid specification", () => {
    expect(getVideoSpec(32)).toMatchObject({
      durationSeconds: 32,
      segmentCount: 4,
      creditCost: 250,
      trialAllowed: false,
      releaseStage: "active",
      paidPostQaMode: "standard",
    });
  });

  it("defines the 40-second paid Beta", () => {
    expect(getVideoSpec(40)).toMatchObject({
      durationSeconds: 40,
      segmentCount: 5,
      creditCost: 310,
      trialAllowed: false,
      releaseStage: "beta",
    });
  });

  it("gates only new 40-second jobs behind the environment switch", () => {
    expect(isVideoDurationEnabled(40, {})).toBe(false);
    expect(
      isVideoDurationEnabled(40, { VIDEO_DURATION_40_ENABLED: "true" }),
    ).toBe(true);
    expect(isVideoDurationEnabled(24, {})).toBe(true);
    expect(isVideoDurationEnabled(32, {})).toBe(true);
  });

  it("accepts exactly the supported durations", () => {
    expect([8, 16, 24, 32, 40].every(isVideoDuration)).toBe(true);
    expect(isVideoDuration(12)).toBe(false);
  });
});
