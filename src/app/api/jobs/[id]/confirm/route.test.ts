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
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      jobId: "job-1",
      storyboardId: "storyboard-1",
      status: "segments_queued",
      reservedLedgerId: "ledger-1",
      segmentCount: 2,
    });
  });

  it("returns the current generation state when a storyboard was already confirmed", async () => {
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
