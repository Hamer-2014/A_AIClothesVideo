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

  it("shows the generated cover image before falling back to the video preview", () => {
    render(
      <JobDeliverablePanel
        coverUrl="https://cdn.example.com/jobs/job-1/covers/cover.webp"
        defaultFilename="runwaytools-job-1.mp4"
        jobId="job-1"
        previewUrl="https://cdn.example.com/jobs/job-1/stitched/final.mp4"
      />,
    );

    expect(screen.getByRole("img", { name: "视频封面" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/jobs/job-1/covers/cover.webp",
    );
    expect(
      screen.queryByText("当前浏览器不支持视频预览。"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/download?filename=runwaytools-job-1.mp4",
    );
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
      screen.getByText("视频预览需要先配置公开 R2 访问域名。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下载成片" })).toHaveAttribute(
      "href",
      "/api/jobs/job-1/download?filename=runwaytools-job-1.mp4",
    );
  });
});
