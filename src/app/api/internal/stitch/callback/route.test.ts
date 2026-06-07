import { describe, expect, it } from "vitest";

import { handleStitchCallbackRequest } from "./route";

describe("POST /api/internal/stitch/callback", () => {
  it("requires internal authorization", async () => {
    const response = await handleStitchCallbackRequest(
      new Request("http://localhost/api/internal/stitch/callback", {
        method: "POST",
        body: JSON.stringify({ stitchJobId: "stitch-1", status: "succeeded" }),
      }),
      {
        expectedSecret: "secret",
      },
    );

    expect(response.status).toBe(401);
  });

  it("accepts Cloud Run stitch success callbacks", async () => {
    const response = await handleStitchCallbackRequest(
      new Request("http://localhost/api/internal/stitch/callback", {
        method: "POST",
        headers: { "x-worker-secret": "secret" },
        body: JSON.stringify({
          stitchJobId: "stitch-1",
          status: "succeeded",
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
        }),
      }),
      {
        expectedSecret: "secret",
        handleCallback: async (input) => ({
          jobId: "job-1",
          stitchJobId: input.stitchJobId,
          status: "post_qa_queued",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      stitchJobId: "stitch-1",
      status: "post_qa_queued",
    });
  });
});
