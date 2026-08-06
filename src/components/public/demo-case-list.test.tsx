// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { demoCases } from "@/lib/demo-cases/catalog";

import { DemoCaseList } from "./demo-case-list";

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: vi.fn(),
}));

describe("DemoCaseList", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders three source sets without inventing missing videos", () => {
    render(<DemoCaseList cases={demoCases} />);

    const list = screen.getByRole("list", { name: "Demo source sets" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Published workflow video")).toBeInTheDocument();
    expect(screen.getAllByText("Synthetic source set ready")).toHaveLength(2);
    expect(screen.getByLabelText("Generated adult burgundy midi dress product video"))
      .toHaveAttribute(
        "src",
        "/demo/cases/burgundy-midi-dress/virtual-try-on-homepage-8s.mp4",
      );
    expect(screen.getAllByText("Synthetic product input generated with ImageGen. It is not a customer case."))
      .toHaveLength(2);
    expect(screen.getAllByTestId("demo-case-video")).toHaveLength(1);
    expect(screen.getByTestId("demo-case-video").parentElement)
      .toHaveClass("aspect-[9/16]");
    expect(screen.getByTestId("demo-case-video")).toHaveClass("object-contain");
  });

  it("renders the generated blazer and cardigan assets", () => {
    render(<DemoCaseList cases={demoCases} />);

    const blazerFront = screen.getByAltText(
      "Synthetic front product image of a cobalt structured blazer",
    );
    const cardiganDetail = screen.getByAltText(
      "Synthetic neckline, button, and cuff detail of a sage rib-knit cardigan",
    );

    expect(decodeURIComponent(blazerFront.getAttribute("src") ?? ""))
      .toContain("/demo/cases/structured-blazer/front.webp");
    expect(decodeURIComponent(cardiganDetail.getAttribute("src") ?? ""))
      .toContain("/demo/cases/knit-cardigan/detail.webp");
  });

  it("localizes source labels and synthetic disclosure", () => {
    render(<DemoCaseList cases={demoCases} language="zh-CN" />);

    expect(screen.getByRole("list", { name: "演示素材集" })).toBeInTheDocument();
    expect(screen.getAllByText("合成素材已就绪")).toHaveLength(2);
    expect(screen.getAllByText("使用 ImageGen 生成的合成商品输入，不是客户案例。"))
      .toHaveLength(2);
    expect(screen.getAllByText("正面")).toHaveLength(3);
    expect(screen.getAllByText("背面")).toHaveLength(3);
    expect(screen.getByText("侧面")).toBeInTheDocument();
    expect(screen.getAllByText("细节")).toHaveLength(2);
  });
});
