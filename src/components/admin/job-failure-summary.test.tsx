// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobFailureSummary } from "./job-failure-summary";

describe("JobFailureSummary", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows failure reason, ledger context, and latest segment/stitch/post-QA states", () => {
    render(
      <JobFailureSummary
        job={{
          status: "segment_failed",
          userVisibleStatus: "failed",
          failureReason: "provider failed",
          lastError: "Provider task returned failed.",
          billingMode: "paid",
          creditCost: 130,
          reservedLedgerId: "ledger-reserve",
        }}
        segments={[
          {
            id: "segment-1",
            segmentIndex: 0,
            status: "failed",
            lastError: "segment provider timeout",
          },
          {
            id: "segment-2",
            segmentIndex: 1,
            status: "succeeded",
            lastError: null,
          },
        ]}
        stitchJobs={[
          {
            id: "stitch-1",
            status: "failed",
            lastError: "ffmpeg exited 1",
          },
        ]}
        postQaResults={[
          {
            id: "qa-1",
            status: "failed",
            mode: "standard",
            failureCategory: "garment_mismatch",
          },
        ]}
      />,
    );

    expect(screen.getByText("失败摘要")).toBeInTheDocument();
    expect(screen.getByText("segment_failed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
    expect(screen.getByText("provider failed")).toBeInTheDocument();
    expect(screen.getByText("Provider task returned failed.")).toBeInTheDocument();
    expect(screen.getByText("paid")).toBeInTheDocument();
    expect(screen.getByText("130 点")).toBeInTheDocument();
    expect(screen.getByText("ledger-reserve")).toBeInTheDocument();
    expect(screen.getByText("segment #0: failed")).toBeInTheDocument();
    expect(screen.getByText("stitch-1: failed")).toBeInTheDocument();
    expect(screen.getByText("qa-1: failed / standard / garment_mismatch")).toBeInTheDocument();
  });

  it("renders an empty failure state for non-failed jobs", () => {
    render(
      <JobFailureSummary
        job={{
          status: "deliverable",
          userVisibleStatus: "downloadable",
          failureReason: null,
          lastError: null,
          billingMode: "free_trial",
          creditCost: 0,
          reservedLedgerId: null,
        }}
        segments={[]}
        stitchJobs={[]}
        postQaResults={[]}
      />,
    );

    expect(screen.getByText("暂无失败摘要")).toBeInTheDocument();
  });
});
