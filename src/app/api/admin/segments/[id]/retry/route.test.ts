import { describe, expect, it } from "vitest";

import { handleRetrySegmentRequest } from "./route";

describe("POST /api/admin/segments/[id]/retry", () => {
  it("requires admin access", async () => {
    const response = await handleRetrySegmentRequest(
      new Request("http://localhost/api/admin/segments/segment-1/retry", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", reason: "retry" }),
      }),
      { params: { id: "segment-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("retries segment for admins/operators", async () => {
    const response = await handleRetrySegmentRequest(
      new Request("http://localhost/api/admin/segments/segment-1/retry", {
        method: "POST",
        body: JSON.stringify({ jobId: "job-1", reason: "retry" }),
      }),
      { params: { id: "segment-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        retrySegment: async (input) => ({
          jobId: input.jobId,
          segmentId: input.segmentId,
          status: "queued",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      segmentId: "segment-1",
      status: "queued",
    });
  });
});
