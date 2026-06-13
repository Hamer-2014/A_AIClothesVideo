import { afterEach, describe, expect, it, vi } from "vitest";

import { handleAnalyzeJobRequest } from "./route";

describe("POST /api/jobs/[id]/analyze", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("surfaces the failure reason for unexpected analysis errors", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", { method: "POST" }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        analyzeJob: async () => {
          throw new Error("Vision provider response is missing JSON content.");
        },
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "asset_analysis_failed",
      message: "Vision provider response is missing JSON content.",
    });
  });

  it("returns a retryable message for vision network failures", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", { method: "POST" }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        analyzeJob: async () => {
          throw new Error("fetch failed");
        },
      },
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "asset_analysis_failed",
      message: "素材分析服务网络连接失败，请稍后重试。",
    });
  });

  it("treats duplicate analysis requests after a passed analysis as idempotent", async () => {
    const response = await handleAnalyzeJobRequest(
      new Request("http://localhost/api/jobs/job-1/analyze", { method: "POST" }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        analyzeJob: async () => {
          throw new Error(
            "Invalid job status transition: asset_analysis_passed -> asset_analysis_running.",
          );
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      availableTemplateIds: [],
      alreadyAnalyzed: true,
    });
  });
});
