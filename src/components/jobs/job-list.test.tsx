// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
      "/api/jobs/job-cover-1/cover",
    );
  });
});
