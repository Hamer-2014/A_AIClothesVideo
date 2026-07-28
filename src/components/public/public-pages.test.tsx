// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/app/faq/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: mocks.trackFunnelEvent,
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Sign out"}</button>
  ),
}));

describe("public trust pages", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("privacy explains uploads, model calls, R2, retention, and deletion", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await PrivacyPage());

    expect(screen.getByRole("heading", { name: "Uploaded images" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Model processing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloudflare R2" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Retention" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deletion" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notices and complaints" })).toBeInTheDocument();
    expect(container).toHaveTextContent(/three years/);
    expect(container.textContent).not.toMatch(/RunwayTools/);
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("terms explains prohibited content, trial limits, failures, refunds, and uploaded assets", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await TermsPage());

    expect(screen.getByRole("heading", { name: "Prohibited content" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Free trial" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Generation failures" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Credits and refunds" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your uploaded materials" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Likeness and minor authorization" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rights notices" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/RunwayTools/);
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("faq answers core trial and material questions", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    const { container } = render(await FaqPage());

    expect(screen.getByText(/需要上传什么图片/)).toBeInTheDocument();
    expect(screen.getByText(/为什么不能生成背面/)).toBeInTheDocument();
    expect(screen.getByText(/多久生成/)).toBeInTheDocument();
    expect(screen.getByText(/试用和付费有什么区别/)).toBeInTheDocument();
    expect(screen.getByText(/真人或儿童模特需要什么授权/)).toBeInTheDocument();
    expect(screen.getByText(/如何提交侵权删除请求/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("中文营销导航链接到三图专题、价格与常见问题", () => {
    const { rerender } = render(<PublicHeader language="zh-CN" />);

    expect(screen.getByRole("link", { name: "三图生成" })).toHaveAttribute(
      "href",
      "/three-images-to-clothing-video",
    );
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute(
      "href",
      "/faq",
    );

    rerender(<PublicFooter language="zh-CN" />);

    expect(
      screen.getByText("2026 AI Clothes Video。保留所有权利。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("三张同款服装图，一条商品视频。"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "服务条款" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(screen.getByRole("link", { name: "价格" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: "侵权删除" })).toHaveAttribute(
      "href",
      "/takedown",
    );
    expect(screen.getByRole("link", { name: "可接受使用政策" })).toHaveAttribute(
      "href",
      "/acceptable-use",
    );
    expect(screen.getByText("support@aiclothesvideo.com")).toBeInTheDocument();
  });

  it("shows the signed-in public header state without anonymous CTAs", () => {
    render(
      <PublicHeader
        language="zh-CN"
        sourcePage="three_images_landing"
        user={{ email: "merchant@example.com" }}
      />,
    );

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    const workspaceLink = screen.getByRole("link", { name: "进入工作台" });
    expect(workspaceLink).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(workspaceLink).toHaveClass("min-h-11", "min-w-11");
    expect(screen.getByRole("button", { name: "退出登录" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "免费试用" }),
    ).not.toBeInTheDocument();

    fireEvent.click(workspaceLink);
    expect(mocks.trackFunnelEvent).toHaveBeenCalledWith(
      "workspace_cta_clicked",
      {
        sourcePage: "three_images_landing",
        ctaPosition: "header",
        userState: "authenticated",
      },
    );
  });
});
