// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/components/dashboard/sign-out-button", () => ({
  SignOutButton: () => <button type="button">退出</button>,
}));

describe("Home", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows anonymous trial actions to visitors", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "免费试用" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "免费生成 1 条试用视频" }),
    ).toBeInTheDocument();
  });

  it("shows signed-in workspace actions instead of anonymous trial actions", async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { email: "merchant@example.com" },
    });

    render(await Home());

    expect(screen.getByText("merchant@example.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.getByRole("link", { name: "进入工作台" })).toHaveAttribute(
      "href",
      "/workspace",
    );
    expect(screen.queryByRole("link", { name: "登录" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "免费试用" }),
    ).not.toBeInTheDocument();
  });
});
