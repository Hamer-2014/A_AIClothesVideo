// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreditLedger } from "./credit-ledger";

describe("CreditLedger", () => {
  it("shows the brand support contact inside the authenticated dashboard", () => {
    render(<CreditLedger wallet={null} orders={[]} ledger={[]} />);

    expect(
      screen.getByRole("link", { name: "support@aiclothesvideo.com" }),
    ).toHaveAttribute("href", "mailto:support@aiclothesvideo.com");
    expect(screen.getByText(/within three business days/i)).toBeInTheDocument();
  });
});
