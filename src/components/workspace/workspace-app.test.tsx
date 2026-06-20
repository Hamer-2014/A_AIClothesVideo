// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceApp } from "./workspace-app";
import { WORKSPACE_GUEST_DRAFT_KEY } from "@/lib/workspace/guest-draft";

const analyticsMocks = vi.hoisted(() => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: analyticsMocks.trackFunnelEvent,
}));

vi.mock("./upload-panel", () => ({
  UploadPanel: ({
    onUploaded,
    onUploadingChange,
  }: {
    onUploaded: (asset: {
      assetId: string;
      fileName: string;
      intendedRole: "front" | "back" | "detail" | "scene";
      status: "local" | "uploaded";
    }) => void;
    onUploadingChange: (uploading: boolean) => void;
  }) => (
    <div data-testid="mock-upload-panel">
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
      <button
        onClick={() =>
          onUploaded({
            assetId: "asset-scene",
            fileName: "scene.jpg",
            intendedRole: "scene",
            status: "uploaded",
          })
        }
        type="button"
      >
        mock-upload-scene
      </button>
      <button
        onClick={() =>
          onUploaded({
            assetId: "local-front",
            fileName: "guest-front.jpg",
            intendedRole: "front",
            status: "local",
          })
        }
        type="button"
      >
        mock-local-front
      </button>
      <button onClick={() => onUploadingChange(true)} type="button">
        mock-uploading
      </button>
    </div>
  ),
}));

vi.mock("./spec-selector", () => ({
  SpecSelector: ({
    aspectRatio,
    durationSeconds,
    onAspectRatioChange,
    onDurationChange,
  }: {
    aspectRatio: "9:16" | "1:1" | "16:9";
    durationSeconds: 8 | 16 | 24;
    onAspectRatioChange: (aspectRatio: "9:16" | "1:1" | "16:9") => void;
    onDurationChange: (duration: 8 | 16 | 24) => void;
  }) => (
    <div>
      spec-selector {durationSeconds} {aspectRatio}
      <button onClick={() => onDurationChange(16)} type="button">
        mock-duration-16
      </button>
      <button onClick={() => onDurationChange(24)} type="button">
        mock-duration-24
      </button>
      <button onClick={() => onAspectRatioChange("1:1")} type="button">
        mock-aspect-1-1
      </button>
    </div>
  ),
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
    <div data-testid="mock-template-picker">
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
    creditCost,
    disabled,
    moderationPendingMessage,
    onConfirm,
    segments,
  }: {
    creditCost: number;
    disabled?: boolean;
    moderationPendingMessage?: string | null;
    onConfirm: () => void;
    segments: Array<{ prompt: string }>;
  }) => (
    <div>
      <h3>分镜确认</h3>
      <p>{creditCost} 点</p>
      <p>{moderationPendingMessage ?? "storyboard-confirmation"}</p>
      {segments.map((segment) => (
        <p key={segment.prompt}>{segment.prompt}</p>
      ))}
      <button disabled={disabled} onClick={onConfirm} type="button">
        确认分镜并生成
      </button>
    </div>
  ),
}));

vi.mock("./trial-status-panel", () => ({
  TrialStatusPanel: ({
    status,
  }: {
    status: { state: string; message: string };
  }) => (
    <div data-testid="mock-trial-status-panel">
      {status.state}:{status.message}
    </div>
  ),
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
  {
    templateId: "scene_lifestyle_showcase",
    displayName: "场景氛围展示",
    description: "使用场景图作为背景参考",
    riskLevel: "medium",
    requiredAssets: ["front", "scene"],
  },
];

describe("WorkspaceApp", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    analyticsMocks.trackFunnelEvent.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("saves a guest draft and redirects to login without creating a job", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    });

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="marketplace_clean"
        isAuthenticated={false}
        loginHref="/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dmarketplace_clean%26resumeDraft%3D1"
        templateCatalog={templateCatalog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock-duration-16" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-aspect-1-1" }));
    fireEvent.change(screen.getByLabelText("生成意图"), {
      target: { value: "突出连衣裙垂坠感" },
    });
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 130 点" }));

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/jobs",
      expect.anything(),
    );
    expect(JSON.parse(window.sessionStorage.getItem(WORKSPACE_GUEST_DRAFT_KEY) ?? "{}")).toEqual({
      mode: "paid",
      presetId: "marketplace_clean",
      durationSeconds: 16,
      aspectRatio: "1:1",
      userPrompt: "突出连衣裙垂坠感",
      intendedAssetRoles: [],
      fileNames: [],
    });
    expect(window.location.href).toBe(
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dmarketplace_clean%26resumeDraft%3D1",
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "guest_config_changed",
      expect.objectContaining({
        presetId: "marketplace_clean",
        durationSeconds: 16,
        aspectRatio: "9:16",
        mode: "trial",
      }),
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "guest_config_changed",
      expect.objectContaining({
        presetId: "marketplace_clean",
        durationSeconds: 16,
        aspectRatio: "1:1",
        mode: "trial",
      }),
    );
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "guest_generate_clicked",
      expect.objectContaining({
        presetId: "marketplace_clean",
        durationSeconds: 16,
        aspectRatio: "1:1",
        mode: "paid",
        sourcePage: "workspace",
      }),
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
  });

  it("restores a saved guest draft for authenticated users and asks them to reselect images", async () => {
    window.sessionStorage.setItem(
      WORKSPACE_GUEST_DRAFT_KEY,
      JSON.stringify({
        mode: "paid",
        presetId: "social_lifestyle",
        durationSeconds: 24,
        aspectRatio: "1:1",
        userPrompt: "恢复后的卖点文案",
        intendedAssetRoles: ["front"],
        fileNames: ["front.jpg"],
      }),
    );

    render(
      <WorkspaceApp
        initialMode="paid"
        initialPresetId="minimal_studio"
        templateCatalog={templateCatalog}
      />,
    );

    expect(await screen.findByRole("button", { name: /社媒氛围短片/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("spec-selector 24 1:1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("恢复后的卖点文案")).toBeInTheDocument();
    expect(
      screen.getByText("已恢复刚才的配置，请重新选择图片后生成。"),
    ).toBeInTheDocument();
    expect(window.sessionStorage.getItem(WORKSPACE_GUEST_DRAFT_KEY)).toBeNull();
    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "guest_draft_restored",
      expect.objectContaining({
        presetId: "social_lifestyle",
        durationSeconds: 24,
        aspectRatio: "1:1",
        mode: "paid",
        draftRestored: true,
      }),
    );
  });

  it("does not request trial status in guest mode", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="minimal_studio"
        isAuthenticated={false}
        loginHref="/login?next=%2Fworkspace%3Fmode%3Dtrial%26resumeDraft%3D1"
        templateCatalog={templateCatalog}
      />,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses guest local selections for template preview without calling them uploaded", () => {
    render(
      <WorkspaceApp
        initialMode="paid"
        isAuthenticated={false}
        loginHref="/login?next=%2Fworkspace%3FresumeDraft%3D1"
        templateCatalog={templateCatalog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock-local-front" }));

    expect(analyticsMocks.trackFunnelEvent).toHaveBeenCalledWith(
      "guest_asset_selected",
      expect.objectContaining({
        presetId: "minimal_studio",
        assetRole: "front",
        sourcePage: "workspace",
      }),
    );
    expect(screen.getByText("正面慢推近")).toHaveAttribute(
      "data-selectable",
      "true",
    );
    expect(screen.getByText("Front").nextElementSibling).toHaveTextContent(
      "已选择",
    );
    expect(
      screen.getByText(
        "基于已选择素材位预估模板，登录后需要重新选择图片并正式上传。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("基于已上传素材位预估模板，生成前会再次分析校验。"),
    ).not.toBeInTheDocument();
  });

  it("requests trial status with the existing device fingerprint on trial entry", async () => {
    window.localStorage.setItem("runwaytools_device_id", "device-existing");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "available",
          message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
          limits: {
            durationSeconds: 8,
            qualityLabel: "低分辨率",
            audioLabel: "无音频",
            watermarkEnabled: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="minimal_studio"
        templateCatalog={templateCatalog}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/trial/status?deviceFingerprint=device-existing",
      );
    });
  });

  it("shows available trial status and keeps paid generation as a separate CTA", async () => {
    window.localStorage.setItem("runwaytools_device_id", "device-existing");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "available",
          message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
          limits: {
            durationSeconds: 8,
            qualityLabel: "低分辨率",
            audioLabel: "无音频",
            watermarkEnabled: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="minimal_studio"
        templateCatalog={templateCatalog}
      />,
    );

    expect(
      await screen.findByTestId("mock-trial-status-panel"),
    ).toHaveTextContent("available:你有 1 次免费试用，可生成 8 秒带水印视频。");
    expect(
      screen.getByRole("button", { name: "免费试用生成 · 8 秒带水印" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }),
    ).toBeInTheDocument();
  });

  it("keeps paid generation available when trial status is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "unavailable",
          message: "当前账号暂时无法使用免费试用，可以购买点数继续生成。",
          limits: null,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="minimal_studio"
        templateCatalog={templateCatalog}
      />,
    );

    expect(
      await screen.findByTestId("mock-trial-status-panel"),
    ).toHaveTextContent(
      "unavailable:当前账号暂时无法使用免费试用，可以购买点数继续生成。",
    );
    expect(
      screen.queryByRole("button", { name: "免费试用生成 · 8 秒带水印" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }),
    ).toBeInTheDocument();
  });

  it("does not show the free trial CTA for 16 or 24 second specs", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          state: "available",
          message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
          limits: {
            durationSeconds: 8,
            qualityLabel: "低分辨率",
            audioLabel: "无音频",
            watermarkEnabled: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="minimal_studio"
        templateCatalog={templateCatalog}
      />,
    );

    await screen.findByTestId("mock-trial-status-panel");
    fireEvent.click(screen.getByRole("button", { name: "mock-duration-16" }));

    expect(
      screen.queryByRole("button", { name: "免费试用生成 · 8 秒带水印" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("免费试用仅支持 8 秒。16/24 秒请使用付费生成。"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "付费生成高清无水印 · 130 点" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "mock-duration-24" }));
    expect(
      screen.queryByRole("button", { name: "免费试用生成 · 8 秒带水印" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "付费生成高清无水印 · 190 点" }),
    ).toBeInTheDocument();
  });

  it("uses query preset defaults for trial workspace entry", () => {
    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="marketplace_clean"
        templateCatalog={templateCatalog}
      />,
    );

    expect(screen.getByText("电商主图动效")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /电商主图动效/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByDisplayValue(/商品主图可售卖感/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "免费试用生成 · 8 秒带水印" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

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
    window.localStorage.setItem("runwaytools_device_id", "device-existing");
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            presetId: "minimal_studio",
            useFreeTrialIfAvailable: false,
            deviceFingerprint: "device-existing",
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

    fireEvent.click(screen.getByRole("button", { name: "免费试用生成 · 8 秒带水印" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            presetId: "minimal_studio",
            useFreeTrialIfAvailable: true,
            deviceFingerprint: "device-existing",
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

  it("keeps storyboard confirmation and manual draft controls out of the default workspace", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    expect(screen.queryByText("分镜确认")).not.toBeInTheDocument();
    expect(screen.queryByText("0 点")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "生成分镜草稿" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "确认分镜并生成" }),
    ).not.toBeInTheDocument();
  });

  it("puts the material canvas and generation controls into a task-first workspace layout", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    const mainStage = screen.getByTestId("workspace-main-stage");
    const materialPanel = screen.getByTestId("workspace-material-panel");
    const controlRail = screen.getByTestId("workspace-control-rail");
    const panelHeaders = screen.getAllByTestId("workspace-panel-header");
    const generateButton = screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" });

    expect(mainStage).toBeInTheDocument();
    expect(mainStage.className).toContain("xl:min-h-[calc(100svh-13rem)]");
    expect(mainStage.className).toContain("xl:items-stretch");
    expect(mainStage.className).toContain("xl:grid-cols-[minmax(400px,432px)_minmax(0,1fr)]");
    expect(mainStage.firstElementChild).toBe(controlRail);
    expect(mainStage.lastElementChild).toBe(materialPanel);
    expect(panelHeaders).toHaveLength(2);
    panelHeaders.forEach((header) => {
      expect(header.className).toContain("min-h-16");
    });
    expect(materialPanel).toBeInTheDocument();
    expect(materialPanel.className).toContain("rounded-lg");
    expect(materialPanel.className).toContain("bg-[var(--surface)]");
    expect(materialPanel.className).toContain("xl:min-h-full");
    expect(controlRail).toBeInTheDocument();
    expect(controlRail.className).toContain("bg-[var(--surface)]");
    expect(controlRail.className).toContain("xl:min-h-full");
    expect(controlRail.className).not.toContain("sticky");
    expect(materialPanel.className).not.toContain("sticky");
    expect(screen.getByTestId("workspace-deferred-analysis")).toBeInTheDocument();
    expect(screen.getByTestId("mock-upload-panel")).toBeInTheDocument();
    expect(screen.getByText("生成意图")).toBeInTheDocument();
    expect(generateButton).toBeInTheDocument();
    expect(generateButton.className).toContain("bg-[var(--accent)]");
    expect(generateButton.className).not.toContain("bg-[var(--ink)]");
  });

  it("does not show non-garment warnings for scene assets", async () => {
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
            assetCount: 2,
            acceptable: true,
            assetCompleteness: {
              hasFront: true,
              hasBack: false,
              hasSide: false,
              hasDetail: false,
              hasScene: true,
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
            analyses: [
              {
                assetId: "asset-front",
                declaredRole: "front",
                assetRole: "front",
                quality: {
                  isGarment: true,
                  isClear: true,
                  isSafe: true,
                  hasFlatLayOrWhiteBackground: true,
                },
                confidence: "high",
                riskFlags: [],
              },
              {
                assetId: "asset-scene",
                declaredRole: "scene",
                assetRole: "unknown",
                quality: {
                  isGarment: false,
                  isClear: true,
                  isSafe: true,
                  hasFlatLayOrWhiteBackground: false,
                },
                confidence: "low",
                riskFlags: ["environmental scene"],
              },
            ],
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
            error: "generation_route_unavailable",
            message: "视频生成服务未完成模型路由配置，请联系管理员检查 development 环境的 video_generation route。",
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(screen.getByText("正面慢推近")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("有素材不像服装图，相关模板会被降级。"),
    ).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/jobs/job-1/storyboard",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            selectedTemplateIds: ["front_push_in"],
            presetId: "minimal_studio",
            userPrompt: "突出服装版型和整体轮廓，使用干净背景和稳定镜头，避免夸张动作。",
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

  it("keeps manual storyboard preview available behind advanced settings after analysis", async () => {
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
            analyses: [],
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
            error: "prompt_moderation_unavailable",
          }),
          {
            status: 503,
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
                prompt: "manual preview prompt",
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
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await screen.findByText("审核服务暂时不可用，请稍后再试。");
    expect(
      screen.queryByRole("button", { name: "生成分镜草稿" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("高级设置 / 手动预览分镜"));
    fireEvent.click(screen.getByRole("button", { name: "生成分镜草稿" }));

    await screen.findByText("manual preview prompt");
    fireEvent.click(screen.getByRole("button", { name: "确认分镜并生成" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        6,
        "/api/jobs/job-1/confirm",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            storyboardId: "storyboard-1",
          }),
        }),
      );
      expect(window.location.href).toBe("/jobs/job-1");
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
  });

  it("uses backend preset-ranked template order for one-click generation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jobId: "job-1",
            status: "asset_analysis_queued",
            userVisibleStatus: "analyzing_assets",
            assetCount: 2,
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
            assetCount: 2,
            acceptable: true,
            assetCompleteness: {
              hasFront: true,
              hasBack: false,
              hasSide: false,
              hasDetail: false,
              hasScene: true,
              hasModelFront: false,
              hasFlatLayOrWhiteBackground: false,
              detailTypes: [],
            },
            recommendations: {
              recommended: [
                { templateId: "front_push_in", riskLevel: "low", riskWarnings: [] },
              ],
              optional: [
                {
                  templateId: "scene_lifestyle_showcase",
                  riskLevel: "medium",
                  riskWarnings: [],
                },
              ],
              unavailable: [],
              availableTemplateIds: ["front_push_in", "scene_lifestyle_showcase"],
            },
            analyses: [
              {
                assetId: "asset-front",
                declaredRole: "front",
                assetRole: "front",
                quality: {
                  isGarment: true,
                  isClear: true,
                  isSafe: true,
                },
                confidence: "high",
                riskFlags: [],
              },
              {
                assetId: "asset-scene",
                declaredRole: "scene",
                assetRole: "unknown",
                quality: {
                  isGarment: false,
                  isClear: true,
                  isSafe: true,
                },
                confidence: "low",
                riskFlags: [],
              },
            ],
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
                templateId: "scene_lifestyle_showcase",
                prompt: "scene prompt",
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
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-scene" }));
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/jobs/job-1/storyboard",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            selectedTemplateIds: ["front_push_in"],
            presetId: "minimal_studio",
            userPrompt: "突出服装版型和整体轮廓，使用干净背景和稳定镜头，避免夸张动作。",
          }),
        }),
      );
    });

    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
  });
});
