import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminFunnelStore,
  getAdminFunnelSummary,
} from "./funnel";

describe("admin funnel summary", () => {
  it("returns event counts, conversions, and preset summary", async () => {
    const store = createInMemoryAdminFunnelStore([
      { eventName: "workspace_entered", metadata: {}, createdAt: new Date("2026-06-17T00:00:00Z") },
      { eventName: "workspace_entered", metadata: {}, createdAt: new Date("2026-06-17T00:01:00Z") },
      { eventName: "asset_uploaded", metadata: {}, createdAt: new Date("2026-06-17T00:02:00Z") },
      {
        eventName: "job_created",
        metadata: {
          jobId: "job-1",
          presetId: "minimal_studio",
          billingMode: "free_trial",
        },
        createdAt: new Date("2026-06-17T00:03:00Z"),
      },
      {
        eventName: "trial_generation_started",
        metadata: {
          jobId: "job-1",
          presetId: "minimal_studio",
          billingMode: "free_trial",
        },
        createdAt: new Date("2026-06-17T00:04:00Z"),
      },
      {
        eventName: "generation_deliverable",
        metadata: {
          jobId: "job-1",
          presetId: "minimal_studio",
        },
        createdAt: new Date("2026-06-17T00:05:00Z"),
      },
      {
        eventName: "video_downloaded",
        metadata: {
          jobId: "job-1",
          presetId: "minimal_studio",
        },
        createdAt: new Date("2026-06-17T00:06:00Z"),
      },
      {
        eventName: "job_created",
        metadata: {
          jobId: "job-2",
          presetId: "marketplace_clean",
          billingMode: "paid",
        },
        createdAt: new Date("2026-06-17T00:07:00Z"),
      },
      {
        eventName: "generation_failed",
        metadata: {
          jobId: "job-2",
          presetId: "marketplace_clean",
          reasonCategory: "provider",
        },
        createdAt: new Date("2026-06-17T00:08:00Z"),
      },
      {
        eventName: "checkout_started",
        metadata: {
          sourcePage: "billing",
        },
        createdAt: new Date("2026-06-17T00:09:00Z"),
      },
    ]);

    const summary = await getAdminFunnelSummary({ store });

    expect(summary.eventCounts).toEqual(
      expect.arrayContaining([
        { eventName: "workspace_entered", count: 2 },
        { eventName: "asset_uploaded", count: 1 },
        { eventName: "job_created", count: 2 },
        { eventName: "generation_deliverable", count: 1 },
      ]),
    );
    expect(summary.conversions).toEqual(
      expect.arrayContaining([
        {
          key: "workspace_to_upload",
          label: "Workspace -> Upload",
          numerator: 1,
          denominator: 2,
          rate: 0.5,
        },
        {
          key: "job_to_deliverable",
          label: "Job Created -> Deliverable",
          numerator: 1,
          denominator: 2,
          rate: 0.5,
        },
        {
          key: "trial_to_checkout",
          label: "Trial Generation -> Checkout",
          numerator: 1,
          denominator: 1,
          rate: 1,
        },
      ]),
    );
    expect(summary.presetSummary).toEqual(
      expect.arrayContaining([
        {
          presetId: "minimal_studio",
          jobCount: 1,
          deliverableCount: 1,
          failedCount: 0,
          downloadCount: 1,
        },
        {
          presetId: "marketplace_clean",
          jobCount: 1,
          deliverableCount: 0,
          failedCount: 1,
          downloadCount: 0,
        },
      ]),
    );
  });
});
