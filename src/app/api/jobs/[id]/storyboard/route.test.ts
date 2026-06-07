import { describe, expect, it } from "vitest";

import { handleGenerateStoryboardRequest } from "./route";

describe("POST /api/jobs/[id]/storyboard", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGenerateStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/storyboard", {
        method: "POST",
        body: JSON.stringify({
          selectedTemplateIds: ["front_push_in"],
          userPrompt: "Show front view.",
          isTrial: true,
        }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("generates a storyboard draft for authenticated users", async () => {
    const response = await handleGenerateStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/storyboard", {
        method: "POST",
        body: JSON.stringify({
          selectedTemplateIds: ["front_push_in"],
          userPrompt: "Show front view.",
          isTrial: true,
        }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        generateStoryboard: async (input) => ({
          storyboard: {
            id: "storyboard-1",
            videoJobId: input.jobId,
            version: 1,
            status: "draft",
            selectedTemplateIds: input.selectedTemplateIds,
            storyboardJson: {
              duration_seconds: 8,
              segments: [],
            },
            finalPromptSnapshot: null,
            providerCallLogId: "call-log-1",
            confirmedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          parsed: {
            durationSeconds: 8,
            segments: [
              {
                index: 0,
                durationSeconds: 8,
                templateId: "front_push_in",
                prompt: "Slow front push-in.",
              },
            ],
            raw: {},
          },
        }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      storyboardId: "storyboard-1",
      status: "draft",
      segments: [
        {
          index: 0,
          durationSeconds: 8,
          templateId: "front_push_in",
          prompt: "Slow front push-in.",
        },
      ],
    });
  });

  it("returns 400 for invalid request input", async () => {
    const response = await handleGenerateStoryboardRequest(
      new Request("http://localhost/api/jobs/job-1/storyboard", {
        method: "POST",
        body: JSON.stringify({
          selectedTemplateIds: [],
          userPrompt: "",
        }),
      }),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_storyboard_input" });
  });
});
