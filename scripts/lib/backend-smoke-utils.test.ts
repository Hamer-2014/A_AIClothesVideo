import { describe, expect, it } from "vitest";

import {
  buildMissingJobIdMessage,
  buildSmokeArtifactKeys,
  classifySmokeOutcome,
  normalizeSmokeMode,
  resolveSmokeJobId,
  assertSmokeCreditLedger,
  shouldTriggerStitch,
} from "./backend-smoke-utils.mjs";

describe("backend smoke utils", () => {
  it("normalizes supported smoke modes", () => {
    expect(normalizeSmokeMode(undefined)).toBe("full");
    expect(normalizeSmokeMode("stitch")).toBe("stitch");
    expect(normalizeSmokeMode("full")).toBe("full");
  });

  it("rejects unsupported smoke modes", () => {
    expect(() => normalizeSmokeMode("qa-only")).toThrow(
      "Unsupported SMOKE_MODE",
    );
  });

  it("resolves job id from cli args before env", () => {
    expect(
      resolveSmokeJobId({
        argv: ["--job-id", "job-from-cli"],
        env: { JOB_ID: "job-from-env" },
      }),
    ).toBe("job-from-cli");
  });

  it("falls back to env job id when cli args are missing", () => {
    expect(
      resolveSmokeJobId({
        argv: [],
        env: { JOB_ID: "job-from-env" },
      }),
    ).toBe("job-from-env");
  });

  it("builds a helpful missing job id message for powershell users", () => {
    const message = buildMissingJobIdMessage({
      mode: "stitch",
      candidates: [
        {
          id: "job-1",
          status: "post_qa_queued",
          is_test: true,
          updated_at: "2026-06-08T21:13:47.038Z",
        },
      ],
    });

    expect(message).toContain("JOB_ID is required");
    expect(message).toContain("npm run smoke:stitch -- --job-id job-1");
    expect(message).toContain("$env:JOB_ID='job-1'; npm run smoke:stitch");
    expect(message).toContain("Recent candidate jobs");
    expect(message).toContain("post_qa_queued");
  });

  it("builds expected artifact keys from a job id", () => {
    expect(buildSmokeArtifactKeys("job-123")).toEqual({
      finalVideoKey: "jobs/job-123/stitched/final.mp4",
      framePrefix: "jobs/job-123/qa/frames/",
    });
  });

  it("triggers stitch for queued stitch states", () => {
    expect(
      shouldTriggerStitch({
        mode: "stitch",
        jobStatus: "stitching_queued",
        stitchStatus: "queued",
      }),
    ).toBe(true);
  });

  it("does not retrigger stitch after the job already reached post-qa", () => {
    expect(
      shouldTriggerStitch({
        mode: "stitch",
        jobStatus: "post_qa_queued",
        stitchStatus: "succeeded",
      }),
    ).toBe(false);
  });

  it("does not retrigger stitch while a stitch job is already running", () => {
    expect(
      shouldTriggerStitch({
        mode: "full",
        jobStatus: "stitching_running",
        stitchStatus: "running",
      }),
    ).toBe(false);
  });

  it("classifies stitch-only smoke completion", () => {
    expect(
      classifySmokeOutcome({
        mode: "stitch",
        jobStatus: "post_qa_queued",
        stitchStatus: "succeeded",
        postQaStatus: null,
      }),
    ).toEqual({
      done: true,
      success: true,
      reason: "stitch_completed",
    });
  });

  it("treats stitch-only smoke as completed once stitch succeeded even if post-qa already failed", () => {
    expect(
      classifySmokeOutcome({
        mode: "stitch",
        jobStatus: "post_qa_failed",
        stitchStatus: "succeeded",
        postQaStatus: "failed",
      }),
    ).toEqual({
      done: true,
      success: true,
      reason: "stitch_completed",
    });
  });

  it("treats stitch-only smoke as completed once the final job is deliverable", () => {
    expect(
      classifySmokeOutcome({
        mode: "stitch",
        jobStatus: "deliverable",
        stitchStatus: "succeeded",
        postQaStatus: "passed",
      }),
    ).toEqual({
      done: true,
      success: true,
      reason: "stitch_completed",
    });
  });

  it("classifies full smoke completion after post-qa delivery", () => {
    expect(
      classifySmokeOutcome({
        mode: "full",
        jobStatus: "deliverable",
        stitchStatus: "succeeded",
        postQaStatus: "passed",
      }),
    ).toEqual({
      done: true,
      success: true,
      reason: "deliverable",
    });
  });

  it("classifies terminal failures", () => {
    expect(
      classifySmokeOutcome({
        mode: "full",
        jobStatus: "failed_released",
        stitchStatus: "failed",
        postQaStatus: "failed",
      }),
    ).toEqual({
      done: true,
      success: false,
      reason: "failed_released",
    });
  });

  it("requires capture only for paid full-smoke jobs", () => {
    expect(() =>
      assertSmokeCreditLedger({
        mode: "full",
        job: {},
        ledger: [],
      }),
    ).toThrow("Full smoke job snapshot is missing credit_cost");

    expect(() =>
      assertSmokeCreditLedger({
        mode: "full",
        job: { credit_cost: 70 },
        ledger: [{ type: "reserve" }],
      }),
    ).toThrow("Full smoke expected credit capture");

    expect(() =>
      assertSmokeCreditLedger({
        mode: "full",
        job: { credit_cost: 70 },
        ledger: [{ type: "capture" }],
      }),
    ).toThrow("Full smoke expected credit reserve");

    expect(() =>
      assertSmokeCreditLedger({
        mode: "full",
        job: { credit_cost: 0 },
        ledger: [],
      }),
    ).not.toThrow();

    expect(() =>
      assertSmokeCreditLedger({
        mode: "stitch",
        job: { credit_cost: 70 },
        ledger: [],
      }),
    ).not.toThrow();
  });

  it("requires reserve and capture for paid full-smoke jobs", () => {
    expect(() =>
      assertSmokeCreditLedger({
        mode: "full",
        job: { credit_cost: 70 },
        ledger: [
          { type: "reserve" },
          { type: "capture" },
        ],
      }),
    ).not.toThrow();
  });
});
