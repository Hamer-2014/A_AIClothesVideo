// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { JobProgress } from "./job-progress";

describe("JobProgress", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows the failure message returned by progress polling", () => {
    render(
      <JobProgress
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
    expect(
      screen.getByText(
        "EvoLink failed: Service busy. Allocating resources, please retry later.",
      ),
    ).toBeInTheDocument();
  });
});
