import { describe, expect, it } from "vitest";
import { runBillingMaintenanceTick, type BillingMaintenanceStore } from "./maintenance";

describe("virtual try-on billing maintenance", () => {
  it("does not claim a fresh draft", async () => {
    const store: BillingMaintenanceStore = { acquire: async () => null, queue: async () => true, failUnreserved: async () => true, release: async () => true, retry: async () => true, releaseLease: async () => true };
    expect(await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(), reserve: async () => undefined, releaseCredits: async () => undefined })).toEqual({ processed: 0 });
  });
  it("replays the fixed reserve key and queues a stale draft", async () => {
    let key = ""; const job = { id: "job", userId: "u", status: "draft" as const, creditCost: 2, createdAt: new Date(0) };
    const store: BillingMaintenanceStore = { acquire: async () => job, queue: async () => true, failUnreserved: async () => true, release: async () => true, retry: async () => true, releaseLease: async () => true };
    await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(60_000), reserve: async (value) => { key = value; }, releaseCredits: async () => undefined }); expect(key).toBe("virtual-tryon:job:reserve");
  });
});
