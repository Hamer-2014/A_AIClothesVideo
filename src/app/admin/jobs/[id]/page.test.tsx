// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

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
    disabledReason,
    fixedPayload,
  }: {
    title: string;
    submitLabel: string;
    endpoint: string;
    disabledReason?: string | null;
    fixedPayload?: Record<string, string | number | boolean>;
  }) => (
    <section>
      <h2>{title}</h2>
      <button disabled={Boolean(disabledReason)} type="button">
        {submitLabel}
      </button>
      <span>{endpoint}</span>
      {disabledReason ? <p>{disabledReason}</p> : null}
      {fixedPayload?.relatedJobId ? <span>{fixedPayload.relatedJobId}</span> : null}
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
      reservedLedgerId: "ledger-1",
      billingMode: "paid",
    },
    segments: [],
    ledger: [
      {
        id: "ledger-1",
        userId: "user-1",
        relatedJobId: "33333333-3333-4333-8333-333333333333",
        type: "reserve",
        amount: 70,
        balanceBefore: 140,
        balanceAfter: 70,
        reason: "reserve",
        idempotencyKey: "reserve:job:33333333-3333-4333-8333-333333333333",
        createdAt: new Date("2026-06-20T00:00:00.000Z"),
      },
    ],
  })),
}));

describe("AdminJobDetailPage actions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps only the release credits action for failed-job credit recovery", async () => {
    const removedLegacyLabel = ["标记", "不可交付"].join("");
    const removedLegacyEndpoint = new RegExp(["undeliver", "able"].join(""));
    const page = await AdminJobDetailPage({
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });

    render(page);

    expect(screen.getByRole("button", { name: "释放冻结点数" })).toBeInTheDocument();
    expect(screen.getByText(/release-credits/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: removedLegacyLabel })).not.toBeInTheDocument();
    expect(screen.queryByText(removedLegacyEndpoint)).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("disables credit actions that do not apply to zero-cost trial jobs", async () => {
    const { getAdminJobDetail } = await import("@/server/admin/jobs");
    vi.mocked(getAdminJobDetail).mockResolvedValueOnce({
      job: {
        id: "44b73fac-77bb-4071-abb5-ea2dc746228f",
        userId: "trial-user",
        creditCost: 0,
        reservedLedgerId: null,
        billingMode: "free_trial",
      },
      segments: [],
      ledger: [],
    } as never);

    const page = await AdminJobDetailPage({
      params: Promise.resolve({ id: "44b73fac-77bb-4071-abb5-ea2dc746228f" }),
    });

    render(page);

    expect(screen.getByRole("button", { name: "释放冻结点数" })).toBeDisabled();
    expect(screen.getByText("这条任务是免费试用或 0 点任务，没有冻结点数可释放。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手动补点" })).toBeDisabled();
    expect(screen.getByText("这条任务没有实际扣点，默认不需要按任务补偿点数。")).toBeInTheDocument();
  });

  it("associates paid job compensation with the current job", async () => {
    const page = await AdminJobDetailPage({
      params: Promise.resolve({ id: "33333333-3333-4333-8333-333333333333" }),
    });

    render(page);

    expect(
      screen.getAllByText("33333333-3333-4333-8333-333333333333").length,
    ).toBeGreaterThan(0);
  });
});
