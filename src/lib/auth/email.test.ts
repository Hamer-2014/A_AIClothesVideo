import { describe, expect, it } from "vitest";

import { buildOtpEmail, getResendEmailConfig } from "./email";
import * as authEmail from "./email";

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
    expect(email.subject).toContain("AI Clothes Video");
    expect(email.html).toContain("123456");
    expect(email.html).toContain("AI Clothes Video");
    expect(email.html).not.toContain("password");
  });

  it("does not expose a Magic Link email builder", () => {
    expect(authEmail).not.toHaveProperty("buildMagicLinkEmail");
  });
});
