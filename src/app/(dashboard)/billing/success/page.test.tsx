// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BillingSuccessPage from "./page";

vi.mock("@/components/billing/payment-status", () => ({
  PaymentStatus: ({ externalOrderId }: { externalOrderId: string }) => (
    <p>Polling {externalOrderId}</p>
  ),
}));

describe("BillingSuccessPage", () => {
  afterEach(cleanup);

  it("polls the identified local order instead of claiming redirect success", async () => {
    render(
      await BillingSuccessPage({
        searchParams: Promise.resolve({ order: "req_1" }),
      }),
    );

    expect(screen.getByRole("heading", { name: "Payment status" })).toBeInTheDocument();
    expect(screen.getByText("Polling req_1")).toBeInTheDocument();
    expect(screen.queryByText("Payment received")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View billing" })).toHaveAttribute(
      "href",
      "/billing",
    );
    expect(screen.getByRole("link", { name: "Back to workspace" })).toHaveAttribute(
      "href",
      "/workspace",
    );
  });

  it("does not guess an order when the redirect has no request ID", async () => {
    render(
      await BillingSuccessPage({
        searchParams: Promise.resolve({}),
      }),
    );

    expect(
      screen.getByText(
        "We could not identify this checkout. Check Billing for the latest status.",
      ),
    ).toBeInTheDocument();
  });
});
