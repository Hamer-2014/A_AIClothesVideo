import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminJobLedgerSummaryStore,
  createInMemoryAdminJobListStore,
  listAdminJobs,
} from "./list-jobs";

describe("admin job list", () => {
  function job(overrides: Partial<Parameters<typeof createInMemoryAdminJobListStore>[0][number]> & {
    id: string;
    userId?: string;
    createdAt?: Date;
  }): Parameters<typeof createInMemoryAdminJobListStore>[0][number] {
    return {
      userId: "user-1",
      status: "deliverable",
      userVisibleStatus: "downloadable",
      durationSeconds: 8,
      aspectRatio: "9:16",
      creditCost: 70,
      failureReason: null,
      isTest: false,
      billingMode: "paid",
      presetId: "minimal_studio",
      createdAt: new Date("2026-06-11T00:00:00.000Z"),
      updatedAt: new Date("2026-06-11T00:01:00.000Z"),
      ...overrides,
    };
  }

  it("returns newest jobs first", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({
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
        }),
        job({
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
        }),
      ]),
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-2", "job-1"]);
  });

  it("filters attention jobs including failed and stale running states", async () => {
    const now = new Date("2026-06-11T00:20:00.000Z");

    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({
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
        }),
        job({
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
        }),
        job({
          id: "job-ok",
          userId: "user-3",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: null,
          isTest: false,
          hasCapture: true,
          createdAt: new Date("2026-06-11T00:03:00.000Z"),
          updatedAt: new Date("2026-06-11T00:19:00.000Z"),
        }),
        job({
          id: "job-billing",
          userId: "user-4",
          status: "deliverable",
          userVisibleStatus: "downloadable",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          failureReason: null,
          isTest: false,
          hasCapture: false,
          createdAt: new Date("2026-06-11T00:04:00.000Z"),
          updatedAt: new Date("2026-06-11T00:19:30.000Z"),
        }),
      ]),
      ledgerSummaryStore: createInMemoryAdminJobLedgerSummaryStore(["job-ok"]),
      filters: { attention: true },
      now,
    });

    expect(jobs.map((job) => job.id)).toEqual([
      "job-billing",
      "job-stale",
      "job-failed",
    ]);
  });

  it("filters by isTest flag", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({
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
        }),
        job({
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
        }),
      ]),
      filters: { isTest: true },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-test"]);
  });

  it("filters by status", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({
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
        }),
        job({
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
        }),
      ]),
      filters: { status: "post_qa_failed" },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-qa"]);
  });

  it("filters by billing mode", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({ id: "job-paid", billingMode: "paid" }),
        job({
          id: "job-trial",
          billingMode: "free_trial",
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
        }),
      ]),
      filters: { billingMode: "free_trial" },
    });

    expect(jobs.map((item) => item.id)).toEqual(["job-trial"]);
  });

  it("filters by preset id", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({ id: "job-minimal", presetId: "minimal_studio" }),
        job({
          id: "job-marketplace",
          presetId: "marketplace_clean",
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
        }),
      ]),
      filters: { presetId: "marketplace_clean" },
    });

    expect(jobs.map((item) => item.id)).toEqual(["job-marketplace"]);
  });

  it("treats handled and actionable failure states as the failure queue", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({ id: "job-deliverable", status: "deliverable" }),
        job({
          id: "job-asset",
          status: "asset_analysis_failed",
          createdAt: new Date("2026-06-11T00:01:00.000Z"),
        }),
        job({
          id: "job-segment",
          status: "segment_failed",
          createdAt: new Date("2026-06-11T00:02:00.000Z"),
        }),
        job({
          id: "job-post-qa",
          status: "post_qa_failed",
          createdAt: new Date("2026-06-11T00:03:00.000Z"),
        }),
        job({
          id: "job-moderation",
          status: "prompt_moderation_blocked",
          createdAt: new Date("2026-06-11T00:04:00.000Z"),
        }),
        job({
          id: "job-refunded",
          status: "failed_refunded",
          createdAt: new Date("2026-06-11T00:05:00.000Z"),
        }),
        job({
          id: "job-released",
          status: "failed_released",
          createdAt: new Date("2026-06-11T00:06:00.000Z"),
        }),
      ]),
      filters: { failureQueue: true },
    });

    expect(jobs.map((item) => item.id)).toEqual([
      "job-released",
      "job-refunded",
      "job-moderation",
      "job-post-qa",
      "job-segment",
      "job-asset",
    ]);
  });

  it("searches by job id or user id", async () => {
    const jobs = await listAdminJobs({
      store: createInMemoryAdminJobListStore([
        job({
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
        }),
        job({
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
        }),
      ]),
      filters: { query: "search-me" },
    });

    expect(jobs.map((job) => job.id)).toEqual(["job-beta"]);
  });
});
