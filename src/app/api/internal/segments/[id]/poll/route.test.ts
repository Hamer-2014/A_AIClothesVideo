import { describe, expect, it } from "vitest";

import { handlePollSegmentRequest } from "./route";

describe("POST /api/internal/segments/[id]/poll", () => {
  it("requires the internal worker secret", async () => {
    const response = await handlePollSegmentRequest(
      new Request("http://localhost/api/internal/segments/segment-1/poll", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      { params: { id: "segment-1" } },
      {
        expectedSecret: "secret",
      },
    );

    expect(response.status).toBe(401);
  });

  it("polls a submitted segment when authorized", async () => {
    const response = await handlePollSegmentRequest(
      new Request("http://localhost/api/internal/segments/segment-1/poll", {
        method: "POST",
        headers: { "x-worker-secret": "secret" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      { params: { id: "segment-1" } },
      {
        expectedSecret: "secret",
        pollSegment: async (input) => ({
          jobId: input.jobId,
          segmentId: input.segmentId,
          status: "succeeded",
          videoKey: "jobs/job-1/segments/segment-1/video.mp4",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      segmentId: "segment-1",
      status: "succeeded",
      videoKey: "jobs/job-1/segments/segment-1/video.mp4",
    });
  });
});
