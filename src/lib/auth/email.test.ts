import { describe, expect, it } from "vitest";

import {
  buildMagicLinkEmail,
  buildOtpEmail,
  getResendEmailConfig,
} from "./email";

describe("auth email helpers", () => {
  it("fails closed when Resend configuration is missing", () => {
    expect(() =>
      getResendEmailConfig({
        RESEND_API_KEY: "",
        EMAIL_FROM: "RunwayTools <login@example.com>",
      }),
    ).toThrow("RESEND_API_KEY is required to send authentication email.");

    expect(() =>
      getResendEmailConfig({
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "",
      }),
    ).toThrow("EMAIL_FROM is required to send authentication email.");
  });

  it("renders OTP email without exposing password language", () => {
    const email = buildOtpEmail({
      email: "seller@example.com",
      otp: "123456",
      type: "sign-in",
    });

    expect(email.subject).toContain("登录验证码");
    expect(email.html).toContain("123456");
    expect(email.html).not.toContain("password");
  });

  it("renders magic link email", () => {
    const email = buildMagicLinkEmail({
      email: "seller@example.com",
      url: "https://example.com/auth/callback?token=abc",
    });

    expect(email.subject).toContain("登录链接");
    expect(email.html).toContain("https://example.com/auth/callback?token=abc");
  });
});
