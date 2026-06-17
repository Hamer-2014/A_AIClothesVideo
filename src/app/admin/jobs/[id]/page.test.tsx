// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import AdminJobDetailPage from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("@/app/app-shell", () => ({
  buildAdminNav: () => [],
}));

vi.mock("@/components/admin/admin-shell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/admin/action-form", () => ({
  AdminActionForm: ({
    title,
    submitLabel,
    endpoint,
  }: {
    title: string;
    submitLabel: string;
    endpoint: string;
  }) => (
    <section>
      <h2>{title}</h2>
      <button type="button">{submitLabel}</button>
      <span>{endpoint}</span>
    </section>
  ),
}));

vi.mock("@/components/admin/job-detail-panel", () => ({
  JobDetailPanel: () => <div>job detail panel</div>,
}));

vi.mock("@/server/auth/admin-session", () => ({
  getAdminSession: vi.fn(async () => ({
    userId: "operator-1",
    email: "operator@example.com",
    role: "operator",
  })),
}));

vi.mock("@/server/admin/jobs", () => ({
  createDrizzleAdminJobStore: vi.fn(() => ({})),
  getAdminJobDetail: vi.fn(async () => ({
    job: {
      id: "33333333-3333-4333-8333-333333333333",
      userId: "user-1",
      creditCost: 70,
    },
    segments: [],
  })),
}));

describe("AdminJobDetailPage actions", () => {
  it("keeps the new release credits action and removes the old undeliverable action", async () => {
    const page = await AdminJobDetailPage({
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });

    render(page);

    expect(screen.getByRole("button", { name: "释放冻结点数" })).toBeInTheDocument();
    expect(screen.getByText(/release-credits/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "标记不可交付" })).not.toBeInTheDocument();
    expect(screen.queryByText(/undeliverable/)).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });
});
