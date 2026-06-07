import { describe, expect, it } from "vitest";

import {
  buildAssetOriginalKey,
  buildAssetThumbKey,
  buildCoverKey,
  buildFinalVideoKey,
  buildQaFrameKey,
  buildSegmentVideoKey,
} from "./keys";

describe("R2 object keys", () => {
  it("generates stable user asset keys without a leading slash", () => {
    expect(buildAssetOriginalKey("user-1", "asset-1", "image/jpeg")).toBe(
      "users/user-1/assets/asset-1/original.jpg",
    );
    expect(buildAssetThumbKey("user-1", "asset-1")).toBe(
      "users/user-1/assets/asset-1/thumb.webp",
    );
  });

  it("generates stable job artifact keys", () => {
    expect(buildSegmentVideoKey("job-1", "segment-1")).toBe(
      "jobs/job-1/segments/segment-1/video.mp4",
    );
    expect(buildFinalVideoKey("job-1")).toBe("jobs/job-1/stitched/final.mp4");
    expect(buildQaFrameKey("job-1", 3)).toBe("jobs/job-1/qa/frames/3.jpg");
    expect(buildCoverKey("job-1")).toBe("jobs/job-1/covers/cover.webp");
  });
});
