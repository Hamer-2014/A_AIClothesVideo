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
  SpecSelector: ({
    durationSeconds,
  }: {
    durationSeconds: 8 | 16 | 24;
  }) => <div>spec-selector {durationSeconds}</div>,
}));

vi.mock("./template-picker", () => ({
  TemplatePicker: () => <div>template-picker</div>,
}));

vi.mock("./storyboard-confirmation", () => ({
  StoryboardConfirmation: ({
    moderationPendingMessage,
  }: {
    moderationPendingMessage?: string | null;
  }) => <div>{moderationPendingMessage ?? "storyboard-confirmation"}</div>,
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
              billingMode: "free_trial",
              generationProfile: "trial_540p_watermarked",
              watermarkEnabled: true,
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成 · 扣 70 点" }));

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
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/jobs/job-1",
      );
    });

    expect(screen.getByText("素材分析完成，请确认模板。")).toBeInTheDocument();
  });

  it("shows backend job creation errors instead of a generic material/spec message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "job_creation_failed",
          message: 'relation "free_trial_usages" does not exist',
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "付费生成 · 扣 70 点" }));

    expect(
      await screen.findByText('relation "free_trial_usages" does not exist'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("创建任务失败，请检查素材和规格。"),
    ).not.toBeInTheDocument();
  });

  it("does not show free trial copy for paid 8 second jobs", async () => {
    vi.spyOn(globalThis, "fetch")
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
        new Response(JSON.stringify({ jobId: "job-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
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
              creditCost: 70,
              billingMode: "paid",
              generationProfile: "paid_720p_audio",
              watermarkEnabled: false,
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成 · 扣 70 点" }));

    expect(
      await screen.findByText("付费任务使用高分辨率有声生成与 standard 质检。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("免费试用默认使用低风险模板与 lite 质检。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/540p|720p|1080p/)).not.toBeInTheDocument();
  });

  it("uses paid generation by default and only requests free trial from the free trial button", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "job_creation_failed",
          message: "stop after first request",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    expect(
      screen.getByText("免费试用：低分辨率 · 无音频 · 带水印 · 仅低风险模板"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/540p|720p|1080p/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "付费生成 · 扣 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            useFreeTrialIfAvailable: false,
          }),
        }),
      );
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: "free_trial_unavailable",
          message: "免费试用暂不可用，请选择付费生成。",
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "免费试用" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            useFreeTrialIfAvailable: true,
          }),
        }),
      );
    });
    expect(
      await screen.findByText("免费试用暂不可用，请选择付费生成。"),
    ).toBeInTheDocument();
  });
});
