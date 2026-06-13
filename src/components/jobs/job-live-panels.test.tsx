// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobLivePanels } from "./job-live-panels";

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

  it("uses the generated cover URL when progress includes a cover key", () => {
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

    expect(screen.getByRole("img", { name: "视频封面" })).toHaveAttribute(
      "src",
      "/api/jobs/job-1/cover",
    );
  });
});
