export type QaFrameLocation =
  | { kind: "segment"; segmentIndex: number; frameIndex: number }
  | {
      kind: "transition";
      fromSegmentIndex: number;
      toSegmentIndex: number;
    }
  | { kind: "unknown" };

export type PostQaFrameBatch = {
  batchId: string;
  kind: "segment" | "transition" | "legacy";
  segmentIndex: number | null;
  frameKeys: string[];
  frameLocations: QaFrameLocation[];
};

export function parseQaFrameLocation(frameKey: string): QaFrameLocation {
  const fileName = frameKey.split("/").at(-1) ?? "";
  const segmentMatch = fileName.match(/^segment-(\d+)-frame-(\d+)\.jpg$/);
  if (segmentMatch) {
    return {
      kind: "segment",
      segmentIndex: Number(segmentMatch[1]),
      frameIndex: Number(segmentMatch[2]),
    };
  }

  const transitionMatch = fileName.match(/^transition-(\d+)-(\d+)\.jpg$/);
  if (transitionMatch) {
    return {
      kind: "transition",
      fromSegmentIndex: Number(transitionMatch[1]),
      toSegmentIndex: Number(transitionMatch[2]),
    };
  }

  return { kind: "unknown" };
}

export function buildPostQaFrameBatches(
  frameKeys: string[],
): PostQaFrameBatch[] {
  const entries = frameKeys.map((frameKey) => ({
    frameKey,
    location: parseQaFrameLocation(frameKey),
  }));
  const isFortySecondPlan = frameKeys.length === 24 || frameKeys.length === 34;

  if (!isFortySecondPlan) {
    const segmentIndexes = entries.flatMap(({ location }) =>
      location.kind === "segment" ? [location.segmentIndex] : [],
    );
    const uniqueSegmentIndexes = [...new Set(segmentIndexes)];
    const isSingleSegment =
      entries.length > 0 &&
      uniqueSegmentIndexes.length === 1 &&
      entries.every(({ location }) => location.kind === "segment");
    return [
      {
        batchId: isSingleSegment
          ? `segment-${uniqueSegmentIndexes[0]}`
          : "legacy",
        kind: isSingleSegment ? "segment" : "legacy",
        segmentIndex: isSingleSegment ? uniqueSegmentIndexes[0] ?? null : null,
        frameKeys: [...frameKeys],
        frameLocations: entries.map(({ location }) => location),
      },
    ];
  }

  const segmentIndexes = [
    ...new Set(
      entries.flatMap(({ location }) =>
        location.kind === "segment" ? [location.segmentIndex] : [],
      ),
    ),
  ].sort((left, right) => left - right);

  const batches: PostQaFrameBatch[] = segmentIndexes.map((segmentIndex) => {
    const segmentEntries = entries.filter(
      ({ location }) =>
        location.kind === "segment" &&
        location.segmentIndex === segmentIndex,
    );
    return {
      batchId: `segment-${segmentIndex}`,
      kind: "segment",
      segmentIndex,
      frameKeys: segmentEntries.map(({ frameKey }) => frameKey),
      frameLocations: segmentEntries.map(({ location }) => location),
    };
  });
  const transitionEntries = entries.filter(
    ({ location }) => location.kind === "transition",
  );
  if (transitionEntries.length > 0) {
    batches.push({
      batchId: "transitions",
      kind: "transition",
      segmentIndex: null,
      frameKeys: transitionEntries.map(({ frameKey }) => frameKey),
      frameLocations: transitionEntries.map(({ location }) => location),
    });
  }

  return batches;
}
