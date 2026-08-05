import { describe, expect, it } from "vitest";

import { handleReopenPostQaRequest } from "./route";

describe("POST /api/admin/jobs/[id]/reopen-post-qa", () => {
  it("requires admin access", async () => {
    const response = await handleReopenPostQaRequest(
      new Request("http://localhost/api/admin/jobs/job-1/reopen-post-qa", {
        method: "POST",
        body: JSON.stringify({ reason: "retry fixed QA schema" }),
      }),
      { params: { id: "job-1" } },
      { getAdminSession: async () => null },
    );

    expect(response.status).toBe(403);
  });

  it("reopens post-QA for admins/operators", async () => {
    const response = await handleReopenPostQaRequest(
      new Request("http://localhost/api/admin/jobs/job-1/reopen-post-qa", {
        method: "POST",
        body: JSON.stringify({ reason: "retry fixed QA schema" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        reopenPostQa: async (input) => ({
          jobId: input.jobId,
          status: "post_qa_queued",
          stitchJobId: "stitch-1",
          frameCount: 3,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      status: "post_qa_queued",
      stitchJobId: "stitch-1",
      frameCount: 3,
    });
  });

  it("rejects missing, whitespace-only, and short reasons", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleReopenPostQaRequest(
        new Request("http://localhost/api/admin/jobs/job-1/reopen-post-qa", {
          method: "POST",
          body: JSON.stringify({ reason }),
        }),
        { params: { id: "job-1" } },
        {
          getAdminSession: async () => ({
            userId: "operator-1",
            email: "operator@example.com",
            role: "operator",
          }),
        },
      );

      expect(response.status).toBe(400);
    }
  });

  it("returns a conflict when the user cannot fund a paid reopen", async () => {
    const response = await handleReopenPostQaRequest(
      new Request("http://localhost/api/admin/jobs/job-1/reopen-post-qa", {
        method: "POST",
        body: JSON.stringify({ reason: "retry after provider recovery" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        reopenPostQa: async () => {
          throw new Error("Insufficient available credits.");
        },
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "insufficient_credits",
    });
  });

  it("returns a conflict while Post-QA failure settlement is still running", async () => {
    const response = await handleReopenPostQaRequest(
      new Request("http://localhost/api/admin/jobs/job-1/reopen-post-qa", {
        method: "POST",
        body: JSON.stringify({ reason: "retry after provider recovery" }),
      }),
      { params: { id: "job-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "operator@example.com",
          role: "operator",
        }),
        reopenPostQa: async () => {
          throw new Error("Video job is not settled after Post-QA failure.");
        },
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "post_qa_not_settled" });
  });
});
