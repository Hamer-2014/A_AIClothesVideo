import { describe, expect, it, vi } from "vitest";
import { grantTrialCredits, reserveCredits } from "@/lib/credits/ledger";
import { createInMemoryCreditLedgerStore } from "@/lib/credits/memory-store";
import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createInMemoryVirtualTryOnQaStore } from "./qa-store";
import { runVirtualTryOnTick, type RuntimeJob, type RuntimeStore } from "./runtime";

describe("virtual try-on runtime tick", () => {
  function qaReadyStore(status: RuntimeJob["status"] = "generating") {
    const job: RuntimeJob = {
      id: "job",
      packId: "pack",
      userId: "user",
      mode: "front_only",
      status,
      creditCost: 2,
      lockedUntil: null,
      sourceKeys: { front: "source/front.png" },
      modelKeys: { front: "models/front.png", side: "models/side.png", back: "models/back.png" },
      assets: [{ view: "front", providerTaskId: "task", providerStatus: "succeeded", attemptCount: 1, r2Key: "virtual-try-on/job/packs/pack/front.png" }],
    };
    const events: string[] = [];
    const pack = { status: status === "ready" ? "ready" : status === "qa_queued" || status === "capturing" ? "qa_queued" : "generating" };
    const store = {
      acquire: async () => job,
      saveAsset: async (_id: string, asset: RuntimeJob["assets"][number]) => { job.assets[0] = asset; },
      setStatus: async (_id: string, next: RuntimeJob["status"]) => { job.status = next; },
      releaseLease: async () => undefined,
      scheduleRetry: async () => undefined,
      transitionAssetsReadyToQaQueued: async () => { if (job.status !== "generating") return false; job.status = "qa_queued"; pack.status = "qa_queued"; events.push("qa_queued"); return true; },
      resolveQa: async (_id: string, _packId: string, _workerId: string, passed: boolean) => { if (job.status !== "qa_queued") return false; job.status = passed ? "capturing" : "recovering_release"; events.push(passed ? "capturing" : "recovering_release"); return true; },
      finalizeCapturedPack: async (_id: string, ledgerId: string) => { if (job.status !== "capturing") return false; job.status = "ready"; pack.status = "ready"; events.push("ready:" + ledgerId); return true; },
      scheduleCapturePersistenceRetry: async () => undefined,
      transitionCaptureToRefund: async () => undefined,
    };
    return { job, pack, events, store: store as unknown as RuntimeStore };
  }

  async function reservedCredits() {
    const credits = createInMemoryCreditLedgerStore();
    await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    await reserveCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "virtual-tryon:job:reserve" });
    return credits;
  }

  it("moves completed required assets to qa_queued without running QA or capture", async () => {
    const { job, pack, events, store } = qaReadyStore();
    const credits = await reservedCredits();
    const qa = vi.fn().mockResolvedValue({ allPassed: true });

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa });

    expect(result.action).toBe("qa_queued");
    expect(job.status).toBe("qa_queued");
    expect(pack.status).toBe("qa_queued");
    expect(events).toEqual(["qa_queued"]);
    expect(qa).not.toHaveBeenCalled();
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(0);
  });

  it("moves a QA pass to capturing and captures only on the following tick", async () => {
    const { job, pack, events, store } = qaReadyStore("qa_queued");
    const credits = await reservedCredits();
    const qa = vi.fn().mockResolvedValue({ allPassed: true });

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa });

    expect(result.action).toBe("capturing");
    expect(job.status).toBe("capturing");
    expect(pack.status).toBe("qa_queued");
    expect(events).toEqual(["capturing"]);
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(0);
  });

  it("runs the strict QA engine from qa_queued before entering capturing", async () => {
    const { job, store } = qaReadyStore("qa_queued");
    const credits = await reservedCredits();
    const qaStore = createInMemoryVirtualTryOnQaStore();
    const visionProvider = vi.fn().mockResolvedValue({ provider: "vision", model: "strict", qaJson: { verdict: "pass", targetView: "front", garment: { silhouette: "match", color: "match", pattern: "match", visibleDetails: "match" }, person: { anatomy: "natural", identityConsistency: "match" }, inventedDetails: false, evidence: [] }, raw: { ignored: true } });

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qaDeps: { signer: async (key) => "https://signed.example/" + key, visionProvider, qaStore, providerLogStore: createInMemoryProviderCallLogStore() } });

    expect(result.action).toBe("capturing");
    expect(visionProvider).toHaveBeenCalledTimes(1);
    expect(await qaStore.findResults(job.packId)).toHaveLength(1);
  });

  it("sends a strict QA failure to recovering_release without capture", async () => {
    const { job, pack, events, store } = qaReadyStore("qa_queued");
    const credits = await reservedCredits();

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa: async () => ({ allPassed: false }) });

    expect(result.action).toBe("recovering_release");
    expect(job.status).toBe("recovering_release");
    expect(pack.status).toBe("qa_queued");
    expect(events).toEqual(["recovering_release"]);
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(0);
  });

  it("fails closed to recovering_release when the QA runner throws", async () => {
    const { job, events, store } = qaReadyStore("qa_queued");
    const credits = await reservedCredits();

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa: async () => { throw new Error("vision_unavailable"); } });

    expect(result.action).toBe("recovering_release");
    expect(job.status).toBe("recovering_release");
    expect(events).toEqual(["recovering_release"]);
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(0);
  });

  it("keeps capturing after a temporary ready persistence failure and retries idempotent capture", async () => {
    const { job, pack, events, store } = qaReadyStore("capturing");
    const credits = await reservedCredits();
    let finalizeCalls = 0;
    let scheduled = 0;
    store.finalizeCapturedPack = async () => {
      finalizeCalls++;
      if (finalizeCalls === 1) throw new Error("database_timeout");
      job.status = "ready";
      pack.status = "ready";
      events.push("ready");
      return true;
    };
    store.scheduleCapturePersistenceRetry = async () => {
      scheduled++;
      return "retry";
    };

    const first = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }) });
    const second = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }) });

    expect(first.action).toBe("capture_retry");
    expect(second.action).toBe("ready");
    expect(scheduled).toBe(1);
    expect(job.status).toBe("ready");
    expect(pack.status).toBe("ready");
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(1);
  });

  it("moves an explicitly permanent ready persistence failure to recovering_refund", async () => {
    const { job, store } = qaReadyStore("capturing");
    const credits = await reservedCredits();
    store.finalizeCapturedPack = async () => {
      const error = new Error("ready_persistence_permanent");
      (error as Error & { code: string }).code = "ready_persistence_permanent";
      throw error;
    };
    store.transitionCaptureToRefund = async () => {
      job.status = "recovering_refund";
      return true;
    };

    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }) });

    expect(result.action).toBe("recovering_refund");
    expect(job.status).toBe("recovering_refund");
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(1);
  });

  it("captures idempotently then synchronizes job, pack, and state event", async () => {
    const { job, pack, events, store } = qaReadyStore("capturing");
    const credits = await reservedCredits();

    const first = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa: async () => ({ allPassed: true }) });
    const second = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "unexpected", poll: async () => ({ status: "succeeded", outputUrl: null }), qa: async () => ({ allPassed: true }) });

    expect(first.action).toBe("ready");
    expect(second.action).toBe("ignored");
    expect(job.status).toBe("ready");
    expect(pack.status).toBe("ready");
    expect(events).toHaveLength(1);
    expect(credits.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(1);
  });

  it("persists a front task and does not submit it again", async () => {
    const job: RuntimeJob = { id: "job", packId: "pack", userId: "user", mode: "front_only", status: "queued", creditCost: 2, lockedUntil: null, sourceKeys: { front: "source" }, modelKeys: { front: "models/front", side: "models/side", back: "models/back" }, assets: [{ view: "front", providerTaskId: null, providerStatus: "pending", attemptCount: 0, r2Key: null }] };
    const store: RuntimeStore = { acquire: async () => job, saveAsset: async (_id, _workerId, asset) => { job.assets[0] = asset; return true; }, transitionToGenerating: async (_id, _workerId, status) => { job.status = status === "queued" ? "generating" : status; return true; }, transitionAssetsReadyToQaQueued: async () => true, resolveQa: async () => true, finalizeCapturedPack: async () => true, scheduleCapturePersistenceRetry: async () => "retry", transitionCaptureToRefund: async () => true, transitionToRecoveringRelease: async () => true, releaseLease: async () => true, scheduleRetry: async () => true };
    const credits = createInMemoryCreditLedgerStore(); await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const first = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => "task", poll: async () => ({ status: "running", outputUrl: null }), qa: async () => ({ allPassed: false }) });
    const second = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => { throw new Error("duplicate_submit"); }, poll: async () => ({ status: "running", outputUrl: null }), qa: async () => ({ allPassed: false }) });
    expect(first.action).toBe("submit"); expect(second.action).toBe("poll"); expect(job.assets[0]?.providerTaskId).toBe("task");
  });

  it("persists a retry delay after the first retryable submit failure", async () => {
    const job: RuntimeJob = { id: "job", packId: "pack", userId: "user", mode: "front_only", status: "queued", creditCost: 2, lockedUntil: null, sourceKeys: { front: "source" }, modelKeys: { front: "models/front", side: "models/side", back: "models/back" }, assets: [{ view: "front", providerTaskId: null, providerStatus: "pending", attemptCount: 0, r2Key: null }] };
    const saved: RuntimeJob["assets"][number][] = []; let released = 0; let jobRetryAt: Date | null = null;
    const store: RuntimeStore = { acquire: async () => job, saveAsset: async (_id, _workerId, asset) => { saved.push(asset); return true; }, transitionToGenerating: async () => true, transitionAssetsReadyToQaQueued: async () => true, resolveQa: async () => true, finalizeCapturedPack: async () => true, scheduleCapturePersistenceRetry: async () => "retry", transitionCaptureToRefund: async () => true, transitionToRecoveringRelease: async () => true, releaseLease: async () => { released++; return true; }, scheduleRetry: async (_id, _workerId, retryAt) => { jobRetryAt = retryAt; return true; } };
    const credits = createInMemoryCreditLedgerStore(); await grantTrialCredits({ store: credits, userId: "user", amount: 2, reason: "test", idempotencyKey: "grant" });
    const result = await runVirtualTryOnTick({ workerId: "worker", store, credits, submit: async () => { const error = new Error("timeout"); (error as Error & { code: string }).code = "timeout"; throw error; }, poll: async () => ({ status: "running", outputUrl: null }), qa: async () => ({ allPassed: false }), now: new Date(0) });
    expect(result.action).toBe("retry"); expect(saved[0]?.attemptCount).toBe(1); expect(saved[0]?.nextRetryAt).toEqual(new Date(30_000)); expect(jobRetryAt).toEqual(new Date(30_000)); expect(released).toBe(1);
  });
});
