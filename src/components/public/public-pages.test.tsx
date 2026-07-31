// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import FaqPage from "@/app/faq/page";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";

import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  trackFunnelEvent: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/analytics/client-funnel", () => ({
  trackFunnelEvent: mocks.trackFunnelEvent,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/zh",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: ({ label }: { label?: string }) => (
    <button type="button">{label ?? "Sign out"}</button>
  ),
}));

describe("public trust pages", () => {
  beforeEach(() => {
    mocks.getRequestLocale.mockResolvedValue("en");
  });

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
    expect(container).toHaveTextContent(/public custom domain/);
    expect(container).toHaveTextContent(/anyone who obtains a source-image URL/i);
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

    expect(screen.getByText(/Which images should I upload/)).toBeInTheDocument();
    expect(screen.getByText(/Why can't I generate a back view/)).toBeInTheDocument();
    expect(screen.getByText(/How long does generation take/)).toBeInTheDocument();
    expect(screen.getByText(/What is the difference between trial and paid generation/)).toBeInTheDocument();
    expect(screen.getByText(/What authorization is required for models or minors/)).toBeInTheDocument();
    expect(screen.getByText(/How do I submit a takedown request/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/MVP|内测|系统测试/);
  });

  it("中文营销导航链接到三图专题、价格与常见问题", () => {
    const { rerender } = render(<PublicHeader language="zh-CN" />);

    expect(screen.getByRole("link", { name: "三图生成" })).toHaveAttribute(
      "href",
      "/zh/three-images-to-clothing-video",
    );
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute(
      "href",
      "/zh/faq",
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
      "/zh/privacy",
    );
    expect(screen.getByRole("link", { name: "服务条款" })).toHaveAttribute(
      "href",
      "/zh/terms",
    );
    expect(screen.getByRole("link", { name: "常见问题" })).toHaveAttribute(
      "href",
      "/zh/faq",
    );
    expect(screen.getByRole("link", { name: "价格" })).toHaveAttribute(
      "href",
      "/zh/pricing",
    );
    expect(screen.getByRole("link", { name: "侵权删除" })).toHaveAttribute(
      "href",
      "/zh/takedown",
    );
    expect(screen.getByRole("link", { name: "可接受使用政策" })).toHaveAttribute(
      "href",
      "/zh/acceptable-use",
    );
    expect(screen.getByText("support@aiclothesvideo.com")).toBeInTheDocument();
  });

  it("keeps English desktop and mobile navigation on the conversion path", () => {
    render(<PublicHeader language="en" />);

    const desktopNavigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(
      within(desktopNavigation).getByRole("link", {
        name: "Three-image workflow",
      }),
    ).toHaveAttribute("href", "/three-images-to-clothing-video");
    expect(within(desktopNavigation).getByRole("link", { name: "Pricing" }))
      .toHaveAttribute("href", "/pricing");
    expect(within(desktopNavigation).getByRole("link", { name: "FAQ" }))
      .toHaveAttribute("href", "/faq");
    expect(within(desktopNavigation).queryByRole("link", { name: "Privacy" }))
      .not.toBeInTheDocument();
    expect(within(desktopNavigation).queryByRole("link", { name: "Terms" }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const mobileNavigation = screen.getByRole("navigation", {
      name: "Mobile primary navigation",
    });
    expect(
      within(mobileNavigation).getByRole("link", {
        name: "Three-image workflow",
      }),
    ).toHaveAttribute("href", "/three-images-to-clothing-video");
    expect(within(mobileNavigation).getByRole("link", { name: "Pricing" }))
      .toHaveAttribute("href", "/pricing");
    expect(within(mobileNavigation).getByRole("link", { name: "FAQ" }))
      .toHaveAttribute("href", "/faq");
  });

  it("renders Chinese FAQ and legal content on /zh", async () => {
    mocks.getServerSession.mockResolvedValue(null);
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    const { rerender } = render(await FaqPage());
    expect(screen.getByRole("heading", { name: "常见问题" })).toBeInTheDocument();
    expect(screen.getByText(/需要上传什么图片/)).toBeInTheDocument();

    rerender(await PrivacyPage());
    expect(screen.getByRole("heading", { name: "隐私政策" })).toBeInTheDocument();

    rerender(await TermsPage());
    expect(screen.getByRole("heading", { name: "服务条款" })).toBeInTheDocument();
  });

  it("opens and closes the Chinese mobile navigation", () => {
    render(<PublicHeader language="zh-CN" />);

    const menuButton = screen.getByRole("button", { name: "打开主导航" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "移动端主导航" }))
      .not.toBeInTheDocument();

    fireEvent.click(menuButton);
    expect(menuButton).toHaveAttribute("aria-expanded", "true");
    const mobileNavigation = screen.getByRole("navigation", { name: "移动端主导航" });
    const firstMobileLink = within(mobileNavigation).getByRole("link", { name: "三图生成" });
    expect(firstMobileLink)
      .toHaveAttribute("href", "/zh/three-images-to-clothing-video");
    expect(within(mobileNavigation).getByRole("link", { name: "价格" }))
      .toHaveAttribute("href", "/zh/pricing");
    expect(within(mobileNavigation).getByRole("link", { name: "常见问题" }))
      .toHaveAttribute("href", "/zh/faq");

    firstMobileLink.focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("navigation", { name: "移动端主导航" }))
      .not.toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });

  it("keeps anonymous header CTA funnel tracking", () => {
    render(<PublicHeader language="zh-CN" sourcePage="homepage" />);

    fireEvent.click(screen.getByRole("link", { name: "免费试用" }));
    expect(screen.getByRole("link", { name: "免费试用" })).toHaveAttribute(
      "href",
      "/zh/workspace?mode=trial&preset=minimal_studio",
    );
    expect(mocks.trackFunnelEvent).toHaveBeenCalledWith("trial_cta_clicked", {
      sourcePage: "homepage",
      ctaPosition: "header",
      userState: "anonymous",
      presetId: "minimal_studio",
      mode: "trial",
    });
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
      "/zh/workspace",
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
