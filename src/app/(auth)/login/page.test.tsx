// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import LoginPage from "./page";

describe("login page", () => {
  it("offers Google, Email OTP, and Magic Link without password login", () => {
    render(<LoginPage />);

    expect(screen.getByText("使用 Google 登录")).toBeInTheDocument();
    expect(screen.getByText("发送邮箱验证码")).toBeInTheDocument();
    expect(screen.getByText("发送 Magic Link")).toBeInTheDocument();
    expect(screen.queryByLabelText(/密码/)).not.toBeInTheDocument();
  });
});
