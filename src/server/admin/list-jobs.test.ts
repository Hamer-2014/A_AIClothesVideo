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
          updatedAt: new Date("2026-06-08T00:05:00.000Z"),
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
          updatedAt: new Date("2026-06-09T00:05:00.000Z"),
        },
      ]),
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-2", "job-1"]);
  });

  it("filters attention jobs including failed and stale running states", async () => {
    const now = new Date("2026-06-11T00:20:00.000Z");

    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        {
          id: "job-failed",
          userId: "user-1",
          status: "segment_failed",
          userVisibleStatus: "failed",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: "provider failed",
          isTest: true,
          createdAt: new Date("2026-06-11T00:00:00.000Z"),
          updatedAt: new Date("2026-06-11T00:01:00.000Z"),
        },
        {
          id: "job-stale",
          userId: "user-2",
          status: "post_qa_queued",
          userVisibleStatus: "qa",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
          updatedAt: new Date("2026-06-11T00:05:00.000Z"),
        },
        {
          id: "job-ok",
          userId: "user-3",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-11T00:03:00.000Z"),
          updatedAt: new Date("2026-06-11T00:19:00.000Z"),
        },
      ]),
      filters: { attention: true },
      now,
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-stale", "job-failed"]);
  });

  it("filters by isTest flag", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        {
          id: "job-test",
          userId: "user-1",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 40,
          failureReason: null,
          isTest: true,
          createdAt: new Date("2026-06-11T00:00:00.000Z"),
          updatedAt: new Date("2026-06-11T00:01:00.000Z"),
        },
        {
          id: "job-live",
          userId: "user-2",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 40,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
          updatedAt: new Date("2026-06-11T00:03:00.000Z"),
        },
      ]),
      filters: { isTest: true },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-test"]);
  });

  it("filters by status", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        {
          id: "job-segment",
          userId: "user-1",
          status: "segment_failed",
          userVisibleStatus: "failed",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: "provider failed",
          isTest: false,
          createdAt: new Date("2026-06-11T00:00:00.000Z"),
          updatedAt: new Date("2026-06-11T00:01:00.000Z"),
        },
        {
          id: "job-qa",
          userId: "user-2",
          status: "post_qa_failed",
          userVisibleStatus: "failed",
          durationSeconds: 8,
          aspectRatio: "1:1",
          creditCost: 70,
          failureReason: "qa failed",
          isTest: false,
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
          updatedAt: new Date("2026-06-11T00:03:00.000Z"),
        },
      ]),
      filters: { status: "post_qa_failed" },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-qa"]);
  });

  it("searches by job id or user id", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        {
          id: "job-alpha",
          userId: "user-1",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 40,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-11T00:00:00.000Z"),
          updatedAt: new Date("2026-06-11T00:01:00.000Z"),
        },
        {
          id: "job-beta",
          userId: "user-search-me",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 40,
          failureReason: null,
          isTest: false,
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
          updatedAt: new Date("2026-06-11T00:03:00.000Z"),
        },
      ]),
      filters: { query: "search-me" },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-beta"]);
  });
});
