// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobDetailPanel } from "./job-detail-panel";

describe("JobDetailPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows diagnosis and readable operational sections before raw json", () => {
    render(
      <JobDetailPanel
        detail={{
          job: {
            id: "job-1",
            userId: "user-1",
            status: "segment_failed",
            userVisibleStatus: "failed",
            billingMode: "paid",
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 130,
            presetId: "minimal_studio",
            presetSnapshot: {
              id: "minimal_studio",
              label: "极简棚拍",
            },
            trialEligibilitySnapshot: {
              decision: "deny",
              reasonCodes: ["email_trial_used"],
              riskScore: 100,
            },
            reservedLedgerId: "ledger-1",
            finalVideoKey: null,
            coverKey: null,
            isTest: false,
            failureReason: "provider failed",
            lastError: "provider failed",
            createdAt: new Date("2026-06-11T00:00:00.000Z"),
            updatedAt: new Date("2026-06-11T00:05:00.000Z"),
          },
          diagnosis: {
            kind: "segment_failed",
            severity: "critical",
            title: "存在失败片段",
            recommendation: "优先重试失败 segment，不要整单重跑；同时检查 provider task id 和 last error。",
            needsManualAction: true,
          },
          assets: [],
          analyses: [],
          consistencyAnalyses: [
            {
              videoJobId: "job-1",
              analysisKind: "product_views",
              status: "failed",
              garmentMatch: "fail",
              modelMatch: "not_applicable",
              colorMatch: false,
              patternMatch: true,
              viewCoverage: ["front", "side"],
              confidence: "0.61",
              riskFlags: ["pattern_mismatch"],
              resultJson: { garment_match: "fail" },
            },
            {
              videoJobId: "job-1",
              analysisKind: "model_views",
              status: "passed",
              garmentMatch: "pass",
              modelMatch: "pass",
              colorMatch: true,
              patternMatch: true,
              viewCoverage: ["front", "side", "back"],
              confidence: "0.94",
              riskFlags: [],
              resultJson: { garment_match: "pass", model_match: "pass" },
            },
          ],
          latestStoryboard: {
            id: "storyboard-1",
            videoJobId: "job-1",
            status: "draft",
            presetId: "minimal_studio",
            presetSnapshot: {
              id: "minimal_studio",
              label: "极简棚拍",
            },
            selectedTemplateIds: ["front_push_in"],
            storyboardJson: {
              duration_seconds: 16,
              segments: [{ index: 0, template_id: "front_push_in" }],
            },
            finalPromptSnapshot: {
              prompt: "keep front view",
            },
            createdAt: new Date("2026-06-11T00:01:00.000Z"),
          },
          segments: [
            {
              id: "segment-1",
              videoJobId: "job-1",
              segmentIndex: 0,
              status: "failed",
              templateId: "front_push_in",
              provider: "evolink",
              model: "veo3.1-fast-beta",
              providerTaskId: "task-1",
              videoKey: null,
              prompt: "show front gently",
              lastError: "provider failed",
              attemptCount: 2,
            },
          ],
          providerLogs: [
            {
              id: "call-1",
              videoJobId: "job-1",
              segmentId: "segment-1",
              purpose: "video_generation",
              provider: "evolink",
              modelRouteId: "route-1",
              routeSnapshot: {
                routeId: "route-1",
                routeSource: "database",
              },
              model: "veo3.1-fast-beta",
              status: "failed",
              durationMs: 4200,
              costEstimate: "2.100000",
              fallbackReason: null,
              responseSummary: { error: "provider failed" },
              providerTaskId: "task-1",
              errorCode: "provider_failed",
              errorMessage: "provider failed",
              createdAt: new Date("2026-06-11T00:04:00.000Z"),
            },
          ],
          moderationResults: [],
          ledger: [],
          notes: [
            {
              id: "note-1",
              jobId: "job-1",
              adminUserId: "operator-1",
              note: "checked provider logs before retry",
              createdAt: new Date("2026-06-11T00:05:00.000Z"),
            },
          ],
          stitchJobs: [],
          postQaResults: [],
          stateEvents: [
            {
              id: "evt-1",
              videoJobId: "job-1",
              segmentId: null,
              fromStatus: "segment_generating",
              toStatus: "segment_failed",
              reason: "provider failed",
              actorType: "system",
              actorId: null,
              eventSnapshot: null,
              createdAt: new Date("2026-06-11T00:04:30.000Z"),
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("诊断摘要")).toBeInTheDocument();
    expect(screen.getByText("存在失败片段")).toBeInTheDocument();
    expect(screen.getByText("失败摘要")).toBeInTheDocument();
    expect(screen.getByText("segment #0: failed")).toBeInTheDocument();
    expect(screen.getAllByText("ledger-1").length).toBeGreaterThan(0);
    expect(screen.getByText("Segment 表")).toBeInTheDocument();
    expect(screen.getByText("Provider Logs 表")).toBeInTheDocument();
    expect(screen.getByText("Trial Eligibility")).toBeInTheDocument();
    expect(screen.getByText("Style Preset Snapshot")).toBeInTheDocument();
    expect(screen.getByText("任务内多图一致性")).toBeInTheDocument();
    expect(
      screen.getByText("仅比较本次任务中的可见模特与服装，不建立人脸库或跨任务身份标识。"),
    ).toBeInTheDocument();
    expect(screen.getByText("model_views")).toBeInTheDocument();
    expect(screen.getByText("garment_match: fail")).toBeInTheDocument();
    expect(screen.getByText("model_match: pass")).toBeInTheDocument();
    expect(screen.getByText("置信度: 0.61")).toBeInTheDocument();
    expect(screen.getByText(/pattern_mismatch/)).toBeInTheDocument();
    expect(screen.queryByText(/signed\.example/)).not.toBeInTheDocument();
    expect(screen.getAllByText("minimal_studio").length).toBeGreaterThan(0);
    expect(screen.getByText(/email_trial_used/)).toBeInTheDocument();
    expect(screen.getByText("State Events Timeline")).toBeInTheDocument();
    expect(screen.getByText("管理员备注")).toBeInTheDocument();
    expect(screen.getByText("checked provider logs before retry")).toBeInTheDocument();
    expect(screen.getByText("原始辅助数据")).toBeInTheDocument();
  });
});
