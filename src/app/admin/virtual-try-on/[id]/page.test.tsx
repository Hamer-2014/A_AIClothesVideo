// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminVirtualTryOnDetailPage from "./page";

const mocks = vi.hoisted(() => ({ getAdminSession: vi.fn(), getAdminVirtualTryOnDetail: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }) }));
vi.mock("@/server/auth/admin-session", () => ({ getAdminSession: mocks.getAdminSession }));
vi.mock("@/server/admin/virtual-try-on", () => ({ createDrizzleAdminVirtualTryOnStore: vi.fn(() => ({})), getAdminVirtualTryOnDetail: mocks.getAdminVirtualTryOnDetail }));
vi.mock("@/components/admin/admin-shell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const detail = {
  job: { id: "job-1", userId: "owner-1", mode: "three_view", status: "ready", skuName: null, creditCost: 8, createdAt: new Date("2026-08-01T00:00:00.000Z"), updatedAt: new Date("2026-08-01T00:00:00.000Z") },
  pack: { id: "pack-1", version: 1, status: "ready", requiredViews: ["front", "side", "back"], qaSummary: { verdict: "pass" }, lockedAt: null },
  views: [{ id: "asset-1", view: "front", providerStatus: "completed", attemptCount: 1, lastErrorCode: null, r2KeySuffix: "pack-1/front.png", origin: "generated_apimart_gpt_image_2", provenance: { kind: "derived" } }],
  fidelity: [{ id: "qa-1", scope: "view", view: "front", verdict: "pass", resultJson: { verdict: "pass" } }],
  providerLogs: [{ id: "log-1", provider: "apimart", model: "gpt-image-2", purpose: "virtual_tryon_image", status: "succeeded", costEstimate: "0.02", providerTaskId: "task-1", errorCode: null }],
  ledger: { reservedLedgerId: "reserve", capturedLedgerId: "capture", releasedLedgerId: null, refundedLedgerId: null },
  stateEvents: [{ id: "event-1", fromStatus: "generating", toStatus: "ready", reason: "completed", actorType: "system", eventSnapshot: { state: "ready" }, createdAt: new Date("2026-08-01T00:00:00.000Z") }],
};

describe("AdminVirtualTryOnDetailPage", () => {
  it("redirects unauthenticated users and returns missing details to the list", async () => {
    mocks.getAdminSession.mockResolvedValueOnce(null);
    await expect(AdminVirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) })).rejects.toThrow("redirect:/login");
    mocks.getAdminSession.mockResolvedValueOnce({ userId: "admin", email: "admin@example.com", role: "admin" });
    mocks.getAdminVirtualTryOnDetail.mockResolvedValueOnce(null);
    await expect(AdminVirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) })).rejects.toThrow("redirect:/admin/virtual-try-on");
  });

  it("groups safe observability fields into views, QA and ledger, and state events", async () => {
    mocks.getAdminSession.mockResolvedValueOnce({ userId: "admin", email: "admin@example.com", role: "admin" });
    mocks.getAdminVirtualTryOnDetail.mockResolvedValueOnce(detail);
    render(await AdminVirtualTryOnDetailPage({ params: Promise.resolve({ id: "job-1" }) }));
    expect(screen.getByRole("heading", { name: "视角" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "QA 与账本" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "状态事件" })).toBeInTheDocument();
    expect(screen.getByText("pack-1/front.png")).toBeInTheDocument();
    expect(screen.getByText(/derived/)).toBeInTheDocument();
    expect(screen.queryByText(/https:\/\//)).not.toBeInTheDocument();
  });
});
