import { afterEach, describe, expect, it, vi } from "vitest";

import { createDbClient, getDatabaseUrl } from "./client";

const driverMocks = vi.hoisted(() => ({
  neonDrizzle: vi.fn(() => ({ transaction: vi.fn() })),
  neonPool: vi.fn(function MockNeonPool(this: { options: unknown }, options: unknown) {
    this.options = options;
  }),
  pgDrizzle: vi.fn(() => ({ transaction: vi.fn() })),
  pgPool: vi.fn(function MockPgPool(this: { options: unknown }, options: unknown) {
    this.options = options;
  }),
}));

vi.mock("@neondatabase/serverless", () => ({
  Pool: driverMocks.neonPool,
}));

vi.mock("drizzle-orm/neon-serverless", () => ({
  drizzle: driverMocks.neonDrizzle,
}));

vi.mock("drizzle-orm/node-postgres", () => ({
  drizzle: driverMocks.pgDrizzle,
}));

vi.mock("pg", () => ({
  Pool: driverMocks.pgPool,
}));

describe("database client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("provides transaction support for ledger and worker updates", () => {
    const db = createDbClient("postgres://test:test@example.neon.tech/test");

    expect(typeof db.transaction).toBe("function");
  });

  it("uses node-postgres for standard Postgres URLs", () => {
    const databaseUrl = "postgres://test:test@db.example.com:5432/app";

    const db = createDbClient(databaseUrl);

    expect(driverMocks.pgPool).toHaveBeenCalledWith({ connectionString: databaseUrl });
    expect(driverMocks.pgDrizzle).toHaveBeenCalled();
    expect(driverMocks.neonPool).not.toHaveBeenCalled();
    expect(driverMocks.neonDrizzle).not.toHaveBeenCalled();
    expect(typeof db.transaction).toBe("function");
  });

  it("uses a test fallback database URL only in test mode", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "test");

    expect(getDatabaseUrl()).toBe("postgres://test:test@example.neon.tech/test");
  });
});
