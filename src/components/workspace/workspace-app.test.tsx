// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceApp } from "./workspace-app";

vi.mock("./upload-panel", () => ({
  UploadPanel: ({
    onUploaded,
    onUploadingChange,
  }: {
    onUploaded: (asset: {
      assetId: string;
      fileName: string;
      intendedRole: "front" | "back" | "detail";
      status: "uploaded";
    }) => void;
    onUploadingChange: (uploading: boolean) => void;
  }) => (
    <div>
      <button
        onClick={() =>
          onUploaded({
            assetId: "asset-1",
            fileName: "front.jpg",
            intendedRole: "front",
            status: "uploaded",
          })
        }
        type="button"
      >
        mock-upload
      </button>
      <button
        onClick={() =>
          onUploaded({
            assetId: "asset-back",
            fileName: "back.jpg",
            intendedRole: "back",
            status: "uploaded",
          })
        }
        type="button"
      >
        mock-upload-back
      </button>
      <button
        onClick={() =>
          onUploaded({
            assetId: "asset-detail",
            fileName: "detail.jpg",
            intendedRole: "detail",
            status: "uploaded",
          })
        }
        type="button"
      >
        mock-upload-detail
      </button>
      <button onClick={() => onUploadingChange(true)} type="button">
        mock-uploading
      </button>
    </div>
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
  TemplatePicker: ({
    recommended,
    optional,
    unavailable,
  }: {
    recommended: Array<{ displayName: string; selectable: boolean }>;
    optional: Array<{ displayName: string; selectable: boolean }>;
    unavailable: Array<{ displayName: string; selectable: boolean }>;
  }) => (
    <div>
      {[...recommended, ...optional, ...unavailable].map((template) => (
        <div
          data-selectable={template.selectable ? "true" : "false"}
          key={template.displayName}
        >
          {template.displayName}
        </div>
      ))}
    </div>
  ),
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
  {
    templateId: "back_display",
    displayName: "背面展示",
    description: "展示背面版型",
    riskLevel: "medium",
    requiredAssets: ["back"],
  },
  {
    templateId: "fabric_macro",
    displayName: "面料微距",
    description: "展示面料质感",
    riskLevel: "medium",
    requiredAssets: ["detail"],
    detailTypes: ["fabric"],
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            storyboardId: "storyboard-1",
            segments: [
              {
                index: 0,
                durationSeconds: 8,
                templateId: "front_push_in",
                prompt: "front prompt",
              },
            ],
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
            jobId: "job-1",
            storyboardId: "storyboard-1",
            status: "segment_generating",
            reservedLedgerId: null,
            segmentCount: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "生成视频 · 将冻结 70 点" }));

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

    expect(window.location.href).toBe("/jobs/job-1");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
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
    fireEvent.click(screen.getByRole("button", { name: "生成视频 · 将冻结 70 点" }));

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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            storyboardId: "storyboard-1",
            segments: [
              {
                index: 0,
                durationSeconds: 8,
                templateId: "front_push_in",
                prompt: "front prompt",
              },
            ],
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
            jobId: "job-1",
            storyboardId: "storyboard-1",
            status: "segment_generating",
            reservedLedgerId: "ledger-1",
            segmentCount: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "生成视频 · 将冻结 70 点" }));

    await waitFor(() => {
      expect(window.location.href).toBe("/jobs/job-1");
    });
    expect(
      screen.queryByText("免费试用默认使用低风险模板与 lite 质检。"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/540p|720p|1080p/)).not.toBeInTheDocument();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
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
    fireEvent.click(screen.getByRole("button", { name: "生成视频 · 将冻结 70 点" }));

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

  it("prevents generation while selected images are still uploading", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-uploading" }));

    const generateButton = screen.getByRole("button", { name: "图片上传中..." });
    expect(generateButton).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unlocks matching template intent immediately after slot uploads", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    expect(screen.getByText("创建任务后会自动分析素材，失败时可在这里重试。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-back" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-detail" }));

    expect(screen.getByText("背面展示")).toHaveAttribute("data-selectable", "true");
    expect(screen.getByText("面料微距")).toHaveAttribute("data-selectable", "true");
    expect(screen.getByText("基于已上传素材位预估模板，生成前会再次分析校验。")).toBeInTheDocument();
  });

  it("runs the default one-click generation chain after upload", async () => {
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
              recommended: [{ templateId: "front_push_in", riskLevel: "low", riskWarnings: [] }],
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
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            storyboardId: "storyboard-1",
            segments: [
              {
                index: 0,
                durationSeconds: 8,
                templateId: "front_push_in",
                prompt: "front prompt",
              },
            ],
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
            jobId: "job-1",
            storyboardId: "storyboard-1",
            status: "segment_generating",
            reservedLedgerId: "ledger-1",
            segmentCount: 1,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "生成视频 · 将冻结 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/jobs/job-1/storyboard",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            selectedTemplateIds: ["front_push_in"],
            userPrompt: "保持服装版型稳定，适合商品页宣传。",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
        "/api/jobs/job-1/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            storyboardId: "storyboard-1",
          }),
        }),
      );
    });
    expect(window.location.href).toBe("/jobs/job-1");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
  });
});
