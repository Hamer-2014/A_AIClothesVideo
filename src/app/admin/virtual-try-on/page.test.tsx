// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminVirtualTryOnPage from "./page";

const mocks = vi.hoisted(() => ({ getAdminSession: vi.fn(), listAdminVirtualTryOns: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("@/server/auth/admin-session", () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock("@/server/admin/virtual-try-on", () => ({ createDrizzleAdminVirtualTryOnStore: vi.fn(() => ({})), listAdminVirtualTryOns: mocks.listAdminVirtualTryOns }));
vi.mock("@/components/admin/admin-shell", () => ({ AdminShell: ({ children, nav }: { children: React.ReactNode; nav: Array<{ label: string; active: boolean }> }) => <div><nav>{nav.map((item) => <span data-active={item.active} key={item.label}>{item.label}</span>)}</nav>{children}</div> }));

describe("AdminVirtualTryOnPage", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getAdminSession.mockResolvedValueOnce(null);
    await expect(AdminVirtualTryOnPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("redirect:/login");
  });

  it("renders a scannable bounded list with the virtual try-on nav item active", async () => {
    mocks.getAdminSession.mockResolvedValueOnce({ userId: "admin", email: "admin@example.com", role: "admin" });
    mocks.listAdminVirtualTryOns.mockResolvedValueOnce({ items: [{ id: "job-1", userId: "owner-1", mode: "three_view", status: "ready", pack: { version: 2, requiredViews: ["front", "side", "back"] }, createdAt: new Date("2026-08-01T00:00:00.000Z") }], nextCursor: null });
    render(await AdminVirtualTryOnPage({ searchParams: Promise.resolve({ limit: "25" }) }));
    expect(screen.getByRole("columnheader", { name: "任务" })).toBeInTheDocument();
    expect(screen.getByText(/正面、侧面、背面/)).toBeInTheDocument();
    expect(screen.getByText("虚拟试穿")).toHaveAttribute("data-active", "true");
  });
});
