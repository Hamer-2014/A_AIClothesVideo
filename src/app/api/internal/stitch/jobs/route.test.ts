import { describe, expect, it } from "vitest";

import { handleCreateStitchJobRequest } from "./route";

describe("POST /api/internal/stitch/jobs", () => {
  it("requires internal authorization", async () => {
    const response = await handleCreateStitchJobRequest(
      new Request("http://localhost/api/internal/stitch/jobs", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        expectedSecret: "secret",
      },
    );

    expect(response.status).toBe(401);
  });

  it("creates a stitch job when authorized", async () => {
    const response = await handleCreateStitchJobRequest(
      new Request("http://localhost/api/internal/stitch/jobs", {
        method: "POST",
        headers: { Authorization: "Bearer secret" },
        body: JSON.stringify({ jobId: "job-1" }),
      }),
      {
        expectedSecret: "secret",
        createStitchJob: async (input) => ({
          jobId: input.jobId,
          stitchJobId: "stitch-1",
          status: "queued",
          segmentCount: 2,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      stitchJobId: "stitch-1",
      status: "queued",
      segmentCount: 2,
    });
  });
});
