import { describe, expect, it } from "vitest";

import { triggerCloudRunStitchJob } from "./trigger-cloud-run";

describe("triggerCloudRunStitchJob", () => {
  it("posts the stitch job payload to Cloud Run with the shared worker secret", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    const result = await triggerCloudRunStitchJob({
      cloudRunUrl: "https://stitch-worker.example.run.app/",
      workerSecret: "secret",
      payload: {
        stitchJobId: "stitch-1",
        videoJobId: "job-1",
        segmentKeys: ["jobs/job-1/segments/segment-1/video.mp4"],
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: "jobs/job-1/covers/cover.webp",
        frameKeyPrefix: "jobs/job-1/qa/frames",
        postQaMode: "standard",
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      },
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ accepted: true });
      },
    });

    expect(result).toEqual({ accepted: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://stitch-worker.example.run.app/stitch");
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers).toEqual({
      "content-type": "application/json",
      "x-worker-secret": "secret",
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      stitchJobId: "stitch-1",
      videoJobId: "job-1",
    });
  });

  it("fails closed when Cloud Run returns an error response", async () => {
    await expect(
      triggerCloudRunStitchJob({
        cloudRunUrl: "https://stitch-worker.example.run.app",
        workerSecret: "secret",
        payload: {
          stitchJobId: "stitch-1",
          videoJobId: "job-1",
          segmentKeys: [],
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          postQaMode: "lite",
          callbackUrl: "https://app.example.com/api/internal/stitch/callback",
        },
        fetch: async () =>
          Response.json({ error: "invalid_stitch_payload" }, { status: 400 }),
      }),
    ).rejects.toThrow("Cloud Run stitch trigger failed with status 400.");
  });
});
