import { describe, expect, it } from "vitest";

import { parseStitchPayload } from "./payload.js";

describe("parseStitchPayload", () => {
  it("normalizes the Cloud Run stitch request payload", () => {
    expect(
      parseStitchPayload({
        stitchJobId: " stitch-1 ",
        videoJobId: " job-1 ",
        segmentKeys: [" segment-a ", "segment-b"],
        finalVideoKey: " jobs/job-1/stitched/final.mp4 ",
        coverKey: " jobs/job-1/covers/cover.webp ",
        frameKeyPrefix: " jobs/job-1/qa/frames ",
        postQaMode: " standard ",
        expectedAspectRatio: " 9:16 ",
        minimumShortSide: 720,
        callbackUrl: " https://app.example.com/api/internal/stitch/callback ",
      }),
    ).toEqual({
      stitchJobId: "stitch-1",
      videoJobId: "job-1",
      segmentKeys: ["segment-a", "segment-b"],
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeyPrefix: "jobs/job-1/qa/frames",
      postQaMode: "standard",
      expectedAspectRatio: "9:16",
      minimumShortSide: 720,
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
    });
  });

  it("defaults missing or invalid post QA mode to lite", () => {
    expect(
      parseStitchPayload({
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["segment-a"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        postQaMode: "surprise",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      }).postQaMode,
    ).toBe("lite");
  });

  it("keeps new technical quality fields optional for rolling deployments", () => {
    const payload = parseStitchPayload({
      stitchJobId: "stitch-1",
      videoJobId: "job-1",
      segmentKeys: ["segment-a"],
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
    });

    expect(payload.expectedAspectRatio).toBeNull();
    expect(payload.minimumShortSide).toBeNull();
  });

  it("rejects invalid technical quality fields", () => {
    expect(() => parseStitchPayload({
      stitchJobId: "stitch-1",
      videoJobId: "job-1",
      segmentKeys: ["segment-a"],
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      expectedAspectRatio: "2:3",
      minimumShortSide: 0,
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
    })).toThrow("invalid_stitch_payload");
  });

  it("rejects empty segment lists", () => {
    expect(() =>
      parseStitchPayload({
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: [],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      }),
    ).toThrow("invalid_stitch_payload");
  });
});
