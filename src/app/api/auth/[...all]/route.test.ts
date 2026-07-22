import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AuthEmailRateLimitError,
  recordAuthEmailDeliveryError,
  recordAuthEmailRateLimitError,
} from "@/server/auth/email-rate-limit";

const mocks = vi.hoisted(() => ({
  getAuthMock: vi.fn(),
  nextHandlerMock: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => mocks.nextHandlerMock),
}));

vi.mock("@/lib/auth/config", () => ({
  getAuth: mocks.getAuthMock,
}));

import { GET, POST } from "./route";

describe("better-auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports GET and POST handlers", () => {
    expect(GET).toEqual(expect.any(Function));
    expect(POST).toEqual(expect.any(Function));
  });

  it("returns 503 when auth is not configured", async () => {
    mocks.getAuthMock.mockImplementation(() => {
      throw new Error("BETTER_AUTH_SECRET is required for authentication.");
    });

    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/social", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "auth_not_configured",
    });
  });

  it("rethrows downstream adapter/database errors", async () => {
    const databaseError = new Error(
      "invalid input syntax for type uuid: \"random-string-id\"",
    );

    mocks.getAuthMock.mockReturnValue({});
    mocks.nextHandlerMock.POST.mockRejectedValueOnce(databaseError);

    await expect(
      POST(
        new Request("http://localhost/api/auth/sign-in/social", {
          method: "POST",
        }),
      ),
    ).rejects.toBe(databaseError);
  });

  it("returns a structured 429 when the OTP plugin swallows the delivery error", async () => {
    mocks.getAuthMock.mockReturnValue({});
    mocks.nextHandlerMock.POST.mockImplementationOnce(async () => {
      recordAuthEmailRateLimitError(new AuthEmailRateLimitError(42));
      return Response.json({ success: true });
    });

    const response = await POST(
      new Request(
        "http://localhost/api/auth/email-otp/send-verification-otp",
        { method: "POST" },
      ),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toEqual({
      code: "AUTH_EMAIL_RATE_LIMITED",
      message: "发送过于频繁，请稍后重试。",
      retryAfterSeconds: 42,
    });
  });

  it("returns a structured failure when the OTP plugin swallows a provider error", async () => {
    mocks.getAuthMock.mockReturnValue({});
    mocks.nextHandlerMock.POST.mockImplementationOnce(async () => {
      recordAuthEmailDeliveryError(new Error("resend unavailable"));
      return Response.json({ success: true });
    });

    const response = await POST(
      new Request(
        "http://localhost/api/auth/email-otp/send-verification-otp",
        { method: "POST" },
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      code: "AUTH_EMAIL_DELIVERY_FAILED",
      message: "邮件发送失败，请稍后重试。",
    });
  });

  it("normalizes Better Auth burst-limit responses for email send endpoints", async () => {
    mocks.getAuthMock.mockReturnValue({});
    mocks.nextHandlerMock.POST.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: { "X-Retry-After": "17" },
        },
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/auth/sign-in/magic-link", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("17");
    await expect(response.json()).resolves.toMatchObject({
      code: "AUTH_EMAIL_RATE_LIMITED",
      retryAfterSeconds: 17,
    });
  });
});
