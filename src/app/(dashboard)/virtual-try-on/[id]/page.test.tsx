// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import VirtualTryOnDetailPage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => { throw new Error(`NEXT_REDIRECT:${href}`); }),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  getServerSession: vi.fn(),
  getRequestLocale: vi.fn(),
  getUserBillingOverview: vi.fn(),
  getVirtualTryOnDetail: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/auth/server", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: mocks.getRequestLocale }));
vi.mock("@/server/billing/user-billing", () => ({ createDrizzleUserBillingStore: vi.fn(), getUserBillingOverview: mocks.getUserBillingOverview }));
vi.mock("@/server/virtual-tryon/owner", () => ({ createDrizzleVirtualTryOnOwnerStore: vi.fn(), getVirtualTryOnDetail: mocks.getVirtualTryOnDetail }));
vi.mock("@/components/dashboard/shell", () => ({ DashboardShell: ({ children, nav }: { children: React.ReactNode; nav: Array<{ href: string; label: string; active: boolean }> }) => <div data-testid="shell"><nav>{nav.map((item) => <a data-active={item.active} href={item.href} key={item.href}>{item.label}</a>)}</nav>{children}</div> }));
vi.mock("@/components/virtual-try-on/pack-detail", () => ({ VirtualTryOnPackDetail: ({ initialDetail }: { initialDetail: { job: { id: string } } }) => <div data-testid="pack-detail">{initialDetail.job.id}</div> }));

const ownedDetail = { job: { id: "job-1", mode: "front_only", status: "queued" }, pack: { id: "pack-1", version: 1, status: "queued", lockedAt: null }, views: [], bridge: null };

describe("VirtualTryOnDetailPage", () => {
  beforeEach(() => {
    mocks.getRequestLocale.mockResolvedValue("en");
    mocks.getUserBillingOverview.mockResolvedValue({ wallet: { availableBalance: 10, reservedBalance: 0 } });
  });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("redirects an unauthenticated visitor with the localized detail next URL", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");
    mocks.getServerSession.mockResolvedValue(null);
    await expect(VirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) })).rejects.toThrow("NEXT_REDIRECT:/zh/login?next=%2Fzh%2Fvirtual-try-on%2Fjob-1");
  });

  it("uses owner detail and returns notFound without disclosing a missing job", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getVirtualTryOnDetail.mockResolvedValue(null);
    await expect(VirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders owned detail with the virtual try-on navigation item active", async () => {
    mocks.getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getVirtualTryOnDetail.mockResolvedValue(ownedDetail);
    render(await VirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) }));
    expect(screen.getByTestId("pack-detail")).toHaveTextContent("job-1");
    expect(screen.getByRole("link", { name: "Virtual try-on" })).toHaveAttribute("data-active", "true");
  });
});
