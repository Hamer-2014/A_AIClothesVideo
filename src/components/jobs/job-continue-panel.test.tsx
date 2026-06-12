// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JobContinuePanel } from "./job-continue-panel";

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
});
