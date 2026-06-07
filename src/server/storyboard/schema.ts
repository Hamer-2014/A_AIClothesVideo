import type { JsonValue } from "@/lib/db/schema/common";

export interface StoryboardSegment {
  index: number;
  durationSeconds: number;
  templateId: string;
  prompt: string;
}

export interface ParsedStoryboard {
  durationSeconds: number;
  segments: StoryboardSegment[];
  raw: JsonValue;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function requiredNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Storyboard JSON is missing required field: ${field}.`);
  }

  return value;
}

function requiredString(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Storyboard JSON is missing required field: ${field}.`);
  }

  return value;
}

function expectedSegmentsForDuration(durationSeconds: number) {
  switch (durationSeconds) {
    case 8:
      return 1;
    case 16:
      return 2;
    case 24:
      return 3;
    default:
      throw new Error("Storyboard duration must be 8, 16, or 24 seconds.");
  }
}

export function parseStoryboardJson(
  input: unknown,
  {
    durationSeconds,
    allowedTemplateIds,
  }: {
    durationSeconds: number;
    allowedTemplateIds: string[];
  },
): ParsedStoryboard {
  const record = asRecord(input);
  const storyboardDuration = requiredNumber(record, "duration_seconds");

  if (storyboardDuration !== durationSeconds) {
    throw new Error("Storyboard duration does not match job duration.");
  }

  if (!Array.isArray(record.segments)) {
    throw new Error("Storyboard JSON is missing required field: segments.");
  }

  const expectedSegmentCount = expectedSegmentsForDuration(durationSeconds);
  if (record.segments.length !== expectedSegmentCount) {
    throw new Error("Storyboard segment count does not match duration.");
  }

  const allowed = new Set(allowedTemplateIds);
  const segments = record.segments.map((segmentInput, expectedIndex) => {
    const segment = asRecord(segmentInput);
    const index = requiredNumber(segment, "index");
    const segmentDuration = requiredNumber(segment, "duration_seconds");
    const templateId = requiredString(segment, "template_id");
    const prompt = requiredString(segment, "prompt");

    if (index !== expectedIndex) {
      throw new Error("Storyboard segment index is out of order.");
    }

    if (segmentDuration !== 8) {
      throw new Error("Storyboard segments must be 8 seconds each.");
    }

    if (!allowed.has(templateId)) {
      throw new Error(`Storyboard contains unavailable template: ${templateId}.`);
    }

    return {
      index,
      durationSeconds: segmentDuration,
      templateId,
      prompt,
    };
  });

  return {
    durationSeconds: storyboardDuration,
    segments,
    raw: input as JsonValue,
  };
}
