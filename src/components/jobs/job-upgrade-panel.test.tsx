// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobUpgradePanel } from "./job-upgrade-panel";

describe("JobUpgradePanel", () => {
  it("shows an upgrade CTA for deliverable free trial jobs", () => {
    render(
      <JobUpgradePanel
        billingMode="free_trial"
        phase="deliverable"
        downloadReady
      />,
    );

    expect(screen.getByText("试用视频已生成")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "生成高清无水印版本" }),
    ).toHaveAttribute("href", "/pricing");
    expect(screen.getByText(/低分辨率/)).toBeInTheDocument();
    expect(screen.getByText(/带水印/)).toBeInTheDocument();
  });

  it("does not render for paid jobs", () => {
    const { container } = render(
      <JobUpgradePanel billingMode="paid" phase="deliverable" downloadReady />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a paid entry for failed trial jobs without promising success", () => {
    render(
      <JobUpgradePanel
        billingMode="free_trial"
        phase="failed"
        downloadReady={false}
      />,
    );

    expect(screen.getByText("试用任务未成功")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "购买点数" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(document.body.textContent).not.toContain("一定成功");
    expect(document.body.textContent).not.toContain("保证成功");
  });
});
