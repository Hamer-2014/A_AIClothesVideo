import { describe, expect, it } from "vitest";

import { handleConfirmStoryboardRequest } from "./route";

describe("POST /api/jobs/[id]/confirm", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("confirms a storyboard for authenticated users", async () => {
    const kickedJobs: string[] = [];
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async (input) => ({
          jobId: input.jobId,
          storyboardId: input.storyboardId,
          status: "segments_queued",
          reservedLedgerId: "ledger-1",
          segmentCount: 2,
        }),
        kickGeneration: async ({ jobId }) => {
          kickedJobs.push(jobId);
          return {
            status: "submitted",
            submittedCount: 2,
            failedCount: 0,
            segmentIds: ["segment-1", "segment-2"],
            providerTaskIds: ["task-1", "task-2"],
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      storyboardId: "storyboard-1",
      status: "segment_generating",
      reservedLedgerId: "ledger-1",
      segmentCount: 2,
      generationKick: {
        status: "submitted",
        submittedCount: 2,
        failedCount: 0,
        segmentIds: ["segment-1", "segment-2"],
        providerTaskIds: ["task-1", "task-2"],
      },
    });
    expect(kickedJobs).toEqual(["job-1"]);
  });

  it("returns 502 when immediate segment submission fails", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async (input) => ({
          jobId: input.jobId,
          storyboardId: input.storyboardId,
          status: "segments_queued",
          reservedLedgerId: "ledger-1",
          segmentCount: 1,
        }),
        kickGeneration: async () => ({
          status: "failed",
          submittedCount: 0,
          failedCount: 1,
          segmentIds: ["segment-1"],
          providerTaskIds: [],
          errorMessage: "EvoLink submit failed.",
        }),
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "generation_submit_failed",
      message: "EvoLink submit failed.",
      jobId: "job-1",
      storyboardId: "storyboard-1",
      status: "segments_queued",
      reservedLedgerId: "ledger-1",
      segmentCount: 1,
      generationKick: {
        status: "failed",
        submittedCount: 0,
        failedCount: 1,
        segmentIds: ["segment-1"],
        providerTaskIds: [],
        errorMessage: "EvoLink submit failed.",
      },
    });
  });

  it("uses an operator-facing message when model route configuration is missing", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async (input) => ({
          jobId: input.jobId,
          storyboardId: input.storyboardId,
          status: "segments_queued",
          reservedLedgerId: "ledger-1",
          segmentCount: 1,
        }),
        kickGeneration: async () => ({
          status: "failed",
          submittedCount: 0,
          failedCount: 1,
          segmentIds: ["segment-1"],
          providerTaskIds: [],
          errorMessage: "No active model route for video_generation in development.",
        }),
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "generation_route_unavailable",
      message: "视频生成服务未完成模型路由配置，请联系管理员检查 development 环境的 video_generation route。",
    });
  });

  it("returns the current generation state when a storyboard was already confirmed", async () => {
    const kickedJobs: string[] = [];
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async () => {
          throw new Error("Storyboard is already confirmed.");
        },
        kickGeneration: async ({ jobId }) => {
          kickedJobs.push(jobId);
          return {
            status: "submitted",
            submittedCount: 1,
            failedCount: 0,
            segmentIds: ["segment-1"],
            providerTaskIds: ["task-1"],
          };
        },
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      storyboardId: "storyboard-1",
      status: "segments_queued",
      reservedLedgerId: null,
      segmentCount: 0,
      alreadyConfirmed: true,
    });
    expect(kickedJobs).toEqual([]);
  });

  it("returns 400 for missing storyboard id", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_confirm_input" });
  });

  it("maps moderation blocks to 403 without leaking provider detail", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async () => {
          throw new Error("Final prompt moderation blocked video generation.");
        },
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "prompt_moderation_blocked",
    });
  });

  it("returns 503 when final prompt moderation is temporarily unavailable", async () => {
    const response = await handleConfirmStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/confirm", {
        method: "POST",
        body: JSON.stringify({ storyboardId: "storyboard-1" }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        confirmStoryboard: async () => {
          throw new Error("Final prompt moderation unavailable for video generation.");
        },
      },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "prompt_moderation_unavailable",
    });
  });
});
