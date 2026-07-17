// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TemplatePicker, type TemplateAvailabilityCard } from "./template-picker";

const recommended: TemplateAvailabilityCard[] = [
  {
    templateId: "front_push_in",
    displayName: "正面慢推近",
    description: "低风险展示正面版型。",
    riskLevel: "low",
    selectable: true,
    selected: true,
  },
];

const optional: TemplateAvailabilityCard[] = [
  {
    templateId: "back_display",
    displayName: "背面展示",
    description: "需要背面素材时展示背面版型。",
    riskLevel: "medium",
    selectable: true,
    selected: false,
    warnings: ["需严格质检"],
  },
];

const unavailable: TemplateAvailabilityCard[] = [
  {
    templateId: "fabric_macro",
    displayName: "面料微距",
    description: "需要面料细节图。",
    riskLevel: "medium",
    selectable: false,
    selected: false,
    reasons: ["缺少细节图"],
  },
];

describe("TemplatePicker", () => {
  afterEach(() => {
    cleanup();
  });

  it("prioritizes recommended templates and keeps unavailable templates collapsed by default", () => {
    render(
      <TemplatePicker
        onToggle={vi.fn()}
        optional={optional}
        recommended={recommended}
        unavailable={unavailable}
      />,
    );

    const recommendedRegion = screen.getByRole("region", { name: "推荐模板" });
    expect(recommendedRegion).toHaveAttribute("data-priority", "primary");
    expect(within(recommendedRegion).getByText("正面慢推近")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "展开可选模板 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "展开不可用模板 1" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("面料微距")).not.toBeInTheDocument();
  });

  it("uses a soft selected state instead of an all-black selected card", () => {
    render(
      <TemplatePicker
        onToggle={vi.fn()}
        optional={optional}
        recommended={recommended}
        unavailable={unavailable}
      />,
    );

    const selected = screen.getByRole("button", { name: /正面慢推近/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(selected.className).toContain("ring");
    expect(selected.className).not.toContain("bg-[var(--ink)]");
    expect(selected.className).not.toContain("text-white");
  });

  it("reveals optional templates without changing selection behavior", () => {
    const onToggle = vi.fn();
    render(
      <TemplatePicker
        onToggle={onToggle}
        optional={optional}
        recommended={recommended}
        unavailable={unavailable}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "展开可选模板 1" }));
    fireEvent.click(screen.getByRole("button", { name: /背面展示/ }));

    expect(onToggle).toHaveBeenCalledWith("back_display");
  });

  it("explains paid Beta product rotation eligibility inline", () => {
    render(
      <TemplatePicker
        onToggle={vi.fn()}
        optional={[
          {
            templateId: "product_quarter_rotation",
            displayName: "商品轻旋转 15-45°",
            description: "使用同一件服装的正面和侧面商品图。",
            riskLevel: "medium_high",
            status: "beta",
            selectable: true,
            selected: false,
            warnings: ["需要严格质检"],
          },
        ]}
        recommended={[]}
        unavailable={[
          {
            templateId: "product_half_rotation",
            displayName: "商品连续 180° 转身",
            description: "需要同款正面、侧面和背面商品图。",
            riskLevel: "high",
            selectable: false,
            selected: false,
            reasons: [
              "缺少商品侧面图",
              "多角度商品图不是同一件服装",
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "展开可选模板 1" }));
    expect(screen.getByText("商品轻旋转 15-45°")).toBeInTheDocument();
    expect(screen.getByText("付费 Beta")).toBeInTheDocument();
    expect(screen.getByText(/需要严格质检/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "展开不可用模板 1" }));
    expect(screen.getByText(/缺少商品侧面图/)).toBeInTheDocument();
    expect(
      screen.getByText(/多角度商品图不是同一件服装/),
    ).toBeInTheDocument();
  });

  it("exposes paid Beta human-model turns with strict review and precise blockers", () => {
    render(
      <TemplatePicker
        onToggle={vi.fn()}
        optional={[
          {
            templateId: "model_quarter_turn",
            displayName: "模特轻侧身 15-45°",
            description: "使用同一真人模特穿着同一件服装的正面和侧面图。",
            riskLevel: "medium_high",
            status: "beta",
            selectable: true,
            selected: false,
            warnings: ["需要严格质检"],
          },
          {
            templateId: "model_half_turn",
            displayName: "模特连续转身 180°",
            description: "使用同一真人模特穿着同一件服装的正面、侧面和背面图。",
            riskLevel: "high",
            status: "beta",
            selectable: true,
            selected: false,
            warnings: ["需要严格质检"],
          },
        ]}
        recommended={[]}
        unavailable={[
          {
            templateId: "model_half_turn_blocked",
            displayName: "模特连续转身 180°（素材不足）",
            description: "需要通过任务内一致性校验。",
            riskLevel: "high",
            status: "beta",
            selectable: false,
            selected: false,
            reasons: [
              "缺少模特背面图",
              "多角度图片中的模特不一致",
              "模特视角中的服装不一致",
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "展开可选模板 2" }));
    expect(screen.getByText("模特轻侧身 15-45°")).toBeInTheDocument();
    expect(screen.getByText("模特连续转身 180°")).toBeInTheDocument();
    expect(screen.getAllByText(/需要严格质检/)).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "展开不可用模板 1" }));
    expect(screen.getByText(/缺少模特背面图/)).toBeInTheDocument();
    expect(screen.getByText(/多角度图片中的模特不一致/)).toBeInTheDocument();
    expect(screen.getByText(/模特视角中的服装不一致/)).toBeInTheDocument();
  });
});
