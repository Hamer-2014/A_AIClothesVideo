import { describe, expect, it } from "vitest";

import { createInMemoryPostQaJobStore, getPostQaJobInput } from "./jobs";

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
    });

    await expect(getPostQaJobInput({ store, jobId: "job-1" })).resolves.toEqual({
      jobId: "job-1",
      userId: "user-1",
      mode: "strict",
      frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
    });
  });
});
