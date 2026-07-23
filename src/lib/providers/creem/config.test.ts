import { describe, expect, it } from "vitest";

import {
  getCreemEnvironment,
  isCreemPurchasesEnabled,
  isCreemProductionEnvironment,
} from "./config";

describe("Creem environment configuration", () => {
  it("falls back to NODE_ENV when APP_ENV is unknown", () => {
    const env = { APP_ENV: "prod", NODE_ENV: "production" };

    expect(getCreemEnvironment(env)).toBe("production");
    expect(isCreemProductionEnvironment(env)).toBe(true);
  });

  it("keeps a known preview environment distinct from production", () => {
    const env = { APP_ENV: "preview", NODE_ENV: "production" };

    expect(getCreemEnvironment(env)).toBe("preview");
    expect(isCreemProductionEnvironment(env)).toBe(false);
  });

  it("enables purchases only for an explicit true value", () => {
    expect(
      isCreemPurchasesEnabled({ CREEM_PURCHASES_ENABLED: "true" }),
    ).toBe(true);
    expect(
      isCreemPurchasesEnabled({ CREEM_PURCHASES_ENABLED: " TRUE " }),
    ).toBe(true);
    expect(
      isCreemPurchasesEnabled({ CREEM_PURCHASES_ENABLED: "false" }),
    ).toBe(false);
    expect(isCreemPurchasesEnabled({})).toBe(false);
  });
});
