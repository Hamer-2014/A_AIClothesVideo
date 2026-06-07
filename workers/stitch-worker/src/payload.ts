export interface StitchPayload {
  stitchJobId: string;
  videoJobId: string;
  segmentKeys: string[];
  finalVideoKey: string;
  coverKey: string | null;
  frameKeyPrefix: string | null;
  callbackUrl: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseStitchPayload(input: unknown): StitchPayload {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const segmentKeys = Array.isArray(record.segmentKeys)
    ? record.segmentKeys
        .map((key) => stringValue(key))
        .filter((key) => key.length > 0)
    : [];

  const payload: StitchPayload = {
    stitchJobId: stringValue(record.stitchJobId),
    videoJobId: stringValue(record.videoJobId),
    segmentKeys,
    finalVideoKey: stringValue(record.finalVideoKey),
    coverKey: stringValue(record.coverKey) || null,
    frameKeyPrefix: stringValue(record.frameKeyPrefix) || null,
    callbackUrl: stringValue(record.callbackUrl),
  };

  if (
    !payload.stitchJobId ||
    !payload.videoJobId ||
    payload.segmentKeys.length === 0 ||
    !payload.finalVideoKey ||
    !payload.callbackUrl
  ) {
    throw new Error("invalid_stitch_payload");
  }

  return payload;
}
