import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("admin-adjust-credits CLI", () => {
  it("creates or increments the wallet in one upsert statement", () => {
    const source = readFileSync("scripts/admin-adjust-credits.mjs", "utf8");

    expect(source).toContain("insert into credit_wallets (user_id, available_balance)");
    expect(source).toContain("on conflict (user_id) do update");
    expect(source).not.toContain("inserted_wallet as");
  });

  it("uses the PostgreSQL TCP driver for a generic database URL", () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/admin-adjust-credits.mjs",
        "--email",
        "seller@example.com",
        "--amount",
        "10",
        "--reason",
        "local test credits",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: "postgres://test:test@127.0.0.1:1/test",
        },
        timeout: 5_000,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ECONNREFUSED/);
    expect(result.stderr).not.toContain("api.127.0.0.1");
  });
});
