// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyzeRetryButton } from "./analyze-retry-button";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

describe("AnalyzeRetryButton", () => {
  afterEach(() => {
    cleanup();
    refresh.mockReset();
    vi.restoreAllMocks();
  });

  it("retries analyze for a failed job and refreshes the page", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job-1",
            availableTemplateIds: ["front_push_in"],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<AnalyzeRetryButton jobId="job-1" durationSeconds={16} />);

    fireEvent.click(screen.getByRole("button", { name: "重新分析素材" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/jobs/job-1/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "standard",
          isTrial: false,
        }),
      });
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("shows the backend failure message when retry analyze fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "asset_analysis_failed",
          message: "Vision provider response is missing JSON content.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<AnalyzeRetryButton jobId="job-1" durationSeconds={8} />);

    fireEvent.click(screen.getByRole("button", { name: "重新分析素材" }));

    await waitFor(() => {
      expect(
        screen.getByText("Vision provider response is missing JSON content."),
      ).toBeInTheDocument();
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
