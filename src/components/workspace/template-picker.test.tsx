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
});
