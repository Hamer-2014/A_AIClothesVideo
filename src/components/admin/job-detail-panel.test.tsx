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
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 130,
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
          latestStoryboard: null,
          segments: [
            {
              id: "segment-1",
              videoJobId: "job-1",
              segmentIndex: 0,
              status: "failed",
              templateId: "front_push_in",
              provider: "evolink",
              model: "veo3.1-pro-beta",
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
              model: "veo3.1-pro-beta",
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
    expect(screen.getByText("Segment 表")).toBeInTheDocument();
    expect(screen.getByText("Provider Logs 表")).toBeInTheDocument();
    expect(screen.getByText("State Events Timeline")).toBeInTheDocument();
    expect(screen.getByText("原始辅助数据")).toBeInTheDocument();
  });
});
