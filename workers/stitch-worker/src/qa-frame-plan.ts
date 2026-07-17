import type { StitchPayload } from "./payload.js";

export type QaFramePoint = {
  timestampSeconds: number;
  kind: "segment" | "transition";
  segmentIndex: number;
  frameIndex: number;
};

const fortySecondOffsets = {
  standard: [1.6, 3.2, 4.8, 6.4],
  strict: [1, 2.2, 3.4, 4.6, 5.8, 7],
} as const;

const legacyFrameCount = {
  lite: 3,
  standard: 5,
  strict: 6,
} as const;

export function buildQaFramePlan(
  mode: StitchPayload["postQaMode"],
  segmentCount: number,
): QaFramePoint[] {
  if (mode === "off") return [];

  if (segmentCount !== 5 || mode === "lite") {
    const durationSeconds = segmentCount * 8;
    return Array.from({ length: legacyFrameCount[mode] }, (_, frameIndex) => {
      const timestampSeconds =
        (durationSeconds * (frameIndex + 1)) / (legacyFrameCount[mode] + 1);
      return {
        timestampSeconds,
        kind: "segment" as const,
        segmentIndex: Math.min(
          segmentCount - 1,
          Math.floor(timestampSeconds / 8),
        ),
        frameIndex,
      };
    });
  }

  const points: QaFramePoint[] = [];
  const selectedOffsets = fortySecondOffsets[mode];

  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex += 1) {
    selectedOffsets.forEach((offset, frameIndex) => {
      points.push({
        timestampSeconds: segmentIndex * 8 + offset,
        kind: "segment",
        segmentIndex,
        frameIndex,
      });
    });
    if (segmentIndex < segmentCount - 1) {
      points.push({
        timestampSeconds: (segmentIndex + 1) * 8,
        kind: "transition",
        segmentIndex,
        frameIndex: 0,
      });
    }
  }

  return points;
}
