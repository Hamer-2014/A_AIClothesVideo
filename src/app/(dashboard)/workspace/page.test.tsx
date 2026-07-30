// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import WorkspacePage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  getUserBillingOverview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

vi.mock("@/server/billing/user-billing", () => ({
  createDrizzleUserBillingStore: vi.fn(),
  getUserBillingOverview: mocks.getUserBillingOverview,
}));

vi.mock("@/components/dashboard/shell", () => ({
  DashboardShell: ({
    children,
    language,
    nav,
    title,
  }: {
    children: React.ReactNode;
    language?: string;
    nav: Array<{ href: string; label: string }>;
    title: string;
  }) => (
    <div data-language={language} data-testid="dashboard-shell">
      <h1>{title}</h1>
      <nav>{nav.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}</nav>
      {children}
    </div>
  ),
}));

vi.mock("@/components/public/public-header", () => ({
  PublicHeader: ({ language }: { language?: string }) => (
    <header data-language={language} data-testid="public-header">public header</header>
  ),
}));

vi.mock("@/components/public/public-footer", () => ({
  PublicFooter: ({ language }: { language?: string }) => (
    <footer data-language={language} data-testid="public-footer">public footer</footer>
  ),
}));

vi.mock("@/components/workspace/workspace-app", () => ({
  WorkspaceApp: ({
    initialMode,
    initialPresetId,
    isAuthenticated,
    language,
    loginHref,
  }: {
    initialMode?: string;
    initialPresetId?: string | null;
    isAuthenticated?: boolean;
    language?: string;
    loginHref?: string;
  }) => (
    <div
      data-authenticated={String(isAuthenticated)}
      data-login-href={loginHref}
      data-language={language}
      data-mode={initialMode}
      data-preset={initialPresetId}
      data-testid="workspace-app"
    />
  ),
}));

describe("WorkspacePage", () => {
  beforeEach(() => {
    mocks.getRequestLocale.mockResolvedValue("en");
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a guest workspace instead of redirecting unauthenticated visitors", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const page = await WorkspacePage({
      searchParams: Promise.resolve({
        mode: "trial",
        preset: "minimal_studio",
      }),
    });
    render(page);

    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(screen.queryByTestId("dashboard-shell")).not.toBeInTheDocument();
    expect(screen.getByTestId("public-header")).toHaveAttribute("data-language", "en");
    expect(screen.getByTestId("public-footer")).toHaveAttribute("data-language", "en");
    expect(
      screen.getByRole("heading", {
        name: "Clothing video workspace",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("guest-workspace-intro").className).toContain(
      "py-3",
    );
    expect(screen.getByRole("link", { name: "Sign in to generate" })).toHaveAttribute(
      "href",
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio%26resumeDraft%3D1",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-authenticated",
      "false",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-login-href",
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio%26resumeDraft%3D1",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-language",
      "en",
    );
  });

  it("keeps the guest workspace Chinese on the /zh route", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");
    mocks.getServerSession.mockResolvedValue(null);

    render(await WorkspacePage({
      searchParams: Promise.resolve({ mode: "trial" }),
    }));

    expect(screen.getByRole("heading", { name: "服装视频工作台" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "登录后继续生成" })).toHaveAttribute(
      "href",
      "/zh/login?next=%2Fzh%2Fworkspace%3Fmode%3Dtrial%26resumeDraft%3D1",
    );
    expect(screen.getByRole("link", { name: "查看价格" })).toHaveAttribute(
      "href",
      "/zh/pricing",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-language",
      "zh-CN",
    );
  });

  it("keeps the authenticated workspace inside DashboardShell", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "merchant@example.com" },
    });
    mocks.getUserBillingOverview.mockResolvedValue({
      wallet: { balance: 100 },
    });

    const page = await WorkspacePage({
      searchParams: Promise.resolve({
        mode: "paid",
        preset: "marketplace_clean",
      }),
    });
    render(page);

    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-language",
      "en",
    );
    expect(screen.getByRole("heading", { name: "Video workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-authenticated",
      "true",
    );
    expect(screen.getByTestId("workspace-app")).toHaveAttribute(
      "data-preset",
      "marketplace_clean",
    );
  });
});
