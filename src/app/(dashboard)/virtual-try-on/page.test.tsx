// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VirtualTryOnPage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`); }),
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  getUserBillingOverview: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/server", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: mocks.getRequestLocale }));
vi.mock("@/server/billing/user-billing", () => ({
  createDrizzleUserBillingStore: vi.fn(),
  getUserBillingOverview: mocks.getUserBillingOverview,
}));
vi.mock("@/components/dashboard/shell", () => ({
  DashboardShell: ({ children, language, nav, title }: { children: React.ReactNode; language: string; nav: Array<{ href: string; label: string; active: boolean }>; title: string }) => (
    <div data-language={language} data-testid="dashboard-shell"><h1>{title}</h1><nav>{nav.map((item) => <a data-active={item.active} href={item.href} key={item.href}>{item.label}</a>)}</nav>{children}</div>
  ),
}));
vi.mock("@/components/virtual-try-on/create-form", () => ({
  VirtualTryOnCreateForm: ({ language }: { language: string }) => <div data-language={language} data-testid="try-on-create-form" />,
}));

describe("VirtualTryOnPage", () => {
  beforeEach(() => {
    mocks.getRequestLocale.mockResolvedValue("en");
    mocks.getUserBillingOverview.mockResolvedValue({ wallet: { availableBalance: 10, reservedBalance: 0 } });
  });

  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("redirects unauthenticated visitors to the localized login next URL", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");
    mocks.getServerSession.mockResolvedValue(null);

    await expect(VirtualTryOnPage()).rejects.toThrow("NEXT_REDIRECT:/zh/login?next=%2Fzh%2Fvirtual-try-on");
  });

  it("renders the authenticated creation workspace with the virtual try-on nav item active", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-1", email: "merchant@example.com" } });
    render(await VirtualTryOnPage());

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-language", "en");
    expect(screen.getByRole("heading", { name: "Virtual try-on" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Virtual try-on" })).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("try-on-create-form")).toHaveAttribute("data-language", "en");
  });
});
