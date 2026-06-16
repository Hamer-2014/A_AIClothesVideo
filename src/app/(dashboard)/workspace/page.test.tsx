import { describe, expect, it, vi } from "vitest";

import WorkspacePage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  getServerSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/server/billing/user-billing", () => ({
  createDrizzleUserBillingStore: vi.fn(),
  getUserBillingOverview: vi.fn(),
}));

describe("WorkspacePage auth redirect", () => {
  it("preserves trial mode and preset query when redirecting visitors to login", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    await expect(
      WorkspacePage({
        searchParams: Promise.resolve({
          mode: "trial",
          preset: "minimal_studio",
        }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio",
    );
  });
});
