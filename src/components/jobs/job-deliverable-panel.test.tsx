// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobDeliverablePanel } from "./job-deliverable-panel";

describe("JobDeliverablePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("previews the public video URL and downloads through the app endpoint", () => {
    render(
      <JobDeliverablePanel
        defaultFilename="runwaytools-job-1.mp4"
        jobId="job-1"
        previewUrl="https://cdn.example.com/jobs/job-1/stitched/final.mp4"
      />,
    );

    expect(
      screen.getByText("当前浏览器不支持视频预览。").closest("video"),
    ).toHaveAttribute(
      "src",
      "https://cdn.example.com/jobs/job-1/stitched/final.mp4",
    );

    fireEvent.change(screen.getByLabelText("下载文件名"), {
      target: { value: "spring dress" },
    });

    expect(screen.getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/download?filename=spring%20dress.mp4",
    );
  });

  it("plays the video when both a cover and public preview URL are available", () => {
    render(
      <JobDeliverablePanel
        coverUrl="https://cdn.example.com/jobs/job-1/covers/cover.webp"
        defaultFilename="runwaytools-job-1.mp4"
        jobId="job-1"
        previewUrl="https://cdn.example.com/jobs/job-1/stitched/final.mp4"
      />,
    );

    const video = screen.getByText("当前浏览器不支持视频预览。").closest("video");
    expect(video).toHaveAttribute(
      "src",
      "https://cdn.example.com/jobs/job-1/stitched/final.mp4",
    );
    expect(video).toHaveAttribute(
      "poster",
      "https://cdn.example.com/jobs/job-1/covers/cover.webp",
    );
    expect(screen.queryByRole("img", { name: "视频封面" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/download?filename=runwaytools-job-1.mp4",
    );
  });

  it("falls back to the default preview when a cover-only image fails to load", () => {
    render(
      <JobDeliverablePanel
        coverUrl="https://cdn.example.com/jobs/job-1/covers/cover.webp"
        defaultFilename="runwaytools-job-1.mp4"
        jobId="job-1"
        previewUrl={null}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "视频封面" }));

    expect(screen.getByLabelText("视频默认预览：成片已生成")).toBeInTheDocument();
  });

  it("keeps download available when the public preview URL is not configured", () => {
    render(
      <JobDeliverablePanel
        defaultFilename="runwaytools-job-1.mp4"
        jobId="job-1"
        previewUrl={null}
      />,
    );

    expect(
      screen.getByText("成片已生成"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("视频默认预览：成片已生成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/download?filename=runwaytools-job-1.mp4",
    );
  });
});
