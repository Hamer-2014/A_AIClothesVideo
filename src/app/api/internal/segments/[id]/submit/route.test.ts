import { describe, expect, it } from "vitest";

import { handleSubmitSegmentRequest } from "./route";

describe("POST /api/internal/segments/[id]/submit", () => {
  it("requires the internal worker secret", async () => {
    const response = await handleSubmitSegmentRequest(
      new Request("http://localhost/api/internal/segments/segment-1/submit", {
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

  it("submits a segment when authorized", async () => {
    const response = await handleSubmitSegmentRequest(
      new Request("http://localhost/api/internal/segments/segment-1/submit", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      { params: { id: "segment-1" } },
      {
        expectedSecret: "secret",
        submitSegment: async (input) => ({
          jobId: input.jobId,
          segmentId: input.segmentId,
          status: "generating",
          providerTaskId: "task-1",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      segmentId: "segment-1",
      status: "generating",
      providerTaskId: "task-1",
    });
  });
});
