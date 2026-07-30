// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mvpShotTemplates } from "@/lib/templates/catalog";

import { StoryboardConfirmation } from "./storyboard-confirmation";
import { TemplateSlotEditor } from "./template-slot-editor";
import { TrialStatusPanel } from "./trial-status-panel";
import {
  jobDetailMessage,
  reasonLabel,
  WorkspaceApp,
} from "./workspace-app";

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: vi.fn(),
}));

const cjkPattern = /[\u3400-\u9fff]/;

describe("workspace localization", () => {
  afterEach(() => cleanup());

  it("renders the complete initial workspace surface in English", () => {
    const { container } = render(
      <WorkspaceApp
        isAuthenticated={false}
        language="en"
        templateCatalog={mvpShotTemplates}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Create a product video" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Product showcase/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Generation intent")).toHaveValue(
      "Highlight the garment silhouette and overall shape with a clean background and stable camera movement. Avoid exaggerated motion.",
    );
    expect(container.innerHTML).not.toMatch(cjkPattern);
  });

  it("keeps the explicit Chinese workspace surface", () => {
    render(
      <WorkspaceApp language="zh-CN" templateCatalog={mvpShotTemplates} />,
    );

    expect(
      screen.getByRole("heading", { name: "创建商品短视频" }),
    ).toBeInTheDocument();
  });

  it("localizes template availability reasons", () => {
    expect(reasonLabel("product_side_asset_required", "en")).toBe(
      "Product side image required",
    );
    expect(reasonLabel("model_view_consistency_failed", "en")).toBe(
      "The model differs across views",
    );
  });

  it("does not expose Chinese or internal job errors on the English workspace", () => {
    expect(
      jobDetailMessage(
        { failureReason: "素材分析失败", lastError: null },
        "en",
      ),
    ).toBe(
      "Image analysis is complete. Review the available templates and image requirements.",
    );
    expect(
      jobDetailMessage(
        { failureReason: null, lastError: "Provider timeout" },
        "en",
      ),
    ).toBe("Provider timeout");
  });

  it("localizes secondary workspace panels", () => {
    const trial = render(
      <TrialStatusPanel
        language="en"
        status={{
          state: "available",
          message: "你有 1 次免费试用，可生成 8 秒带水印视频。",
          limits: {
            durationSeconds: 8,
            qualityLabel: "低分辨率",
            audioLabel: "无音频",
            watermarkEnabled: true,
          },
        }}
      />,
    );
    expect(trial.container.innerHTML).not.toMatch(cjkPattern);
    expect(screen.getByText("Free trial available")).toBeInTheDocument();
    cleanup();

    const storyboard = render(
      <StoryboardConfirmation
        aspectRatio="9:16"
        creditCost={70}
        durationSeconds={8}
        language="en"
        onConfirm={vi.fn()}
        segments={[]}
      />,
    );
    expect(storyboard.container.innerHTML).not.toMatch(cjkPattern);
    expect(
      screen.getByRole("button", { name: "Confirm storyboard and generate" }),
    ).toBeInTheDocument();
    cleanup();

    const slots = render(
      <TemplateSlotEditor
        language="en"
        onChange={vi.fn()}
        options={[{ templateId: "front_push_in", label: "Front push-in" }]}
        slots={["front_push_in"]}
      />,
    );
    expect(slots.container.innerHTML).not.toMatch(cjkPattern);
    expect(screen.getByRole("combobox", { name: "Shot 1" })).toBeInTheDocument();
  });
});
