// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaymentStatus } from "./payment-status";

describe("PaymentStatus", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("polls a created order until webhook marks it paid", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "created",
          packageCode: "starter",
          creditsGranted: 100,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "paid",
          packageCode: "starter",
          creditsGranted: 100,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatus externalOrderId="req_1" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Payment submitted. Waiting for secure confirmation...",
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Payment confirmed. 100 credits have been added.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["failed", "Payment was not completed."],
    ["cancelled", "Payment was not completed."],
    ["refunded", "This payment has been refunded."],
  ])("stops polling for terminal status %s", async (status, message) => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      Response.json({
        status,
        packageCode: "starter",
        creditsGranted: 100,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatus externalOrderId="req_terminal" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toHaveTextContent(message);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stops after thirty pending checks", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      Response.json({
        status: "created",
        packageCode: "starter",
        creditsGranted: 100,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentStatus externalOrderId="req_slow" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(30);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Confirmation is taking longer than expected. Check Billing for the latest status.",
    );
  });
});
