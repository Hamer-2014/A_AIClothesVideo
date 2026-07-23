import { describe, expect, it } from "vitest";

import { getCreditPackage, getCreditPackages } from "./packages";

describe("credit packages", () => {
  it("reads Creem product IDs from configuration while keeping price and credits server-side", () => {
    expect(
      getCreditPackages({
        CREEM_PRODUCT_ID_STARTER: "prod_starter",
        CREEM_PRODUCT_ID_CREATOR: "prod_creator",
        CREEM_PRODUCT_ID_STUDIO: "prod_studio",
      }),
    ).toEqual([
      {
        code: "starter",
        name: "Starter",
        creemProductId: "prod_starter",
        amountCents: 999,
        currency: "USD",
        credits: 100,
      },
      {
        code: "creator",
        name: "Creator",
        creemProductId: "prod_creator",
        amountCents: 2999,
        currency: "USD",
        credits: 360,
      },
      {
        code: "studio",
        name: "Studio",
        creemProductId: "prod_studio",
        amountCents: 7999,
        currency: "USD",
        credits: 1100,
      },
    ]);
  });

  it("does not expose placeholder product IDs when product configuration is missing", () => {
    expect(getCreditPackage("starter", { NODE_ENV: "production" })).toMatchObject({
      creemProductId: null,
      amountCents: 999,
      currency: "USD",
      credits: 100,
    });
    expect(getCreditPackage("creator", { NODE_ENV: "production" })).toMatchObject({
      creemProductId: null,
      amountCents: 2999,
      currency: "USD",
      credits: 360,
    });
    expect(getCreditPackage("studio", { NODE_ENV: "production" })).toMatchObject({
      creemProductId: null,
      amountCents: 7999,
      currency: "USD",
      credits: 1100,
    });
  });

  it("returns null for unknown package codes", () => {
    expect(getCreditPackage("unknown")).toBeNull();
  });
});
