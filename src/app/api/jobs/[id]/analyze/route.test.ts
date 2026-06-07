import { describe, expect, it } from "vitest";

import { handleAnalyzeJobRequest } from "./route";

describe("POST /api/jobs/[id]/analyze", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", { method: "POST" }),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
        analyzeJob: async () => {
          throw new Error("must not analyze");
        },
      },
    );

    expect(response.status).toBe(401);
  });

  it("runs analysis for the authenticated user's job", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", {
        method: "POST",
        body: JSON.stringify({ mode: "standard", isTrial: false }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        analyzeJob: async (input) => ({
          jobId: input.jobId,
          userId: input.userId,
          availableTemplateIds: ["front_push_in"],
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      jobId: "job-1",
      availableTemplateIds: ["front_push_in"],
    });
  });

  it("returns 404 when the job does not belong to the user", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", { method: "POST" }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        analyzeJob: async () => {
          throw new Error("Video job not found for user.");
        },
      },
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
