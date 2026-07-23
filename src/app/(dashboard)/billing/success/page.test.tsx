// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BillingSuccessPage from "./page";

describe("BillingSuccessPage", () => {
  it("waits for webhook confirmation before claiming credits", () => {
    render(<BillingSuccessPage />);

    expect(
      screen.getByText("Payment received, credits will appear after webhook confirmation."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View billing" })).toHaveAttribute(
      "href",
      "/billing",
    );
    expect(screen.getByRole("link", { name: "Back to workspace" })).toHaveAttribute(
      "href",
      "/workspace",
    );
  });
});
