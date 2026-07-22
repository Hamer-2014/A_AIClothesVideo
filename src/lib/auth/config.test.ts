import { afterEach, describe, expect, it, vi } from "vitest";
import { users } from "@/lib/db/schema";

const mocks = vi.hoisted(() => ({
  betterAuth: vi.fn(() => ({ auth: true })),
  drizzleAdapter: vi.fn(() => ({ adapter: true })),
  emailOTP: vi.fn((options) => ({ id: "email-otp", options })),
  magicLink: vi.fn((options) => ({ id: "magic-link", options })),
  getDb: vi.fn(() => ({ db: true })),
  buildMagicLinkEmail: vi.fn(() => ({
    subject: "magic",
    html: "<p>magic</p>",
    text: "magic",
  })),
  buildOtpEmail: vi.fn(() => ({
    subject: "otp",
    html: "<p>otp</p>",
    text: "otp",
  })),
  sendAuthEmail: vi.fn(),
  deliverRateLimitedAuthEmail: vi.fn(),
  recordAuthEmailRateLimitError: vi.fn(),
}));

vi.mock("better-auth", () => ({
  betterAuth: mocks.betterAuth,
}));

vi.mock("@better-auth/drizzle-adapter", () => ({
  drizzleAdapter: mocks.drizzleAdapter,
}));

vi.mock("better-auth/plugins", () => ({
  emailOTP: mocks.emailOTP,
  magicLink: mocks.magicLink,
}));

vi.mock("@/lib/db/client", () => ({
  getDb: mocks.getDb,
}));

vi.mock("@/server/auth/email-rate-limit", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/auth/email-rate-limit")
  >("@/server/auth/email-rate-limit");

  return {
    ...actual,
    deliverRateLimitedAuthEmail: mocks.deliverRateLimitedAuthEmail,
    recordAuthEmailRateLimitError: mocks.recordAuthEmailRateLimitError,
  };
});

vi.mock("./email", () => ({
  buildMagicLinkEmail: mocks.buildMagicLinkEmail,
  buildOtpEmail: mocks.buildOtpEmail,
  sendAuthEmail: mocks.sendAuthEmail,
}));

describe("auth config", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("enables burst limits for both authentication email plugins", async () => {
    const { createAuth } = await import("./config");

    createAuth();

    expect(mocks.betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimit: { enabled: true },
      }),
    );
    expect(mocks.emailOTP).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimit: { window: 60, max: 3 },
      }),
    );
    expect(mocks.magicLink).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimit: { window: 60, max: 3 },
      }),
    );
  });

  it("passes request context through both authentication email deliveries", async () => {
    const { createAuth } = await import("./config");
    const request = new Request("https://app.example/api/auth", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    mocks.deliverRateLimitedAuthEmail.mockResolvedValue({
      provider: "resend",
      providerMessageId: "email-1",
    });

    createAuth();
    const otpOptions = mocks.emailOTP.mock.calls.at(-1)?.[0];
    const magicLinkOptions = mocks.magicLink.mock.calls.at(-1)?.[0];

    await otpOptions.sendVerificationOTP(
      { email: "seller@example.com", otp: "123456", type: "sign-in" },
      { request },
    );
    await magicLinkOptions.sendMagicLink(
      {
        email: "seller@example.com",
        url: "https://app.example/api/auth/magic-link/verify?token=abc",
      },
      { request },
    );

    expect(mocks.deliverRateLimitedAuthEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        email: "seller@example.com",
        type: "sign_in_otp",
        request,
      }),
    );
    expect(mocks.deliverRateLimitedAuthEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        email: "seller@example.com",
        type: "magic_link",
        request,
      }),
    );
  });

  it("maps persistent email limits to a structured 429 response", async () => {
    const { AuthEmailRateLimitError } = await import(
      "@/server/auth/email-rate-limit"
    );
    const { createAuth } = await import("./config");
    mocks.deliverRateLimitedAuthEmail.mockRejectedValue(
      new AuthEmailRateLimitError(42),
    );

    createAuth();
    const magicLinkOptions = mocks.magicLink.mock.calls.at(-1)?.[0];

    await expect(
      magicLinkOptions.sendMagicLink(
        {
          email: "seller@example.com",
          url: "https://app.example/api/auth/magic-link/verify?token=abc",
        },
        { request: new Request("https://app.example/api/auth") },
      ),
    ).rejects.toMatchObject({
      status: "TOO_MANY_REQUESTS",
      statusCode: 429,
      body: {
        code: "AUTH_EMAIL_RATE_LIMITED",
        retryAfterSeconds: 42,
      },
      headers: { "Retry-After": "42" },
    });
    expect(mocks.recordAuthEmailRateLimitError).toHaveBeenCalledWith(
      expect.objectContaining({ retryAfterSeconds: 42 }),
    );
  });

  it("does not throw on module import when auth env vars are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    await expect(import("./config")).resolves.toMatchObject({
      createAuth: expect.any(Function),
      getAuth: expect.any(Function),
    });
  });

  it("throws when getAuth is called without required auth env vars", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    const authConfigModule = await import("./config");

    expect(() => authConfigModule.getAuth()).toThrow(
      "BETTER_AUTH_SECRET is required for authentication.",
    );
  });

  it("keeps Better Auth user emailVerified field aligned with a boolean column", () => {
    expect(users.emailVerified.columnType).toBe("PgBoolean");
  });
});
