import { describe, expect, it } from "vitest";
import * as schema from "./index";

const requiredTables = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "authEmailEvents",
  "userProfiles",
  "adminRoles",
  "assets",
  "assetAnalyses",
  "shotTemplates",
  "shotTemplateMetrics",
  "videoJobs",
  "videoJobAssets",
  "storyboards",
  "videoSegments",
  "stitchJobs",
  "postQaResults",
  "jobStateEvents",
  "creditWallets",
  "creditLedger",
  "orders",
  "modelProviders",
  "providerKeys",
  "providerCallLogs",
  "promptModerationResults",
  "adminAuditLogs",
  "abuseEvents",
] as const;

const requiredComplianceTables = [
  "rightsAttestations",
  "assetRightsAttestations",
  "rightsRemovalRequests",
] as const;

const requiredJobStatuses = [
  "draft_uploaded",
  "lite_check_queued",
  "lite_check_running",
  "lite_check_passed",
  "asset_analysis_queued",
  "asset_analysis_running",
  "asset_analysis_passed",
  "storyboard_draft_ready",
  "storyboard_confirmed",
  "prompt_moderation_running",
  "prompt_moderation_passed",
  "prompt_moderation_blocked",
  "credits_reserved",
  "segments_queued",
  "segment_generating",
  "segment_succeeded",
  "segment_failed",
  "stitching_queued",
  "stitching_running",
  "stitched",
  "post_qa_queued",
  "post_qa_running",
  "post_qa_passed",
  "post_qa_failed",
  "deliverable",
  "failed_released",
  "failed_refunded",
] as const;

describe("database schema", () => {
  it("exports every MVP core table", () => {
    for (const tableName of requiredTables) {
      expect(schema[tableName]).toBeDefined();
    }
    expect(schema).not.toHaveProperty("modelRoutes");
  });

  it("exports rights compliance tables and snapshots", () => {
    for (const tableName of requiredComplianceTables) {
      expect(schema[tableName]).toBeDefined();
    }
    expect(schema.videoJobs).toHaveProperty("rightsAttestationSnapshot");
    expect(schema.rightsRemovalRequests).toHaveProperty("publicReference");
    expect(schema.rightsRemovalRequests).toHaveProperty("resolutionSummary");
  });

  it("exports asset consistency and template capability fields", () => {
    expect(schema.assetConsistencyAnalyses).toBeDefined();
    expect(schema.assetAnalyses).toHaveProperty("subjectKind");
    expect(schema.shotTemplates).toHaveProperty("subjectKind");
    expect(schema.shotTemplates).toHaveProperty("consistencyRequirements");
    expect(schema.shotTemplates).toHaveProperty("autoSelectAllowed");
  });

  it("exports required job states", () => {
    expect(schema.jobStatusValues).toEqual(
      expect.arrayContaining([...requiredJobStatuses]),
    );
  });

  it("keeps segments, ledger, provider calls, and state events as first-class tables", () => {
    expect(schema.videoSegments).toHaveProperty("providerTaskId");
    expect(schema.videoSegments).toHaveProperty("templateId");
    expect(schema.creditLedger).toHaveProperty("idempotencyKey");
    expect(schema.providerCallLogs).toHaveProperty("fallbackReason");
    expect(schema.jobStateEvents).toHaveProperty("toStatus");
  });
});
