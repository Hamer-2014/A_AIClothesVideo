import { describe, expect, it } from "vitest";

import {
  buildPostQaFrameBatches,
  parseQaFrameLocation,
} from "./frame-batches";

const strictFrameKeys = [
  ...Array.from({ length: 5 }, (_, segmentIndex) =>
    Array.from(
      { length: 6 },
      (_, frameIndex) =>
        `jobs/job-1/qa/frames/segment-${segmentIndex}-frame-${frameIndex}.jpg`,
    ),
  ).flat(),
  ...Array.from(
    { length: 4 },
    (_, fromIndex) =>
      `jobs/job-1/qa/frames/transition-${fromIndex}-${fromIndex + 1}.jpg`,
  ),
];

describe("post QA frame batches", () => {
  it("parses segment and transition locations from anchored filenames", () => {
    expect(
      parseQaFrameLocation(
        "jobs/job-1/qa/frames/segment-3-frame-2.jpg",
      ),
    ).toEqual({ kind: "segment", segmentIndex: 3, frameIndex: 2 });
    expect(
      parseQaFrameLocation(
        "jobs/job-1/qa/frames/transition-2-3.jpg",
      ),
    ).toEqual({
      kind: "transition",
      fromSegmentIndex: 2,
      toSegmentIndex: 3,
    });
    expect(
      parseQaFrameLocation("jobs/job-1/qa/frames/xsegment-3-frame-2.jpg"),
    ).toEqual({ kind: "unknown" });
  });

  it("builds five bounded segment batches plus one transition batch", () => {
    const batches = buildPostQaFrameBatches(strictFrameKeys);

    expect(batches).toHaveLength(6);
    expect(batches.filter((batch) => batch.kind === "segment")).toHaveLength(5);
    expect(
      batches.find((batch) => batch.kind === "transition")?.frameKeys,
    ).toHaveLength(4);
    expect(Math.max(...batches.map((batch) => batch.frameKeys.length))).toBe(6);
  });

  it("keeps existing durations in one provider batch", () => {
    const batch = buildPostQaFrameBatches([
      "jobs/job-2/qa/frames/segment-0-frame-0.jpg",
      "jobs/job-2/qa/frames/segment-0-frame-1.jpg",
      "jobs/job-2/qa/frames/segment-1-frame-2.jpg",
      "jobs/job-2/qa/frames/segment-1-frame-3.jpg",
      "jobs/job-2/qa/frames/segment-2-frame-4.jpg",
    ]);

    expect(batch).toHaveLength(1);
    expect(batch[0]?.kind).toBe("legacy");
  });
});
