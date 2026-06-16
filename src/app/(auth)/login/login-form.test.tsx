// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
  socialSignIn: vi.fn(),
  magicLinkSignIn: vi.fn(),
  sendVerificationOtp: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      social: mocks.socialSignIn,
      magicLink: mocks.magicLinkSignIn,
    },
    emailOtp: {
      sendVerificationOtp: mocks.sendVerificationOtp,
    },
  },
}));

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.socialSignIn.mockReset();
    mocks.magicLinkSignIn.mockReset();
    mocks.sendVerificationOtp.mockReset();
  });

  it("uses the callback URL for Google sign-in", async () => {
    render(<LoginForm callbackURL="/workspace?mode=trial&preset=minimal_studio" />);

    fireEvent.click(screen.getByText("使用 Google 登录"));

    await waitFor(() => {
      expect(mocks.socialSignIn).toHaveBeenCalledWith({
        provider: "google",
        callbackURL: "/workspace?mode=trial&preset=minimal_studio",
      });
    });
  });

  it("uses the callback URL for Magic Link sign-in", async () => {
    render(<LoginForm callbackURL="/workspace?mode=trial&preset=minimal_studio" />);

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByText("发送 Magic Link"));

    await waitFor(() => {
      expect(mocks.magicLinkSignIn).toHaveBeenCalledWith({
        email: "seller@example.com",
        callbackURL: "/workspace?mode=trial&preset=minimal_studio",
      });
    });
  });
});
