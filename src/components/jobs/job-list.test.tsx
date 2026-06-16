// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobList } from "./job-list";

describe("JobList", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a cover thumbnail when a deliverable job has a cover key", () => {
    render(
      <JobList
        jobs={[
          {
            id: "job-cover-1",
            status: "deliverable",
            userVisibleStatus: "ready",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 8,
            finalVideoKey: "jobs/job-cover-1/stitched/final.mp4",
            coverKey: "jobs/job-cover-1/covers/cover.webp",
            coverUrl: "/api/jobs/job-cover-1/cover",
            failureReason: null,
            createdAt: new Date("2026-06-13T08:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "任务封面" })).toHaveAttribute(
      "src",
      expect.stringContaining("/api/jobs/job-cover-1/cover"),
    );
  });

  it("keeps list alignment with a default thumbnail when a job has no cover", () => {
    render(
      <JobList
        jobs={[
          {
            id: "job-no-cover-1",
            status: "segment_generating",
            userVisibleStatus: "generating",
            durationSeconds: 16,
            aspectRatio: "9:16",
            creditCost: 16,
            finalVideoKey: null,
            coverKey: null,
            coverUrl: null,
            failureReason: null,
            createdAt: new Date("2026-06-13T08:00:00.000Z"),
          },
        ]}
      />,
    );

    expect(screen.getAllByText("生成中")).toHaveLength(2);
    expect(screen.getByLabelText("视频默认缩略图：生成中")).toBeInTheDocument();
  });

  it("falls back to the default thumbnail when the cover image fails to load", () => {
    render(
      <JobList
        jobs={[
          {
            id: "job-failed-cover-1",
            status: "failed_released",
            userVisibleStatus: "failed",
            durationSeconds: 8,
            aspectRatio: "9:16",
            creditCost: 70,
            finalVideoKey: null,
            coverKey: "jobs/job-failed-cover-1/covers/cover.webp",
            coverUrl: "/api/jobs/job-failed-cover-1/cover",
            failureReason: "供应商生成失败，点数已释放。",
            createdAt: new Date("2026-06-13T08:00:00.000Z"),
          },
        ]}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "任务封面" }));

    expect(
      screen.getByLabelText("视频默认缩略图：失败 / 已释放"),
    ).toBeInTheDocument();
  });

  it("points empty list users back to the workspace", () => {
    render(<JobList jobs={[]} />);

    expect(screen.getByText("还没有视频任务")).toBeInTheDocument();
    expect(screen.getByText("去工作台创建第一个视频")).toHaveAttribute(
      "href",
      "/workspace",
    );
  });
});
