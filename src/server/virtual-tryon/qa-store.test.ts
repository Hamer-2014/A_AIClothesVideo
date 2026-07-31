import { describe, expect, it } from "vitest";
import { createInMemoryVirtualTryOnQaStore } from "./qa-store";

describe("virtual try-on QA store", () => {
  it("upserts view and cross results without duplicates", async () => {
    const store = createInMemoryVirtualTryOnQaStore();
    await store.upsertViewResult("pack", "front", { verdict: "pass" }); await store.upsertViewResult("pack", "front", { verdict: "fail" });
    await store.upsertCrossResult("pack", { verdict: "pass" }); await store.upsertCrossResult("pack", { verdict: "fail" });
    expect(await store.findResults("pack")).toHaveLength(2);
  });
  it("keeps summaries isolated by pack", async () => { const store = createInMemoryVirtualTryOnQaStore(); await store.updateQaSummary("a", { passed: true }); expect(await store.getQaSummary("b")).toBeNull(); });
});
