import { describe, expect, it } from "vitest";
import { grantTrialCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { runVirtualTryOnTick, type RuntimeJob, type RuntimeStore } from "./runtime";

describe("virtual try-on runtime tick", () => {
  it("persists a front task and does not submit it again", async () => {
    const job: RuntimeJob = { id: "job", packId: "pack", userId: "user", mode: "front_only", status: "queued", creditCost: 2, lockedUntil: null, assets: [{ view: "front", providerTaskId: null, providerStatus: "pending", attemptCount: 0, r2Key: null }] };
    const store: RuntimeStore = { acquire: async () => job, saveAsset: async (_id, asset) => { job.assets[0] = asset; }, setStatus: async (_id, status) => { job.status = status; }, releaseLease: async () => undefined, scheduleRetry: async () => undefined };
    const credits = createInMemoryCreditLedgerStore(); await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const first = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "task", poll: async () => ({ status: "running", outputUrl: null }), qa: async () => false });
    const second = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => { throw new Error("duplicate_submit"); }, poll: async () => ({ status: "running", outputUrl: null }), qa: async () => false });
    expect(first.action).toBe("submit"); expect(second.action).toBe("poll"); expect(job.assets[0]?.providerTaskId).toBe("task");
  });

  it("persists a retry delay after the first retryable submit failure", async () => {
    const job: RuntimeJob = { id: "job", packId: "pack", userId: "user", mode: "front_only", status: "queued", creditCost: 2, lockedUntil: null, assets: [{ view: "front", providerTaskId: null, providerStatus: "pending", attemptCount: 0, r2Key: null }] };
    const saved: RuntimeJob["assets"][number][] = []; let released = 0; let jobRetryAt: Date | null = null;
    const store: RuntimeStore = { acquire: async () => job, saveAsset: async (_id, asset) => { saved.push(asset); }, setStatus: async (_id, status) => { job.status = status; }, releaseLease: async () => { released++; }, scheduleRetry: async (_id, retryAt) => { jobRetryAt = retryAt; } };
    const credits = createInMemoryCreditLedgerStore(); await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => { const error = new Error("timeout"); (error as Error & { code: string }).code = "timeout"; throw error; }, poll: async () => ({ status: "running", outputUrl: null }), qa: async () => false, now: new Date(0) });
    expect(result.action).toBe("retry"); expect(saved[0]?.attemptCount).toBe(1); expect(saved[0]?.nextRetryAt).toEqual(new Date(30_000)); expect(jobRetryAt).toEqual(new Date(30_000)); expect(released).toBe(1);
  });
});
