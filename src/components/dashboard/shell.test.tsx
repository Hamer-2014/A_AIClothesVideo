// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardShell } from "./shell";

vi.mock("@/components/brand/logo", () => ({
  LogoLockup: () => <div>RunwayTools</div>,
}));

vi.mock("@/components/layout/app-footer", () => ({
  AppFooter: () => <footer>footer</footer>,
}));

vi.mock("./sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出</button>,
}));

describe("DashboardShell", () => {
  it("uses a soft brand selected state for dashboard nav items", () => {
    render(
      <DashboardShell
        nav={[
          { href: "/workspace", label: "工作台", active: true },
          { href: "/jobs", label: "任务", active: false },
          { href: "/billing", label: "账单", active: false },
        ]}
        subtitle="上传素材、分析模板、确认分镜，再进入真实生成链路。"
        title="生成工作台"
      >
        <div>content</div>
      </DashboardShell>,
    );

    const activeItem = screen.getByRole("link", { name: "工作台" });
    expect(activeItem.className).toContain("bg-cyan-50");
    expect(activeItem.className).toContain("text-[var(--accent-strong)]");
    expect(activeItem.className).toContain("border-[var(--accent)]");
    expect(activeItem.className).not.toContain("bg-[var(--ink)]");
    expect(activeItem.className).not.toContain("text-white");
  });
});
