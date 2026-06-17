// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobLivePanels } from "./job-live-panels";

vi.mock("./job-upgrade-panel", () => ({
  JobUpgradePanel: ({
    billingMode,
    downloadReady,
    phase,
  }: {
    billingMode?: string;
    downloadReady: boolean;
    phase: string;
  }) => (
    <div data-testid="mock-job-upgrade-panel">
      {billingMode}:{phase}:{downloadReady ? "ready" : "not-ready"}
    </div>
  ),
}));

describe("JobLivePanels", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the deliverable preview as soon as progress polling reports download readiness", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        jobId: "job-1",
        status: "deliverable",
        userVisibleStatus: "ready",
        message: null,
        phase: "deliverable",
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
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: null,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <JobLivePanels
        defaultFilename="runwaytools-job-1.mp4"
        initialPreviewUrl={null}
        initialProgress={{
          jobId: "job-1",
          status: "segment_generating",
          userVisibleStatus: "generating",
          message: null,
          phase: "generation",
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
          finalVideoKey: null,
          coverKey: null,
        }}
        jobId="job-1"
        publicVideoBaseUrl="https://cdn.example.com"
      />,
    );

    expect(screen.queryByText("成片预览")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(screen.getByText("成片预览")).toBeInTheDocument();
    expect(
      screen.getByText("当前浏览器不支持视频预览。").closest("video"),
    ).toHaveAttribute(
      "src",
      "https://cdn.example.com/jobs/job-1/stitched/final.mp4",
    );
  });

  it("uses the generated cover URL as the video poster when progress includes a cover key", () => {
    render(
      <JobLivePanels
        defaultFilename="runwaytools-job-1.mp4"
        initialPreviewUrl={null}
        initialProgress={{
          jobId: "job-1",
          status: "deliverable",
          userVisibleStatus: "ready",
          message: null,
          phase: "deliverable",
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
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: "jobs/job-1/covers/cover.webp",
        }}
        jobId="job-1"
        publicVideoBaseUrl="https://cdn.example.com"
      />,
    );

    const video = screen.getByText("当前浏览器不支持视频预览。").closest("video");
    expect(video).toHaveAttribute(
      "poster",
      "/api/jobs/job-1/cover",
    );
    expect(video).toHaveAttribute(
      "src",
      "https://cdn.example.com/jobs/job-1/stitched/final.mp4",
    );
  });

  it("passes trial progress into the upgrade panel", () => {
    render(
      <JobLivePanels
        defaultFilename="runwaytools-job-1.mp4"
        initialPreviewUrl={null}
        initialProgress={{
          jobId: "job-1",
          status: "deliverable",
          userVisibleStatus: "ready",
          message: null,
          phase: "deliverable",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 1,
            failed: 0,
          },
          stitching: { status: "succeeded" },
          postQa: { status: "passed" },
          billingMode: "free_trial",
          creditStatus: "trial",
          downloadReady: true,
          finalVideoKey: "jobs/job-1/stitched/final.mp4",
          coverKey: null,
        }}
        jobId="job-1"
        publicVideoBaseUrl="https://cdn.example.com"
      />,
    );

    expect(screen.getByTestId("mock-job-upgrade-panel")).toHaveTextContent(
      "free_trial:deliverable:ready",
    );
  });

  it("shows a large status preview while the download is not ready", () => {
    render(
      <JobLivePanels
        defaultFilename="runwaytools-job-1.mp4"
        initialPreviewUrl={null}
        initialProgress={{
          jobId: "job-1",
          status: "post_qa_running",
          userVisibleStatus: "checking",
          message: null,
          phase: "post_qa",
          segmentProgress: {
            total: 1,
            queued: 0,
            generating: 0,
            succeeded: 1,
            failed: 0,
          },
          stitching: { status: "succeeded" },
          postQa: { status: "running" },
          downloadReady: false,
          finalVideoKey: null,
          coverKey: null,
        }}
        jobId="job-1"
      />,
    );

    expect(screen.getByText("质检中")).toBeInTheDocument();
    expect(screen.getByLabelText("视频默认预览：质检中")).toBeInTheDocument();
  });

  it("labels the waiting preview before generation starts", () => {
    render(
      <JobLivePanels
        defaultFilename="runwaytools-job-1.mp4"
        initialPreviewUrl={null}
        initialProgress={{
          jobId: "job-1",
          status: "segments_queued",
          userVisibleStatus: "queued",
          message: null,
          phase: "pre_generation",
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
          finalVideoKey: null,
          coverKey: null,
        }}
        jobId="job-1"
      />,
    );

    expect(screen.getByText("等待生成")).toBeInTheDocument();
  });
});
