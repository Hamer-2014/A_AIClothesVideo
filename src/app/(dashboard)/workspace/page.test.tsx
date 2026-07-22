// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WorkspacePage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  getServerSession: vi.fn(),
  getUserBillingOverview: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/server/billing/user-billing", () => ({
  createDrizzleUserBillingStore: vi.fn(),
  getUserBillingOverview: mocks.getUserBillingOverview,
}));

vi.mock("@/components/dashboard/shell", () => ({
  DashboardShell: ({
    children,
    title,
  }: {
    children: React.ReactNode;
    title: string;
  }) => (
    <div data-testid="dashboard-shell">
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/components/public/public-header", () => ({
  PublicHeader: () => <header data-testid="public-header">public header</header>,
}));

vi.mock("@/components/public/public-footer", () => ({
  PublicFooter: () => <footer data-testid="public-footer">public footer</footer>,
}));

vi.mock("@/components/workspace/workspace-app", () => ({
  WorkspaceApp: ({
    initialMode,
    initialPresetId,
    isAuthenticated,
    loginHref,
  }: {
    initialMode?: string;
    initialPresetId?: string | null;
    isAuthenticated?: boolean;
    loginHref?: string;
  }) => (
    <div
      data-authenticated={String(isAuthenticated)}
      data-login-href={loginHref}
      data-mode={initialMode}
      data-preset={initialPresetId}
      data-testid="workspace-app"
    />
  ),
}));

describe("WorkspacePage", () => {
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
    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.getByTestId("public-footer")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "服装视频工作台",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("guest-workspace-intro").className).toContain(
      "py-3",
    );
    expect(screen.getByRole("link", { name: "登录后继续生成" })).toHaveAttribute(
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
