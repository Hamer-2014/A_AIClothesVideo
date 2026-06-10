import { describe, expect, it } from "vitest";

import {
  createInMemoryUserJobListStore,
  listUserJobs,
} from "./list-jobs";

describe("listUserJobs", () => {
  it("returns complete video jobs for the current user in newest-first order", async () => {
    const jobs = await listUserJobs({
      store: createInMemoryUserJobListStore([
        {
          id: "job-older",
          userId: "user-1",
          status: "failed_released",
          userVisibleStatus: "failed",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          finalVideoKey: null,
          coverKey: null,
          failureReason: "provider_failed",
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
          updatedAt: new Date("2026-06-07T00:10:00.000Z"),
        },
        {
          id: "job-newer",
          userId: "user-1",
          status: "deliverable",
          userVisibleStatus: "ready",
          durationSeconds: 16,
          aspectRatio: "1:1",
          creditCost: 130,
          finalVideoKey: "jobs/job-newer/stitched/final.mp4",
          coverKey: "jobs/job-newer/covers/cover.webp",
          failureReason: null,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
          updatedAt: new Date("2026-06-08T00:10:00.000Z"),
        },
        {
          id: "job-other-user",
          userId: "user-2",
          status: "deliverable",
          userVisibleStatus: "ready",
          durationSeconds: 24,
          aspectRatio: "16:9",
          creditCost: 190,
          finalVideoKey: "jobs/job-other-user/stitched/final.mp4",
          coverKey: null,
          failureReason: null,
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
          updatedAt: new Date("2026-06-09T00:10:00.000Z"),
        },
      ]),
      userId: "user-1",
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-newer", "job-older"]);
    expect(jobs[0]).toMatchObject({
      status: "deliverable",
      finalVideoKey: "jobs/job-newer/stitched/final.mp4",
    });
  });
});
