import { describe, expect, it } from "vitest";

import { creditPackages, getCreditPackage } from "./packages";

describe("credit packages", () => {
  it("defines the MVP credit packages from the spec", () => {
    expect(creditPackages).toEqual([
      {
        code: "starter",
        name: "Starter",
        creemProductId: "starter",
        amountCents: 999,
        currency: "USD",
        credits: 100,
      },
      {
        code: "creator",
        name: "Creator",
        creemProductId: "creator",
        amountCents: 2999,
        currency: "USD",
        credits: 360,
      },
      {
        code: "studio",
        name: "Studio",
        creemProductId: "studio",
        amountCents: 7999,
        currency: "USD",
        credits: 1100,
      },
    ]);
  });

  it("returns null for unknown package codes", () => {
    expect(getCreditPackage("unknown")).toBeNull();
  });
});
