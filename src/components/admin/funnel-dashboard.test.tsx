// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FunnelDashboard } from "./funnel-dashboard";

describe("FunnelDashboard", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders MVP stats cards and preset table", () => {
    render(
      <FunnelDashboard
        summary={{
          eventCounts: [
            { eventName: "workspace_entered", count: 10 },
            { eventName: "job_created", count: 4 },
            { eventName: "generation_deliverable", count: 3 },
          ],
          conversions: [
            {
              key: "workspace_to_upload",
              label: "Workspace -> Upload",
              numerator: 6,
              denominator: 10,
              rate: 0.6,
            },
            {
              key: "guest_generate_to_draft_restored",
              label: "Guest Generate -> Draft Restored",
              numerator: 5,
              denominator: 8,
              rate: 0.625,
            },
          ],
          presetSummary: [
            {
              presetId: "minimal_studio",
              jobCount: 3,
              deliverableCount: 2,
              failedCount: 1,
              downloadCount: 2,
            },
          ],
          generatedAt: "2026-06-17T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Funnel Summary")).toBeInTheDocument();
    expect(screen.getByText("workspace_entered")).toBeInTheDocument();
    expect(screen.getByText("Workspace -> Upload")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    expect(screen.getByText("Guest Generate -> Draft Restored")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("Preset Summary")).toBeInTheDocument();
    expect(screen.getByText("minimal_studio")).toBeInTheDocument();
  });
});
