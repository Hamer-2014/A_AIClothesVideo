import { describe, expect, it } from "vitest";

describe("model-route-resolver", () => {
  it("does not expose database model route resolution at runtime", async () => {
    const resolver = await import("./model-route-resolver");

    expect(resolver).not.toHaveProperty("resolveModelRoute");
    expect(resolver).not.toHaveProperty("createDrizzleModelRouteStore");
  });
});
