// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  loginForm: vi.fn(({ callbackURL }: { callbackURL: string }) => (
    <div data-testid="login-form">{callbackURL}</div>
  )),
}));

vi.mock("./login-form", () => ({
  LoginForm: mocks.loginForm,
}));

describe("login page", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.loginForm.mockClear();
  });

  it("renders the login shell with the default workspace callback URL", async () => {
    render(await LoginPage({}));

    expect(screen.getByRole("link", { name: "AI Clothes Video 首页" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByText("登录工作台")).toBeInTheDocument();
    expect(screen.getByText("AI Clothes Video")).toBeInTheDocument();
    expect(
      screen.getByText("使用 Google 或邮箱验证码进入工作台。"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/MVP|密码登录/)).not.toBeInTheDocument();
    expect(mocks.loginForm).toHaveBeenCalledWith(
      { callbackURL: "/workspace" },
      undefined,
    );
    expect(screen.queryByLabelText(/密码/)).not.toBeInTheDocument();
  });

  it("preserves same-site trial next before passing it to the login form", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          next: "/workspace?mode=trial&preset=minimal_studio",
        }),
      }),
    );

    expect(mocks.loginForm).toHaveBeenCalledWith(
      { callbackURL: "/workspace?mode=trial&preset=minimal_studio" },
      undefined,
    );
  });

  it("sanitizes next before passing it to the login form", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({
          next: "https://evil.example/workspace",
        }),
      }),
    );

    expect(mocks.loginForm).toHaveBeenCalledWith(
      { callbackURL: "/workspace" },
      undefined,
    );
  });
});
