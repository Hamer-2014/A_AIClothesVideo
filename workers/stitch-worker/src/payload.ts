export interface StitchPayload {
  stitchJobId: string;
  videoJobId: string;
  segmentKeys: string[];
  finalVideoKey: string;
  coverKey: string | null;
  frameKeyPrefix: string | null;
  postQaMode: "off" | "lite" | "standard" | "strict";
  expectedAspectRatio?: "9:16" | "1:1" | "16:9" | null;
  minimumShortSide?: number | null;
  callbackUrl: string;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function postQaModeValue(value: unknown): StitchPayload["postQaMode"] {
  const normalized = stringValue(value);
  return normalized === "off" ||
    normalized === "standard" ||
    normalized === "strict" ||
    normalized === "lite"
    ? normalized
    : "lite";
}

function aspectRatioValue(value: unknown): StitchPayload["expectedAspectRatio"] {
  const normalized = stringValue(value);
  if (!normalized) return null;
  return normalized === "9:16" || normalized === "1:1" || normalized === "16:9"
    ? normalized
    : undefined;
}

function positiveIntegerValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : undefined;
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
    postQaMode: postQaModeValue(record.postQaMode),
    expectedAspectRatio: aspectRatioValue(record.expectedAspectRatio) ?? null,
    minimumShortSide: positiveIntegerValue(record.minimumShortSide) ?? null,
    callbackUrl: stringValue(record.callbackUrl),
  };

  if (
    !payload.stitchJobId ||
    !payload.videoJobId ||
    payload.segmentKeys.length === 0 ||
    !payload.finalVideoKey ||
    !payload.callbackUrl ||
    aspectRatioValue(record.expectedAspectRatio) === undefined ||
    positiveIntegerValue(record.minimumShortSide) === undefined
  ) {
    throw new Error("invalid_stitch_payload");
  }

  return payload;
}
