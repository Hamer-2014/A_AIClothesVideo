import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminJobListStore,
  listAdminJobs,
} from "./list-jobs";

describe("admin job list", () => {
  it("returns newest jobs first", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        {
          id: "job-1",
          userId: "user-1",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 40,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
        },
        {
          id: "job-2",
          userId: "user-2",
          status: "failed_released",
          userVisibleStatus: "failed",
          durationSeconds: 16,
          aspectRatio: "1:1",
          creditCost: 80,
          failureReason: "provider_timeout",
          isTest: true,
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
        },
      ]),
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-2", "job-1"]);
  });
});
