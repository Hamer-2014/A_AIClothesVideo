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
  emailOtpSignIn: vi.fn(),
  sendVerificationOtp: vi.fn(),
  routerReplace: vi.fn(),
  routerRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
    refresh: mocks.routerRefresh,
  }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      social: mocks.socialSignIn,
      emailOtp: mocks.emailOtpSignIn,
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
    mocks.emailOtpSignIn.mockReset();
    mocks.sendVerificationOtp.mockReset();
    mocks.routerReplace.mockReset();
    mocks.routerRefresh.mockReset();
    mocks.socialSignIn.mockResolvedValue({ data: null, error: null });
    mocks.emailOtpSignIn.mockResolvedValue({
      data: { token: "session-token" },
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

  it("reveals the OTP input after sending and signs in with the sent email", async () => {
    render(
      <LoginForm callbackURL="/workspace?mode=trial&preset=minimal_studio" />,
    );
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: " Seller@Example.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    const otpInput = await screen.findByLabelText("邮箱验证码");
    expect(screen.getByLabelText("邮箱")).toBeDisabled();

    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "验证并登录" }));

    await waitFor(() => {
      expect(mocks.emailOtpSignIn).toHaveBeenCalledWith({
        email: "seller@example.com",
        otp: "123456",
      });
      expect(mocks.routerReplace).toHaveBeenCalledWith(
        "/workspace?mode=trial&preset=minimal_studio",
      );
      expect(mocks.routerRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a useful error for an invalid OTP", async () => {
    mocks.emailOtpSignIn.mockResolvedValue({
      data: null,
      error: { status: 400, code: "INVALID_OTP" },
    });
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    fireEvent.change(await screen.findByLabelText("邮箱验证码"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "验证并登录" }));

    expect(
      await screen.findByText("验证码错误，请检查后重试。"),
    ).toBeInTheDocument();
  });

  it("does not render a Magic Link control", () => {
    render(<LoginForm callbackURL="/workspace" />);

    expect(screen.queryByText(/Magic Link/i)).not.toBeInTheDocument();
  });

  it("submits only one Google request for rapid repeated clicks", async () => {
    let resolveRequest!: (value: { data: null; error: null }) => void;
    mocks.socialSignIn.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    render(<LoginForm callbackURL="/workspace" />);

    const googleButton = screen.getByRole("button", {
      name: "使用 Google 登录",
    });
    fireEvent.click(googleButton);
    fireEvent.click(googleButton);

    expect(mocks.socialSignIn).toHaveBeenCalledTimes(1);
    expect(googleButton).toBeDisabled();

    resolveRequest({ data: null, error: null });
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

    resolveRequest({ data: { success: true }, error: null });
    expect(
      await screen.findByText("验证码已发送，请检查邮箱。"),
    ).toBeInTheDocument();
  });

  it("starts a resend cooldown after sending an OTP", async () => {
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    expect(await screen.findByText("验证码 60s")).toHaveClass(
      "whitespace-nowrap",
      "tabular-nums",
    );
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

    vi.setSystemTime(new Date("2026-07-22T00:00:30.000Z"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("验证码 29s")).toBeInTheDocument();
  });

  it("shows rate limit feedback instead of a false success", async () => {
    mocks.sendVerificationOtp.mockResolvedValue({
      data: null,
      error: { status: 429, retryAfterSeconds: 42 },
    });
    render(<LoginForm callbackURL="/workspace" />);
    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "seller@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    expect(
      await screen.findByText("发送过于频繁，请在 42 秒后重试。"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("邮箱验证码")).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));

    await waitFor(() => {
      expect(mocks.sendVerificationOtp).toHaveBeenCalledWith({
        email: "seller@example.com",
        type: "sign-in",
      });
    });
  });
});
