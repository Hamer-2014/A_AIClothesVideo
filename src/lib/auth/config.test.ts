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
