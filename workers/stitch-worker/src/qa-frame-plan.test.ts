import { describe, expect, it } from "vitest";

import { buildQaFramePlan } from "./qa-frame-plan.js";

describe("buildQaFramePlan", () => {
  it("builds 24 Standard points for five segments", () => {
    const plan = buildQaFramePlan("standard", 5);

    expect(plan).toHaveLength(24);
    expect(plan.filter((point) => point.kind === "transition")).toHaveLength(4);
  });

  it("builds 34 Strict points for five segments", () => {
    expect(buildQaFramePlan("strict", 5)).toHaveLength(34);
  });

  it("keeps Lite at three points for the one-segment trial", () => {
    expect(buildQaFramePlan("lite", 1)).toHaveLength(3);
  });

  it("preserves legacy total frame counts for 8/16/24 seconds", () => {
    expect(buildQaFramePlan("standard", 1)).toHaveLength(5);
    expect(buildQaFramePlan("standard", 3)).toHaveLength(5);
    expect(buildQaFramePlan("strict", 3)).toHaveLength(6);
  });
});
