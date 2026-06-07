import { describe, expect, it } from "vitest";

import { handleRequest } from "./http";

describe("stitch-worker HTTP handler", () => {
  const config = {
    workerSecret: "secret",
    bucket: "bucket",
    r2Endpoint: "https://account.r2.cloudflarestorage.com",
    r2AccessKeyId: "access",
    r2SecretAccessKey: "private",
  };

  it("serves health checks without a worker secret", async () => {
    const response = await handleRequest(new Request("http://worker/health"), {
      config,
      stitch: async () => {
        throw new Error("health must not stitch");
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects stitch requests without the shared secret", async () => {
    const response = await handleRequest(
      new Request("http://worker/stitch", {
        method: "POST",
        body: JSON.stringify({ stitchJobId: "stitch-1" }),
      }),
      {
        config,
        stitch: async () => {
          throw new Error("unauthorized request must not stitch");
        },
      },
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });

  it("runs a stitch job and returns uploaded output keys", async () => {
    const response = await handleRequest(
      new Request("http://worker/stitch", {
        method: "POST",
        headers: { "x-worker-secret": "secret" },
        body: JSON.stringify({
          stitchJobId: "stitch-1",
          videoJobId: "job-1",
          segmentKeys: ["jobs/job-1/segments/segment-1/video.mp4"],
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          frameKeyPrefix: "jobs/job-1/qa/frames",
          callbackUrl: "https://app.example.com/api/internal/stitch/callback",
        }),
      }),
      {
        config,
        stitch: async (input) => ({
          stitchJobId: input.stitchJobId,
          status: "succeeded",
          finalVideoKey: input.finalVideoKey,
          coverKey: input.coverKey,
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      stitchJobId: "stitch-1",
      status: "succeeded",
      finalVideoKey: "jobs/job-1/stitched/final.mp4",
      coverKey: "jobs/job-1/covers/cover.webp",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
    });
  });
});
