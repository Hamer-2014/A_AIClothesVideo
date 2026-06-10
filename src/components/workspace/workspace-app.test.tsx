// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceApp } from "./workspace-app";

vi.mock("./upload-panel", () => ({
  UploadPanel: ({
    onUploaded,
  }: {
    onUploaded: (asset: {
      assetId: string;
      fileName: string;
      status: "uploaded";
    }) => void;
  }) => (
    <button
      onClick={() =>
        onUploaded({
          assetId: "asset-1",
          fileName: "front.jpg",
          status: "uploaded",
        })
      }
      type="button"
    >
      mock-upload
    </button>
  ),
}));

vi.mock("./spec-selector", () => ({
  SpecSelector: () => <div>spec-selector</div>,
}));

vi.mock("./template-picker", () => ({
  TemplatePicker: () => <div>template-picker</div>,
}));

vi.mock("./storyboard-confirmation", () => ({
  StoryboardConfirmation: () => <div>storyboard-confirmation</div>,
}));

const templateCatalog = [
  {
    templateId: "front_push_in",
    displayName: "正面慢推近",
    description: "展示正面版型",
    riskLevel: "low",
  },
];

describe("WorkspaceApp", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a job and automatically analyzes assets", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job-1",
            status: "asset_analysis_queued",
            userVisibleStatus: "analyzing_assets",
            assetCount: 1,
          }),
          {
            status: 201,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job-1",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            job: {
              id: "job-1",
              status: "asset_analysis_passed",
              userVisibleStatus: "assets_ready",
              lastError: null,
              failureReason: null,
              durationSeconds: 8,
              aspectRatio: "9:16",
              creditCost: 0,
            },
            assetCount: 1,
            acceptable: true,
            assetCompleteness: {
              hasFront: true,
              hasBack: false,
              hasSide: false,
              hasDetail: false,
              hasScene: false,
              hasModelFront: false,
              hasFlatLayOrWhiteBackground: true,
              detailTypes: [],
            },
            recommendations: {
              recommended: [],
              optional: [],
              unavailable: [],
              availableTemplateIds: ["front_push_in"],
            },
            latestStoryboard: null,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/jobs",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/jobs/job-1/analyze",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mode: "lite",
            isTrial: true,
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/jobs/job-1?trial=true",
      );
    });

    expect(screen.getByText("素材分析完成，请确认模板。")).toBeInTheDocument();
  });
});
