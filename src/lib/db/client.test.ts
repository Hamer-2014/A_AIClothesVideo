import { afterEach, describe, expect, it, vi } from "vitest";

import { createDbClient, getDatabaseUrl } from "./client";

describe("database client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("provides transaction support for ledger and worker updates", () => {
    const db = createDbClient("postgres://test:test@example.neon.tech/test");

    expect(typeof db.transaction).toBe("function");
  });

  it("uses a test fallback database URL only in test mode", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "test");

    expect(getDatabaseUrl()).toBe("postgres://test:test@example.neon.tech/test");
  });
});
