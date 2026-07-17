// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminRightsRemovalPage from "./page";

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  listRightsRemovalRequests: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

vi.mock("@/server/auth/admin-session", () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock("@/server/admin/rights-removal", () => ({
  createDrizzleAdminRightsRemovalStore: vi.fn(() => ({})),
  listRightsRemovalRequests: mocks.listRightsRemovalRequests,
}));

vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/admin/rights-removal-table", () => ({
  RightsRemovalTable: ({
    requests,
    actorRole,
  }: {
    requests: Array<{ publicReference: string }>;
    actorRole: string;
  }) => (
    <div>
      {actorRole}:{requests.map((request) => request.publicReference).join(",")}
    </div>
  ),
}));

describe("AdminRightsRemovalPage", () => {
  it("redirects unauthenticated users", async () => {
    mocks.getAdminSession.mockResolvedValueOnce(null);
    await expect(AdminRightsRemovalPage()).rejects.toThrow("redirect:/login");
  });

  it("shows the queue to operators", async () => {
    mocks.getAdminSession.mockResolvedValueOnce({
      userId: "operator-1",
      email: "ops@example.com",
      role: "operator",
    });
    mocks.listRightsRemovalRequests.mockResolvedValueOnce([
      { publicReference: "RR-TEST123" },
    ]);

    render(await AdminRightsRemovalPage());

    expect(screen.getByText("operator:RR-TEST123")).toBeInTheDocument();
  });
});
