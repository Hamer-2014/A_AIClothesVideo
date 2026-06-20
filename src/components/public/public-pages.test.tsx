// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/app/faq/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出</button>,
}));

describe("public trust pages", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("privacy explains uploads, model calls, R2, retention, and deletion", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await PrivacyPage());

    expect(screen.getByRole("heading", { name: "上传图片" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型调用" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloudflare R2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "保存周期" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "删除" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("terms explains prohibited content, trial limits, failures, refunds, and uploaded assets", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await TermsPage());

    expect(screen.getByRole("heading", { name: "禁止内容" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "试用限制" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "生成失败" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "退款" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "用户上传素材" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("faq answers core trial and material questions", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await FaqPage());

    expect(screen.getByText(/需要上传什么图片/)).toBeInTheDocument();
    expect(screen.getByText(/为什么不能生成背面/)).toBeInTheDocument();
    expect(screen.getByText(/多久生成/)).toBeInTheDocument();
    expect(screen.getByText(/试用和付费有什么区别/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("links FAQ from the public header and footer", () => {
    const { rerender } = render(<PublicHeader />);

    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );

    rerender(<PublicFooter />);

    expect(
      screen.getByText("2026 RunwayTools. All rights reserved."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("服装商品图生成宣传短视频工具"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "隐私" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "条款" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(screen.getByRole("link", { name: "价格" })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("shows the signed-in public header state without anonymous CTAs", () => {
    render(<PublicHeader user={{ email: "merchant@example.com" }} />);

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("button", { name: "退出" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "免费试用" }),
    ).not.toBeInTheDocument();
  });
});
