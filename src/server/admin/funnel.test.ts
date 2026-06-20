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
      { eventName: "landing_viewed", metadata: { sourcePage: "landing" }, createdAt: new Date("2026-06-17T00:01:10Z") },
      { eventName: "landing_viewed", metadata: { sourcePage: "landing" }, createdAt: new Date("2026-06-17T00:01:20Z") },
      { eventName: "trial_cta_clicked", metadata: { sourcePage: "landing" }, createdAt: new Date("2026-06-17T00:01:30Z") },
      { eventName: "guest_asset_selected", metadata: { assetRole: "front" }, createdAt: new Date("2026-06-17T00:01:40Z") },
      { eventName: "guest_asset_selected", metadata: { assetRole: "front" }, createdAt: new Date("2026-06-17T00:01:45Z") },
      { eventName: "guest_generate_clicked", metadata: { mode: "trial" }, createdAt: new Date("2026-06-17T00:01:50Z") },
      { eventName: "guest_generate_clicked", metadata: { mode: "trial" }, createdAt: new Date("2026-06-17T00:01:52Z") },
      { eventName: "guest_draft_restored", metadata: { draftRestored: true }, createdAt: new Date("2026-06-17T00:01:55Z") },
      { eventName: "guest_draft_restored", metadata: { draftRestored: true }, createdAt: new Date("2026-06-17T00:01:56Z") },
      { eventName: "authenticated_asset_reselected", metadata: { assetRole: "front" }, createdAt: new Date("2026-06-17T00:01:58Z") },
      { eventName: "authenticated_asset_reselected", metadata: { assetRole: "front" }, createdAt: new Date("2026-06-17T00:01:59Z") },
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
        { eventName: "landing_viewed", count: 2 },
        { eventName: "trial_cta_clicked", count: 1 },
        { eventName: "guest_generate_clicked", count: 2 },
        { eventName: "asset_uploaded", count: 1 },
        { eventName: "job_created", count: 2 },
        { eventName: "generation_deliverable", count: 1 },
      ]),
    );
    expect(summary.conversions).toEqual(
      expect.arrayContaining([
        {
          key: "landing_to_trial_cta",
          label: "Landing -> Trial CTA",
          numerator: 1,
          denominator: 2,
          rate: 0.5,
        },
        {
          key: "guest_workspace_to_asset",
          label: "Guest Workspace -> Guest Asset",
          numerator: 2,
          denominator: 2,
          rate: 1,
        },
        {
          key: "guest_asset_to_generate",
          label: "Guest Asset -> Guest Generate",
          numerator: 2,
          denominator: 2,
          rate: 1,
        },
        {
          key: "guest_generate_to_draft_restored",
          label: "Guest Generate -> Draft Restored",
          numerator: 2,
          denominator: 2,
          rate: 1,
        },
        {
          key: "draft_restored_to_auth_asset",
          label: "Draft Restored -> Auth Asset Reselected",
          numerator: 2,
          denominator: 2,
          rate: 1,
        },
        {
          key: "auth_asset_to_job",
          label: "Auth Asset Reselected -> Job Created",
          numerator: 2,
          denominator: 2,
          rate: 1,
        },
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
