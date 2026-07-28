// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SignOutButton } from "./sign-out-button";

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: vi.fn() },
}));

describe("SignOutButton", () => {
  it("keeps a 44px mobile touch target with a localized accessible label", () => {
    render(<SignOutButton compact label="退出登录" />);

    const button = screen.getByRole("button", { name: "退出登录" });
    expect(button).toHaveClass("min-h-11", "min-w-11");
    expect(button).not.toHaveTextContent("Sign out");
  });
});
