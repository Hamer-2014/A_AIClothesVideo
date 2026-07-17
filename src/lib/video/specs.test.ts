import { describe, expect, it } from "vitest";

import {
  getVideoSpec,
  isVideoDuration,
  isVideoDurationEnabled,
} from "./specs";

describe("video specs", () => {
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
  });

  it("accepts exactly the supported durations", () => {
    expect([8, 16, 24, 40].every(isVideoDuration)).toBe(true);
    expect(isVideoDuration(32)).toBe(false);
  });
});
