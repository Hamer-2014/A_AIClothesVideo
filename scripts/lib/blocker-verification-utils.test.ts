import { describe, expect, it } from "vitest";

import {
  buildBlockerVerificationReport,
  evaluateAuditEvidence,
  evaluateFailureCompensationEvidence,
  evaluatePaidDeliveryEvidence,
} from "./blocker-verification-utils.mjs";

describe("blocker verification utils", () => {
  const paidDeliveryJob = (
    job: {
      id: string;
      status: string;
      creditCost: number;
      [key: string]: unknown;
    },
  ) => job;

  it("fails paid delivery evidence when no paid jobs exist", () => {
    const result = evaluatePaidDeliveryEvidence([]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("No paid deliverable job");
    expect(result.nextSteps[0]).toContain("credit_cost > 0");
  });

  it("requires reserve capture final video and QA frames for paid delivery evidence", () => {
    const result = evaluatePaidDeliveryEvidence([
      paidDeliveryJob({
        id: "job-paid",
        status: "deliverable",
        creditCost: 70,
        ledgerTypes: ["reserve", "capture"],
        finalVideoKey: "jobs/job-paid/stitched/final.mp4",
        qaFrameCount: 3,
        videoProviders: ["apimart"],
        videoModels: ["pixverse-v6"],
        videoRouteLogCount: 1,
      }),
    ]);

    expect(result).toMatchObject({
      passed: true,
      jobId: "job-paid",
    });
  });

  it("fails paid delivery evidence when capture is missing", () => {
    const result = evaluatePaidDeliveryEvidence([
      paidDeliveryJob({
        id: "job-paid",
        status: "deliverable",
        creditCost: 70,
        ledgerTypes: ["reserve"],
        finalVideoKey: "jobs/job-paid/stitched/final.mp4",
        qaFrameCount: 3,
        videoProviders: ["apimart"],
        videoModels: ["pixverse-v6"],
        videoRouteLogCount: 1,
      }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("capture");
  });

  it("fails paid delivery evidence when the public video provider is not PixVerse", () => {
    const result = evaluatePaidDeliveryEvidence([
      paidDeliveryJob({
        id: "job-paid",
        status: "deliverable",
        creditCost: 70,
        ledgerTypes: ["reserve", "capture"],
        finalVideoKey: "jobs/job-paid/stitched/final.mp4",
        qaFrameCount: 3,
        videoProviders: ["evolink"],
        videoModels: ["veo3.1-fast-beta"],
        videoRouteLogCount: 1,
      }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("apimart/pixverse-v6");
  });

  it("fails paid delivery evidence when route snapshot log is missing", () => {
    const result = evaluatePaidDeliveryEvidence([
      paidDeliveryJob({
        id: "job-paid",
        status: "deliverable",
        creditCost: 70,
        ledgerTypes: ["reserve", "capture"],
        finalVideoKey: "jobs/job-paid/stitched/final.mp4",
        qaFrameCount: 3,
        videoProviders: ["apimart"],
        videoModels: ["pixverse-v6"],
        videoRouteLogCount: 0,
      }),
    ]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("route snapshot");
  });

  it("passes failure compensation evidence for failed released jobs with release ledger", () => {
    const result = evaluateFailureCompensationEvidence([
      {
        id: "job-failed",
        status: "failed_released",
        creditCost: 70,
        ledgerTypes: ["reserve", "release"],
        stateEventCount: 4,
      },
    ]);

    expect(result).toMatchObject({
      passed: true,
      jobId: "job-failed",
    });
  });

  it("fails failure compensation evidence when no compensated failed job exists", () => {
    const result = evaluateFailureCompensationEvidence([]);

    expect(result.passed).toBe(false);
    expect(result.reason).toContain("No failed compensated paid job");
  });

  it("passes audit evidence when required actions are present", () => {
    const result = evaluateAuditEvidence([
      { action: "provider_key:create", count: 1 },
      { action: "provider_key:rotate", count: 1 },
      { action: "credits:admin_adjust", count: 2 },
    ]);

    expect(result.passed).toBe(true);
  });

  it("passes audit evidence when job operations are present", () => {
    const result = evaluateAuditEvidence([
      { action: "job:reopen_post_qa", count: 1 },
    ]);

    expect(result.passed).toBe(true);
  });

  it("builds a failing report when any blocker remains", () => {
    const report = buildBlockerVerificationReport({
      paidDelivery: evaluatePaidDeliveryEvidence([]),
      failureCompensation: evaluateFailureCompensationEvidence([]),
      auditEvidence: evaluateAuditEvidence([]),
    });

    expect(report.passed).toBe(false);
    expect(report.summary).toContain("BLOCKED");
  });
});
