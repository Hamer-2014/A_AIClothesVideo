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

  it("keeps the legacy segment frames and adds every boundary for Standard multi-segment videos", () => {
    expect(buildQaFramePlan("standard", 1)).toHaveLength(5);
    const plan = buildQaFramePlan("standard", 3);

    expect(plan).toHaveLength(7);
    expect(plan.filter((point) => point.kind === "segment")).toHaveLength(5);
    expect(plan.filter((point) => point.kind === "transition")).toEqual([
      expect.objectContaining({ timestampSeconds: 8, segmentIndex: 0 }),
      expect.objectContaining({ timestampSeconds: 16, segmentIndex: 1 }),
    ]);
  });

  it("adds every boundary to Strict 24-second and 32-second videos", () => {
    const strict24 = buildQaFramePlan("strict", 3);
    const standard = buildQaFramePlan("standard", 4);
    const strict = buildQaFramePlan("strict", 4);

    expect(strict24).toHaveLength(8);
    expect(strict24.filter((point) => point.kind === "transition")).toHaveLength(2);
    expect(standard).toHaveLength(8);
    expect(strict).toHaveLength(9);
    expect(standard.filter((point) => point.kind === "transition")).toHaveLength(3);
    expect(strict.filter((point) => point.kind === "transition")).toHaveLength(3);
  });

  it("keeps Lite at three non-transition points for multi-segment videos", () => {
    const plan = buildQaFramePlan("lite", 3);

    expect(plan).toHaveLength(3);
    expect(plan.every((point) => point.kind === "segment")).toBe(true);
  });
});
