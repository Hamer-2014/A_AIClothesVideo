// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PurchaseButton } from "./purchase-button";

describe("PurchaseButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("sends anonymous users through login while preserving the package", () => {
    render(
      <PurchaseButton
        authenticated={false}
        packageCode="starter"
        packageName="Starter"
        purchasesEnabled
      />,
    );

    expect(
      screen.getByRole("link", { name: "Sign in to buy Starter" }),
    ).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent("/pricing?package=starter#credit-packs")}`,
    );
  });

  it("disables Checkout while production purchases are off", () => {
    render(
      <PurchaseButton
        authenticated
        packageCode="creator"
        packageName="Creator"
        purchasesEnabled={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Purchases temporarily unavailable",
      }),
    ).toBeDisabled();
  });

  it("submits only packageCode once and redirects to the returned Checkout", async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const navigate = vi.fn();

    render(
      <PurchaseButton
        authenticated
        navigate={navigate}
        packageCode="starter"
        packageName="Starter"
        purchasesEnabled
      />,
    );

    const button = screen.getByRole("button", { name: "Buy Starter" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageCode: "starter" }),
    });
    expect(
      screen.getByRole("button", { name: "Opening secure checkout..." }),
    ).toBeDisabled();

    resolveRequest(
      Response.json({
        checkoutUrl: "https://checkout.creem.io/ch_123",
      }),
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        "https://checkout.creem.io/ch_123",
      );
    });
  });

  it.each([401, 502, 503])(
    "shows a safe error when Checkout returns %s",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({ error: "provider_detail" }, { status }),
        ),
      );

      render(
        <PurchaseButton
          authenticated
          packageCode="studio"
          packageName="Studio"
          purchasesEnabled
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Buy Studio" }));

      expect(await screen.findByRole("status")).toHaveTextContent(
        status === 401
          ? "Your session expired. Sign in and try again."
          : "Purchases are temporarily unavailable. Please try again later.",
      );
    },
  );

  it("does not redirect when Checkout returns a malformed success body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true })));
    const navigate = vi.fn();

    render(
      <PurchaseButton
        authenticated
        navigate={navigate}
        packageCode="creator"
        packageName="Creator"
        purchasesEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Buy Creator" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Checkout could not be opened. Please try again.",
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
