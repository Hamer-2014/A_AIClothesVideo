// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
    vi.useRealTimers();
  });

  beforeEach(() => {
    mocks.socialSignIn.mockReset();
    mocks.magicLinkSignIn.mockReset();
    mocks.sendVerificationOtp.mockReset();
    mocks.magicLinkSignIn.mockResolvedValue({
      data: { status: true },
      error: null,
    });
    mocks.sendVerificationOtp.mockResolvedValue({
      data: { success: true },
      error: null,
    });
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

  it("submits only one OTP request for rapid repeated clicks", async () => {
    let resolveRequest!: (value: {
      data: { success: boolean };
      error: null;
    }) => void;
    mocks.sendVerificationOtp.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });

    const otpButton = screen.getByRole("button", {
      name: "发送邮箱验证码",
    });
    fireEvent.click(otpButton);
    fireEvent.click(otpButton);

    expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1);
    expect(otpButton).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "发送 Magic Link" }),
    ).toBeDisabled();

    resolveRequest({ data: { success: true }, error: null });
    expect(
      await screen.findByText("验证码已发送，请检查邮箱。"),
    ).toBeInTheDocument();
  });

  it("shares the cooldown between OTP and Magic Link", async () => {
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    expect(await screen.findByText("验证码 60s")).toHaveClass(
      "whitespace-nowrap",
      "tabular-nums",
    );
    expect(screen.getByText("Magic Link 60s")).toHaveClass(
      "whitespace-nowrap",
      "tabular-nums",
    );
    expect(mocks.magicLinkSignIn).not.toHaveBeenCalled();
  });

  it("recomputes the cooldown after a background-tab timer delay", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z"));
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "发送邮箱验证码" }),
      );
      await Promise.resolve();
    });
    expect(screen.getByText("验证码 60s")).toBeInTheDocument();
    expect(screen.getByText("Magic Link 60s")).toBeInTheDocument();

    vi.setSystemTime(new Date("2026-07-22T00:00:30.000Z"));
    await act(async () => {
      vi.advanceTimersToNextTimer();
    });

    expect(screen.getByText("验证码 29s")).toBeInTheDocument();
    expect(screen.getByText("Magic Link 29s")).toBeInTheDocument();
  });

  it("shows rate limit feedback instead of a false success", async () => {
    mocks.magicLinkSignIn.mockResolvedValue({
      data: null,
      error: { status: 429, retryAfterSeconds: 42 },
    });
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 Magic Link" }));

    expect(
      await screen.findByText("发送过于频繁，请在 42 秒后重试。"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("登录链接已发送，请检查邮箱。"),
    ).not.toBeInTheDocument();
  });

  it("shows a generic error when the request throws", async () => {
    mocks.sendVerificationOtp.mockRejectedValue(
      new Error("network unavailable"),
    );
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    expect(
      await screen.findByText("发送失败，请稍后重试。"),
    ).toBeInTheDocument();
  });

  it("normalizes the email before submitting", async () => {
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: " Seller@Example.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送 Magic Link" }));

    await waitFor(() => {
      expect(mocks.magicLinkSignIn).toHaveBeenCalledWith({
        email: "seller@example.com",
        callbackURL: "/workspace",
      });
    });
  });
});
