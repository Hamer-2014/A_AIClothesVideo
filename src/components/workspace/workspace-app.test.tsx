// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reasonLabel, WorkspaceApp } from "./workspace-app";
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
    rightsAccepted,
    onRightsAcceptedChange,
    slots,
  }: {
    onUploaded: (asset: {
      assetId: string;
      fileName: string;
      intendedRole: "front" | "back" | "side" | "detail" | "scene";
      status: "local" | "uploaded";
    }) => void;
    onUploadingChange: (uploading: boolean) => void;
    rightsAccepted: boolean;
    onRightsAcceptedChange: (accepted: boolean) => void;
    slots: Array<{ role: string }>;
  }) => (
    <div
      data-rights-accepted={String(rightsAccepted)}
      data-slot-roles={slots.map((slot) => slot.role).join(",")}
      data-testid="mock-upload-panel"
    >
      <button
        onClick={() => onRightsAcceptedChange(true)}
        type="button"
      >
        mock-accept-rights
      </button>
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
            assetId: "asset-side",
            fileName: "side.jpg",
            intendedRole: "side",
            status: "uploaded",
          })
        }
        type="button"
      >
        mock-upload-side
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
      <button
        onClick={() =>
          onUploaded({
            assetId: "local-back",
            fileName: "guest-back.jpg",
            intendedRole: "back",
            status: "local",
          })
        }
        type="button"
      >
        mock-local-back
      </button>
      <button
        onClick={() =>
          onUploaded({
            assetId: "local-detail",
            fileName: "guest-detail.jpg",
            intendedRole: "detail",
            status: "local",
          })
        }
        type="button"
      >
        mock-local-detail
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
    duration40Enabled,
    durationSeconds,
    onAspectRatioChange,
    onDurationChange,
  }: {
    aspectRatio: "9:16" | "1:1" | "16:9";
    duration40Enabled?: boolean;
    durationSeconds: 8 | 16 | 24 | 40;
    onAspectRatioChange: (aspectRatio: "9:16" | "1:1" | "16:9") => void;
    onDurationChange: (duration: 8 | 16 | 24 | 40) => void;
  }) => (
    <div>
      spec-selector {durationSeconds} {aspectRatio}
      <button onClick={() => onDurationChange(16)} type="button">
        mock-duration-16
      </button>
      <button onClick={() => onDurationChange(24)} type="button">
        mock-duration-24
      </button>
      {duration40Enabled ? (
        <button onClick={() => onDurationChange(40)} type="button">
          mock-duration-40
        </button>
      ) : null}
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
    recommended: Array<{
      displayName: string;
      selectable: boolean;
      reasons?: string[];
    }>;
    optional: Array<{
      displayName: string;
      selectable: boolean;
      reasons?: string[];
    }>;
    unavailable: Array<{
      displayName: string;
      selectable: boolean;
      reasons?: string[];
    }>;
  }) => (
    <div data-testid="mock-template-picker">
      {[...recommended, ...optional, ...unavailable].map((template) => (
        <div
          data-selectable={template.selectable ? "true" : "false"}
          data-reasons={template.reasons?.join(" / ") ?? ""}
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

function preflightPassResponse() {
  return new Response(
    JSON.stringify({
      canCreateJob: true,
      blockingReasons: [],
      warnings: [],
      recommendedTemplateIds: ["front_push_in"],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function preflightRightsBlockedResponse() {
  return new Response(
    JSON.stringify({
      canCreateJob: false,
      blockingReasons: [
        {
          code: "rights_attestation_required",
          message: "请先确认所选素材的版权、肖像与商业使用授权。",
        },
      ],
      warnings: [],
      recommendedTemplateIds: [],
      missingRightsAttestationAssetIds: ["asset-1"],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function uploadProductShowcaseAssets() {
  fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
  fireEvent.click(screen.getByRole("button", { name: "mock-upload-back" }));
  fireEvent.click(screen.getByRole("button", { name: "mock-upload-detail" }));
}

function selectGuestProductShowcaseAssets() {
  fireEvent.click(screen.getByRole("button", { name: "mock-local-front" }));
  fireEvent.click(screen.getByRole("button", { name: "mock-local-back" }));
  fireEvent.click(screen.getByRole("button", { name: "mock-local-detail" }));
}

describe("WorkspaceApp", () => {
  it("uses actionable product rotation reason labels", () => {
    expect(reasonLabel("product_side_asset_required")).toBe(
      "缺少商品侧面图",
    );
    expect(reasonLabel("product_back_asset_required")).toBe(
      "缺少商品背面图",
    );
    expect(reasonLabel("product_view_consistency_failed")).toBe(
      "多角度商品图不是同一件服装",
    );
    expect(reasonLabel("matching_product_views_required")).toBe(
      "多角度商品图尚未通过一致性校验",
    );
  });

  it("uses actionable human-model turn reason labels", () => {
    expect(reasonLabel("model_side_asset_required")).toBe(
      "缺少模特侧面图",
    );
    expect(reasonLabel("model_back_asset_required")).toBe(
      "缺少模特背面图",
    );
    expect(reasonLabel("matching_model_views_required")).toBe(
      "多角度图片中的模特尚未通过一致性校验",
    );
    expect(reasonLabel("model_view_consistency_failed")).toBe(
      "多角度图片中的模特不一致",
    );
    expect(reasonLabel("model_garment_consistency_failed")).toBe(
      "模特视角中的服装不一致",
    );
  });

  it("keeps front-only model motion available without enabling unsupported turns", () => {
    render(
      <WorkspaceApp
        templateCatalog={[
          {
            templateId: "model_front_pose",
            displayName: "模特正面轻微姿态",
            description: "保持正面自然动作。",
            riskLevel: "low",
            requiredAssets: ["model_front"],
          },
          {
            templateId: "model_quarter_turn",
            displayName: "模特轻侧身 15-45°",
            description: "需要正面与侧面模特图。",
            riskLevel: "medium_high",
            requiredAssets: ["model_front", "model_side"],
            consistencyRequirements: ["same_garment", "same_model"],
          },
          {
            templateId: "model_half_turn",
            displayName: "模特连续转身 180°",
            description: "需要正面、侧面与背面模特图。",
            riskLevel: "high",
            requiredAssets: ["model_front", "model_side", "model_back"],
            consistencyRequirements: ["same_garment", "same_model"],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));

    expect(screen.getByText("模特正面轻微姿态")).toHaveAttribute(
      "data-selectable",
      "true",
    );
    expect(screen.getByText("模特轻侧身 15-45°")).toHaveAttribute(
      "data-reasons",
      expect.stringContaining("缺少模特侧面图"),
    );
    expect(screen.getByText("模特连续转身 180°")).toHaveAttribute(
      "data-reasons",
      expect.stringContaining("缺少模特背面图"),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    analyticsMocks.trackFunnelEvent.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("owns an explicit non-persistent rights acceptance state", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    expect(screen.getByTestId("mock-upload-panel")).toHaveAttribute(
      "data-rights-accepted",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "mock-accept-rights" }));
    expect(screen.getByTestId("mock-upload-panel")).toHaveAttribute(
      "data-rights-accepted",
      "true",
    );
  });

  it("requires all three product showcase images before generation", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    expect(screen.getByTestId("mock-upload-panel")).toHaveAttribute(
      "data-slot-roles",
      "front,back,detail",
    );
    const generateButton = screen.getByRole("button", {
      name: "付费生成高清无水印 · 70 点",
    });
    expect(generateButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-back" }));
    expect(generateButton).toBeDisabled();
    expect(screen.getByText("还需上传细节图。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "mock-upload-detail" }));
    expect(generateButton).toBeEnabled();
  });

  it("switches the three slots for product rotation", () => {
    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    fireEvent.click(screen.getByRole("button", { name: /商品旋转/ }));

    expect(screen.getByTestId("mock-upload-panel")).toHaveAttribute(
      "data-slot-roles",
      "front,side,back",
    );
  });

  it("sends capture protocol and sku name through preflight and creation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "stop_after_create" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);
    fireEvent.change(screen.getByLabelText("商品名称或 SKU（可选）"), {
      target: { value: "Linen Dress" },
    });
    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-back" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-detail" }));
    fireEvent.click(
      screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const preflightBody = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    const createBody = JSON.parse(
      (fetchMock.mock.calls[1]?.[1] as RequestInit).body as string,
    );
    expect(preflightBody).toMatchObject({
      captureProtocol: "product_showcase",
      assetIds: ["asset-1", "asset-back", "asset-detail"],
    });
    expect(createBody).toMatchObject({
      captureProtocol: "product_showcase",
      skuName: "Linen Dress",
    });
  });

  it("shows 40-second Beta cost and five-segment summary only when enabled", () => {
    const { rerender } = render(
      <WorkspaceApp duration40Enabled={false} templateCatalog={templateCatalog} />,
    );
    expect(
      screen.queryByRole("button", { name: "mock-duration-40" }),
    ).not.toBeInTheDocument();

    rerender(
      <WorkspaceApp duration40Enabled templateCatalog={templateCatalog} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "mock-duration-40" }));

    expect(screen.getByText(/5 个片段/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "付费生成高清无水印 · 310 点" }),
    ).toBeInTheDocument();
  });

  it("attests historical assets and retries preflight only once", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightRightsBlockedResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            attestationId: "attestation-1",
            assetIds: ["asset-1"],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(preflightRightsBlockedResponse());

    render(<WorkspaceApp templateCatalog={templateCatalog} />);
    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "mock-accept-rights" }));
    fireEvent.click(
      screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }),
    );

    await screen.findByText(
      /生成前检查未通过：请先确认所选素材的版权、肖像与商业使用授权。/,
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/assets/attest-rights",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          assetIds: ["asset-1"],
          rightsAttestation: {
            accepted: true,
            version: "image_rights_v1",
          },
        }),
      }),
    );
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/jobs/preflight"),
    ).toHaveLength(2);
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/jobs"),
    ).toBe(false);
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
    selectGuestProductShowcaseAssets();
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
      captureProtocol: "product_showcase",
      skuName: "",
      userPrompt: "突出连衣裙垂坠感",
      intendedAssetRoles: ["front", "back", "detail"],
      fileNames: ["guest-front.jpg", "guest-back.jpg", "guest-detail.jpg"],
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
      screen.getByText("免费试用仅支持 8 秒。16/24/40 秒请使用付费生成。"),
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

  it("disables generation without a front asset and does not create a job", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    render(
      <WorkspaceApp
        initialMode="trial"
        initialPresetId="marketplace_clean"
        templateCatalog={templateCatalog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock-upload-scene" }));

    expect(
      screen.getByRole("button", { name: /付费生成高清无水印/ }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /免费试用生成/ }),
    ).toBeDisabled();
    expect(
      screen.getByText("还需上传正面主图、背面图、细节图。"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /付费生成高清无水印/ }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/jobs", expect.anything());
  });

  it("explains scene assets are only auxiliary for marketplace clean preset", () => {
    render(
      <WorkspaceApp
        initialPresetId="marketplace_clean"
        templateCatalog={templateCatalog}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));
    fireEvent.click(screen.getByRole("button", { name: "mock-upload-scene" }));

    expect(
      screen.getByText("场景图只作为背景和氛围参考，不作为服装细节来源。"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/正面、背面和细节图制作稳定的商品宣传视频/),
    ).toHaveLength(2);
  });

  it("checks preflight before creating a job", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: "stop_after_create",
            message: "stop after create",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/jobs/preflight",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/jobs",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  it("shows preflight blocking reasons and does not create a job", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          canCreateJob: false,
          blockingReasons: [
            { code: "front_asset_required", message: "后端提示：缺少正面图" },
            "Asset analysis JSON has invalid asset_role.",
          ],
          warnings: [
            { code: "strict_review_required", message: "后端提示：需要严格质检" },
          ],
          recommendedTemplateIds: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    expect(await screen.findByText(/后端提示：缺少正面图/)).toBeInTheDocument();
    expect(
      screen.getByText(/素材角色识别异常，请检查上传图片后重试。/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/front_asset_required/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/后端提示：需要严格质检/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Asset analysis JSON has invalid asset_role./),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/jobs", expect.anything());
  });

  it("shows a material checking status immediately after generation click", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>(() => undefined),
    );

    render(<WorkspaceApp templateCatalog={templateCatalog} />);

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    expect(screen.getByText("正在检查素材...")).toBeInTheDocument();
  });

  it("creates a job and automatically analyzes assets", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        "/api/jobs/preflight",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/jobs",
        expect.objectContaining({
          method: "POST",
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        3,
        "/api/jobs/job-1/analyze",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            mode: "lite",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        4,
        "/api/jobs/job-1",
      );
    });

    expect(window.location.href).toBe("/jobs/job-1");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: location,
    });
  });

  it("hides backend job creation internals behind a generic user-facing message", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
      .mockResolvedValueOnce(
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

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    expect(await screen.findByText("服务暂时异常，请稍后重试。")).toBeInTheDocument();
    expect(
      screen.queryByText('relation "free_trial_usages" does not exist'),
    ).not.toBeInTheDocument();
  });

  it("does not show free trial copy for paid 8 second jobs", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
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
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
      .mockResolvedValueOnce(
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

    uploadProductShowcaseAssets();
    expect(
      screen.getByText("免费试用：低分辨率 · 无音频 · 带水印 · 仅低风险模板"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/540p|720p|1080p/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs/preflight",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1", "asset-back", "asset-detail"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            captureProtocol: "product_showcase",
            skuName: null,
            presetId: "minimal_studio",
            useFreeTrialIfAvailable: false,
            deviceFingerprint: "device-existing",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1", "asset-back", "asset-detail"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            captureProtocol: "product_showcase",
            skuName: null,
            presetId: "minimal_studio",
            useFreeTrialIfAvailable: false,
            deviceFingerprint: "device-existing",
          }),
        }),
      );
    });

    fetchMock.mockClear();
    fetchMock
      .mockResolvedValueOnce(preflightPassResponse())
      .mockResolvedValueOnce(
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
        "/api/jobs/preflight",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1", "asset-back", "asset-detail"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            captureProtocol: "product_showcase",
            skuName: null,
            presetId: "minimal_studio",
            useFreeTrialIfAvailable: true,
            deviceFingerprint: "device-existing",
          }),
        }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/jobs",
        expect.objectContaining({
          body: JSON.stringify({
            assetIds: ["asset-1", "asset-back", "asset-detail"],
            durationSeconds: 8,
            aspectRatio: "9:16",
            captureProtocol: "product_showcase",
            skuName: null,
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

    fireEvent.click(screen.getByRole("button", { name: "mock-upload" }));

    const mainStage = screen.getByTestId("workspace-main-stage");
    const materialPanel = screen.getByTestId("workspace-material-panel");
    const controlRail = screen.getByTestId("workspace-control-rail");
    const panelHeaders = screen.getAllByTestId("workspace-panel-header");
    const generateButton = screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" });

    expect(mainStage).toBeInTheDocument();
    expect(mainStage.className).toContain("xl:min-h-[calc(100svh-13rem)]");
    expect(mainStage.className).toContain("xl:items-stretch");
    expect(mainStage.className).toContain(
      "xl:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]",
    );
    expect(mainStage.firstElementChild).toBe(materialPanel);
    expect(mainStage.lastElementChild).toBe(controlRail);
    expect(panelHeaders).toHaveLength(2);
    panelHeaders.forEach((header) => {
      expect(header.className).toContain("min-h-16");
    });
    expect(materialPanel).toBeInTheDocument();
    expect(materialPanel.className).toContain("rounded-[var(--radius-lg)]");
    expect(materialPanel.className).toContain("bg-[var(--surface-subtle)]");
    expect(materialPanel.className).toContain("xl:min-h-full");
    expect(controlRail).toBeInTheDocument();
    expect(controlRail.className).toContain("bg-[var(--surface-raised)]");
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
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
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
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
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
        6,
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
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
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
        7,
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

  it("keeps generated draft confirmation hidden until the operator opens advanced settings after auto submit fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await screen.findByText(
      /视频生成服务未完成模型路由配置，请联系管理员检查 development 环境的 video_generation route。/,
    );
    expect(
      screen.queryByRole("button", { name: "确认分镜并生成" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("高级设置 / 手动预览分镜"));
    expect(
      screen.getByRole("button", { name: "确认分镜并生成" }),
    ).toBeInTheDocument();
  });

  it("uses backend preset-ranked template order for one-click generation", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(preflightPassResponse())
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

    uploadProductShowcaseAssets();
    fireEvent.click(screen.getByRole("button", { name: "付费生成高清无水印 · 70 点" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(
        5,
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
