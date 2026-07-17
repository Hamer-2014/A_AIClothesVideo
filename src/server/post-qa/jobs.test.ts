import { describe, expect, it } from "vitest";

import {
  createInMemoryPostQaJobStore,
  getPostQaJobInput,
} from "./jobs";

describe("post QA job input", () => {
  it("returns the latest succeeded stitch frames and job QA mode", async () => {
    const store = createInMemoryPostQaJobStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          postQaMode: "strict",
        },
      ],
      stitchJobs: [
        {
          id: "stitch-1",
          videoJobId: "job-1",
          status: "succeeded",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
        },
      ],
      templateIdsByJob: {
        "job-1": ["model_half_turn"],
      },
    });

    await expect(getPostQaJobInput({ store, jobId: "job-1" })).resolves.toEqual({
      jobId: "job-1",
      userId: "user-1",
      mode: "strict",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      selectedTemplateIds: ["model_half_turn"],
    });
  });

  it("ignores newer non-succeeded stitch jobs and still uses the latest succeeded one", async () => {
    const store = createInMemoryPostQaJobStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          postQaMode: "standard",
        },
      ],
      stitchJobs: [
        {
          id: "stitch-new-queued",
          videoJobId: "job-1",
          status: "queued",
          frameKeys: [],
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
        },
        {
          id: "stitch-old-succeeded",
          videoJobId: "job-1",
          status: "succeeded",
          frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
        },
      ],
    });

    await expect(getPostQaJobInput({ store, jobId: "job-1" })).resolves.toEqual({
      jobId: "job-1",
      userId: "user-1",
      mode: "standard",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      selectedTemplateIds: [],
    });
  });

  it("fails when there is no succeeded stitch job available", async () => {
    const store = createInMemoryPostQaJobStore({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          postQaMode: "standard",
        },
      ],
      stitchJobs: [
        {
          id: "stitch-queued",
          videoJobId: "job-1",
          status: "queued",
          frameKeys: [],
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
        },
      ],
    });

    await expect(getPostQaJobInput({ store, jobId: "job-1" })).rejects.toThrow(
      "Succeeded stitch job not found.",
    );
  });
});
