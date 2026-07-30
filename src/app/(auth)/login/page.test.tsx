// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoginPage from "./page";

const mocks = vi.hoisted(() => ({
  getRequestLocale: vi.fn(),
  loginForm: vi.fn(({ callbackURL }: { callbackURL: string }) => (
    <div data-testid="login-form">{callbackURL}</div>
  )),
}));

vi.mock("./login-form", () => ({
  LoginForm: mocks.loginForm,
}));

vi.mock("@/lib/i18n/server", () => ({
  getRequestLocale: mocks.getRequestLocale,
}));

describe("login page", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    mocks.loginForm.mockClear();
    mocks.getRequestLocale.mockResolvedValue("en");
  });

  it("renders the login shell with the default workspace callback URL", async () => {
    render(await LoginPage({}));

    expect(screen.getByRole("link", { name: "AI Clothes Video home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(
      screen.getByRole("heading", { name: "Sign in to AI Clothes Video" }),
    ).toBeInTheDocument();
    expect(screen.getByText("AI Clothes Video")).toBeInTheDocument();
    expect(
      screen.getByText(/Use Google or a one-time email code/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/MVP|密码登录/)).not.toBeInTheDocument();
    expect(mocks.loginForm).toHaveBeenCalledWith(
      { callbackURL: "/workspace", language: "en" },
      undefined,
    );
    expect(screen.queryByLabelText(/密码/)).not.toBeInTheDocument();
  });

  it("renders the Chinese login route with localized links and form", async () => {
    mocks.getRequestLocale.mockResolvedValue("zh-CN");

    render(await LoginPage({}));

    expect(screen.getByRole("heading", { name: "登录 AI Clothes Video" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI Clothes Video 首页" })).toHaveAttribute("href", "/zh");
    expect(screen.getByRole("link", { name: "查看价格" })).toHaveAttribute("href", "/zh/pricing");
    expect(mocks.loginForm).toHaveBeenCalledWith(
      { callbackURL: "/zh/workspace", language: "zh-CN" },
      undefined,
    );
  });

  it("shows public product proof and compliance links before sign-in", async () => {
    render(await LoginPage({}));

    expect(
      screen.getByText(
        /Turn three authorized clothing images into a promotional product video/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/independent product that uses third-party AI models/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Generated red dress product video preview",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View product demo" })).toHaveAttribute(
      "href",
      "/#source-proof",
    );
    expect(screen.getByRole("link", { name: "View pricing" })).toHaveAttribute(
      "href",
      "/pricing",
    );
    expect(screen.getByRole("link", { name: "Start free trial" })).toHaveAttribute(
      "href",
      "/workspace?mode=trial&preset=minimal_studio",
    );
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: "Acceptable Use" })).toHaveAttribute(
      "href",
      "/acceptable-use",
    );
    expect(
      screen.getByRole("link", { name: "support@aiclothesvideo.com" }),
    ).toHaveAttribute("href", "mailto:support@aiclothesvideo.com");
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
      { callbackURL: "/workspace?mode=trial&preset=minimal_studio", language: "en" },
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
      { callbackURL: "/workspace", language: "en" },
      undefined,
    );
  });
});
