// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SampleGallery } from "./sample-gallery";

describe("SampleGallery", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders real sample items when they are provided", () => {
    render(
      <SampleGallery
        samples={[
          {
            title: "白底连衣裙 8 秒试用",
            description: "正面慢推近，低风险模板。",
            mediaLabel: "真实内部样例",
          },
        ]}
      />,
    );

    expect(screen.getByText("白底连衣裙 8 秒试用")).toBeInTheDocument();
    expect(screen.getByText("正面慢推近，低风险模板。")).toBeInTheDocument();
    expect(screen.getByText("真实内部样例")).toBeInTheDocument();
    expect(screen.queryByText("样例准备中")).not.toBeInTheDocument();
  });

  it("renders a restrained empty state when no real samples exist", () => {
    render(<SampleGallery samples={[]} />);

    expect(screen.getByText("样例准备中")).toBeInTheDocument();
    expect(
      screen.getByText("我们只展示真实生成过的服装样例；当前暂无可公开案例。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/客户案例/)).not.toBeInTheDocument();
  });
});
