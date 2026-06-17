// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PricingPage from "./page";

describe("PricingPage", () => {
  afterEach(() => {
    cleanup();
  });

  it("explains public trial, packages, duration credit costs, and failed generation credit handling", () => {
    render(<PricingPage />);

    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Creator")).toBeInTheDocument();
    expect(screen.getByText("Studio")).toBeInTheDocument();
    expect(screen.getAllByText(/8 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/16 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24 秒/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/免费试用/).length).toBeGreaterThan(0);
    expect(screen.getByText(/失败会释放或退回点数/)).toBeInTheDocument();
  });
});
