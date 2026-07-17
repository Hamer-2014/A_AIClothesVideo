// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { continueReasonLabel, JobContinuePanel } from "./job-continue-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/workspace/template-picker", () => ({
  TemplatePicker: () => <div>template-picker</div>,
}));

vi.mock("@/components/workspace/storyboard-confirmation", () => ({
  StoryboardConfirmation: ({
    moderationPendingMessage,
  }: {
    moderationPendingMessage?: string | null;
  }) => <div>{moderationPendingMessage ?? "storyboard-confirmation"}</div>,
}));

const recommendations = {
  recommended: [],
  optional: [],
  unavailable: [],
  availableTemplateIds: ["front_push_in"],
};

const templateCatalog = [
  {
    templateId: "front_push_in",
    displayName: "正面慢推近",
    description: "展示正面版型",
    riskLevel: "low",
  },
];

describe("JobContinuePanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps human-model turn blockers readable after resuming a job", () => {
    expect(continueReasonLabel("model_side_asset_required")).toBe(
      "缺少模特侧面图",
    );
    expect(continueReasonLabel("model_back_asset_required")).toBe(
      "缺少模特背面图",
    );
    expect(continueReasonLabel("model_view_consistency_failed")).toBe(
      "多角度图片中的模特不一致",
    );
    expect(continueReasonLabel("model_garment_consistency_failed")).toBe(
      "模特视角中的服装不一致",
    );
  });

  it("uses user-facing quality tiers instead of exact resolution values", () => {
    render(
      <JobContinuePanel
        job={{
          id: "job-1",
          status: "asset_analysis_passed",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        }}
        latestStoryboard={null}
        recommendations={recommendations}
        templateCatalog={templateCatalog}
      />,
    );

    expect(
      screen.getByText("付费任务使用高分辨率有声生成与 standard 质检。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/540p|720p|1080p/)).not.toBeInTheDocument();
  });

  it.each([
    "storyboard_confirmed",
    "credits_reserved",
    "segments_queued",
    "segment_generating",
    "stitching_running",
    "post_qa_running",
    "deliverable",
    "failed_refunded",
  ])("does not show continue controls once job status is %s", (status) => {
    render(
      <JobContinuePanel
        job={{
          id: "job-1",
          status,
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        }}
        latestStoryboard={null}
        recommendations={recommendations}
        templateCatalog={templateCatalog}
      />,
    );

    expect(screen.queryByText("继续任务")).not.toBeInTheDocument();
    expect(screen.queryByText("template-picker")).not.toBeInTheDocument();
    expect(screen.queryByText("storyboard-confirmation")).not.toBeInTheDocument();
  });

  it("shows a simple resume panel for real continuation statuses", () => {
    render(
      <JobContinuePanel
        job={{
          id: "job-1",
          status: "asset_analysis_passed",
          durationSeconds: 8,
          aspectRatio: "9:16",
          creditCost: 70,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        }}
        latestStoryboard={null}
        recommendations={recommendations}
        templateCatalog={templateCatalog}
      />,
    );

    expect(screen.getByText("继续生成")).toBeInTheDocument();
    expect(
      screen.getByText("这个任务还停在生成前，你可以补充生成意图后继续。"),
    ).toBeInTheDocument();
    expect(screen.getByText("template-picker")).toBeInTheDocument();
  });

  it("shows five ordered template slots for a 40-second job", () => {
    render(
      <JobContinuePanel
        job={{
          id: "job-40",
          status: "asset_analysis_passed",
          durationSeconds: 40,
          aspectRatio: "9:16",
          creditCost: 310,
          billingMode: "paid",
          generationProfile: "paid_720p_audio",
          watermarkEnabled: false,
        }}
        latestStoryboard={null}
        recommendations={{
          recommended: [],
          optional: [],
          unavailable: [],
          availableTemplateIds: ["front_push_in", "front_pan", "minimal_studio"],
        }}
        templateCatalog={[
          ...templateCatalog,
          {
            templateId: "front_pan",
            displayName: "正面平移",
            description: "横向展示",
            riskLevel: "low",
          },
          {
            templateId: "minimal_studio",
            displayName: "极简棚拍",
            description: "稳定展示",
            riskLevel: "low",
          },
        ]}
      />,
    );

    expect(screen.getAllByRole("combobox", { name: /镜头 [1-5]/ })).toHaveLength(5);
    expect(screen.queryByText("template-picker")).not.toBeInTheDocument();
  });
});
