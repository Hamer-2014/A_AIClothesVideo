import { afterEach, describe, expect, it, vi } from "vitest";
import { users } from "@/lib/db/schema";

describe("auth config", () => {
  afterEach(() => {
    vi.resetModules();
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
