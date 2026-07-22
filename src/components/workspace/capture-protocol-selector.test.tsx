// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaptureProtocolSelector } from "./capture-protocol-selector";

describe("CaptureProtocolSelector", () => {
  afterEach(cleanup);

  it("presents one recommended flow and two explicit beta flows", () => {
    render(
      <CaptureProtocolSelector
        onChange={vi.fn()}
        selectedId="product_showcase"
      />,
    );

    expect(screen.getByRole("button", { name: /商品展示/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("推荐")).toBeInTheDocument();
    expect(screen.getAllByText("Beta")).toHaveLength(2);
  });

  it("reports the selected protocol", () => {
    const onChange = vi.fn();
    render(
      <CaptureProtocolSelector
        onChange={onChange}
        selectedId="product_showcase"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /商品旋转/ }));

    expect(onChange).toHaveBeenCalledWith("product_rotation");
  });

  it("keeps the three protocol choices compact on mobile", () => {
    render(
      <CaptureProtocolSelector
        onChange={vi.fn()}
        selectedId="product_showcase"
      />,
    );

    const group = screen.getByRole("group", {
      name: "选择三图生成方式",
    });
    expect(group.className).toContain("grid-cols-3");

    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button.className).toContain("min-h-16");
      expect(button.className).toContain("sm:min-h-24");
    });

    expect(
      screen.getByText("用正面、背面和细节图制作稳定的商品宣传视频。")
        .className,
    ).toContain("hidden");
  });
});
