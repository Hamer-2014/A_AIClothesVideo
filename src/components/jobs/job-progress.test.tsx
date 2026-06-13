// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobProgress } from "./job-progress";

describe("JobProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the failure message returned by progress polling", () => {
    render(
      <JobProgress
        key="queued"
        progress={{
          status: "segment_failed",
          phase: "generation",
          message:
            "EvoLink failed: Service busy. Allocating resources, please retry later.",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 0,
            failed: 1,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText("生成失败原因")).toBeInTheDocument();
    expect(screen.queryByText(/EvoLink/i)).not.toBeInTheDocument();
    expect(screen.getByText("生成服务暂时不可用，请稍后重试。")).toBeInTheDocument();
  });

  it("does not expose provider names in user-facing failure copy", () => {
    render(
      <JobProgress
        progress={{
          status: "segment_failed",
          phase: "failed",
          message: "EvoLink task polling failed with status 404.",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 0,
            failed: 1,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.queryByText(/EvoLink/i)).not.toBeInTheDocument();
    expect(screen.getByText("生成服务暂时不可用，请稍后重试。")).toBeInTheDocument();
  });

  it("does not show a failure card while provider generation is still active", () => {
    render(
      <JobProgress
        progress={{
          status: "segment_failed",
          phase: "generation",
          message: "APIMart task polling failed with status 404.",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 1,
            succeeded: 0,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText(/片段生成中 · 片段 0\/1/)).toBeInTheDocument();
    expect(screen.queryByText("生成失败原因")).not.toBeInTheDocument();
    expect(screen.queryByText("生成服务暂时不可用，请稍后重试。")).not.toBeInTheDocument();
  });

  it("labels queued and failed generation states clearly", () => {
    render(
      <JobProgress
        key="failed"
        progress={{
          status: "segments_queued",
          phase: "generation",
          message: null,
          segmentProgress: {
            total: 1,
            queued: 1,
            generating: 0,
            succeeded: 0,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText(/等待提交生成/)).toBeInTheDocument();

    cleanup();
    render(
      <JobProgress
        progress={{
          status: "segment_failed",
          phase: "failed",
          message: "EvoLink submit failed.",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 0,
            failed: 1,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText(/生成失败 · 片段 0\/1/)).toBeInTheDocument();
  });

  it("polls job progress while generation is active", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: "segment_succeeded",
        phase: "generation",
        message: null,
        segmentProgress: {
          total: 1,
          queued: 0,
          generating: 0,
          succeeded: 1,
          failed: 0,
        },
        stitching: { status: "not_started" },
        postQa: { status: "not_started" },
        downloadReady: false,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <JobProgress
        jobId="job-1"
        progress={{
          status: "segment_generating",
          phase: "generation",
          message: null,
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 1,
            succeeded: 0,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/progress", {
      cache: "no-store",
    });
    expect(screen.getByText(/片段 1\/1/)).toBeInTheDocument();
  });

  it("shows credit lifecycle copy for paid reserved and captured jobs", () => {
    render(
      <JobProgress
        progress={{
          status: "segments_queued",
          phase: "generation",
          message: null,
          creditCost: 70,
          billingMode: "paid",
          creditStatus: "reserved",
          segmentProgress: {
            total: 1,
            queued: 1,
            generating: 0,
            succeeded: 0,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText("已冻结 70 点")).toBeInTheDocument();
    expect(screen.getByText("质检通过后正式扣除。")).toBeInTheDocument();

    cleanup();
    render(
      <JobProgress
        progress={{
          status: "deliverable",
          phase: "deliverable",
          message: null,
          creditCost: 70,
          billingMode: "paid",
          creditStatus: "captured",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 1,
            failed: 0,
          },
          stitching: { status: "succeeded" },
          postQa: { status: "passed" },
          downloadReady: true,
        }}
      />,
    );

    expect(screen.getByText("已扣除 70 点")).toBeInTheDocument();
  });

  it("labels free trial jobs as zero-credit generation", () => {
    render(
      <JobProgress
        progress={{
          status: "segment_generating",
          phase: "generation",
          message: null,
          creditCost: 0,
          billingMode: "free_trial",
          creditStatus: "trial",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 1,
            succeeded: 0,
            failed: 0,
          },
          stitching: { status: "not_started" },
          postQa: { status: "not_started" },
          downloadReady: false,
        }}
      />,
    );

    expect(screen.getByText("免费试用 · 不扣点数")).toBeInTheDocument();
  });
});
