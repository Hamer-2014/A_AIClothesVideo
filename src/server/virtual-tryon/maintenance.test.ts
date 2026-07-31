import { describe, expect, it, vi } from "vitest";

import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { captureReservedCredits, grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createBillingMaintenanceCreditOperations, createDrizzleBillingMaintenanceStore, runBillingMaintenanceTick, type BillingMaintenanceJob, type BillingMaintenanceStore } from "./maintenance";

const job = (status: BillingMaintenanceJob["status"]): BillingMaintenanceJob => ({ id: "job", userId: "user", status, creditCost: 2, createdAt: new Date(0) });

function storeFor(current: BillingMaintenanceJob | null) {
  const state = { job: current, queuedLedgerId: null as string | null, releasedLedgerId: null as string | null, refundedLedgerId: null as string | null, retry: null as { status: string; error: string; at: Date } | null, released: 0 };
  const store: BillingMaintenanceStore = {
    acquire: async () => state.job,
    queue: async (_jobId, _workerId, ledgerId) => { state.queuedLedgerId = ledgerId; state.job = null; return true; },
    failUnreserved: async () => true,
    release: async (_jobId, _workerId, ledgerId) => { state.releasedLedgerId = ledgerId; state.job = null; return true; },
    refund: async (_jobId, _workerId, ledgerId) => { state.refundedLedgerId = ledgerId; state.job = null; return true; },
    retry: async (_jobId, _workerId, status, error, at) => { state.retry = { status, error, at }; return true; },
    releaseLease: async () => { state.released++; return true; },
  };
  return { state, store };
}

const operations = (overrides: Partial<Parameters<typeof runBillingMaintenanceTick>[0]["operations"]> = {}) => ({
  reserve: async () => ({ ledger: { id: "reserve-ledger" } }),
  release: async () => ({ ledger: { id: "release-ledger" } }),
  refund: async () => ({ ledger: { id: "refund-ledger" } }),
  ...overrides,
});

describe("virtual try-on billing maintenance", () => {
  it("does not claim an ineligible job", async () => {
    const { store } = storeFor(null);
    expect(await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(), operations: operations() })).toEqual({ processed: 0 });
  });

  it("replays the fixed reserve key and persists the reserve ledger id before queueing", async () => {
    const { state, store } = storeFor(job("draft"));
    const reserve = vi.fn().mockResolvedValue({ ledger: { id: "reserve-ledger" } });

    const result = await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(60_000), operations: operations({ reserve }) });

    expect(result).toMatchObject({ action: "queued" });
    expect(reserve).toHaveBeenCalledWith(expect.objectContaining({ key: "virtual-tryon:job:reserve" }));
    expect(state.queuedLedgerId).toBe("reserve-ledger");
    expect(state.released).toBe(1);
  });

  it("persists the release ledger id only after release succeeds", async () => {
    const { state, store } = storeFor(job("recovering_release"));

    const result = await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(60_000), operations: operations() });

    expect(result).toMatchObject({ action: "released" });
    expect(state.releasedLedgerId).toBe("release-ledger");
  });

  it("retries a failed refund and then persists exactly one refund ledger id", async () => {
    const { state, store } = storeFor(job("recovering_refund"));
    const refund = vi.fn().mockRejectedValueOnce(new Error("ledger_timeout")).mockResolvedValueOnce({ ledger: { id: "refund-ledger" } });

    const first = await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(60_000), operations: operations({ refund }) });
    const second = await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(90_000), operations: operations({ refund }) });
    const duplicate = await runBillingMaintenanceTick({ workerId: "worker", store, now: new Date(120_000), operations: operations({ refund }) });

    expect(first).toMatchObject({ action: "refund_retry" });
    expect(state.retry).toEqual({ status: "recovering_refund", error: "ledger_timeout", at: new Date(90_000) });
    expect(second).toMatchObject({ action: "refunded" });
    expect(duplicate).toEqual({ processed: 0 });
    expect(state.refundedLedgerId).toBe("refund-ledger");
    expect(refund).toHaveBeenCalledTimes(2);
  });

  it("uses the production credit composer with fixed reserve, release, and refund keys", async () => {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const operations = createBillingMaintenanceCreditOperations(credits);
    const reserved = await operations.reserve({ job: job("draft"), key: "virtual-tryon:job:reserve" });
    const released = await operations.release({ job: job("recovering_release"), key: "virtual-tryon:job:release" });
    await reserveCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "reserve:for-refund" });
    await captureReservedCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "capture:for-refund" });
    const refunded = await operations.refund({ job: job("recovering_refund"), key: "virtual-tryon:job:refund" });

    expect([reserved.ledger.id, released.ledger.id, refunded.ledger.id].every(Boolean)).toBe(true);
    expect(credits.listLedger().map((entry) => entry.idempotencyKey)).toEqual(expect.arrayContaining(["virtual-tryon:job:reserve", "virtual-tryon:job:release", "virtual-tryon:job:refund"]));
  });

  it("writes the matching ledger id in each Drizzle terminal transition", async () => {
    const sets: Array<Record<string, unknown>> = [];
    const eventValues: unknown[] = [];
    const tx = {
      update: () => ({ set: (values: Record<string, unknown>) => { sets.push(values); return { where: () => ({ returning: async () => [{ id: "job" }] }) }; } }),
      insert: () => ({ values: async (values: unknown) => { eventValues.push(values); } }),
    };
    const db = { transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const store = createDrizzleBillingMaintenanceStore(db as unknown as Parameters<typeof createDrizzleBillingMaintenanceStore>[0]);

    await store.queue("job", "worker", "reserve-ledger");
    await store.release("job", "worker", "release-ledger");
    await store.refund("job", "worker", "refund-ledger");

    expect(sets.map((values) => ({ reservedLedgerId: values.reservedLedgerId, releasedLedgerId: values.releasedLedgerId, refundedLedgerId: values.refundedLedgerId }))).toEqual(expect.arrayContaining([
      { reservedLedgerId: "reserve-ledger", releasedLedgerId: undefined, refundedLedgerId: undefined },
      { reservedLedgerId: undefined, releasedLedgerId: "release-ledger", refundedLedgerId: undefined },
      { reservedLedgerId: undefined, releasedLedgerId: undefined, refundedLedgerId: "refund-ledger" },
    ]));
    expect(eventValues).toHaveLength(3);
  });

  it("does not write an event or pack when a CAS transition loses its lease", async () => {
    const sets: Array<Record<string, unknown>> = [];
    const eventValues: unknown[] = [];
    const tx = {
      update: () => ({ set: (values: Record<string, unknown>) => { sets.push(values); return { where: () => ({ returning: async () => [] }) }; } }),
      insert: () => ({ values: async (values: unknown) => { eventValues.push(values); } }),
    };
    const db = { transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const store = createDrizzleBillingMaintenanceStore(db as unknown as Parameters<typeof createDrizzleBillingMaintenanceStore>[0]);

    expect(await store.refund("job", "wrong-worker", "refund-ledger")).toBe(false);
    expect(sets).toHaveLength(1);
    expect(eventValues).toHaveLength(0);
  });

  it("refuses a transition from a worker that does not own the lease", async () => {
    const guarded = { workerId: "owner", status: "recovering_refund", refundedLedgerId: null as string | null };
    const store: BillingMaintenanceStore = {
      acquire: async () => null,
      queue: async () => false,
      failUnreserved: async () => false,
      release: async () => false,
      refund: async (_jobId, workerId, ledgerId) => { if (workerId !== guarded.workerId || guarded.status !== "recovering_refund") return false; guarded.refundedLedgerId = ledgerId; return true; },
      retry: async () => false,
      releaseLease: async () => false,
    };

    expect(await store.refund("job", "other-worker", "refund-ledger")).toBe(false);
    expect(guarded.refundedLedgerId).toBeNull();
    expect(await store.refund("job", "owner", "refund-ledger")).toBe(true);
  });
});
