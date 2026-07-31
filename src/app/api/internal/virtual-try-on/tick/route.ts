import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import { createDrizzleCreditLedgerStore } from "@/lib/credits/drizzle-store";
import { createBillingMaintenanceCreditOperations, createDrizzleBillingMaintenanceStore, runBillingMaintenanceTick } from "@/server/virtual-tryon/maintenance";
import { createDefaultVirtualTryOnRuntimeDeps, runVirtualTryOnTick } from "@/server/virtual-tryon/runtime";

const defaultLimit = 1;

type TickActionResult = { processed: number; action?: string };
type TickRunner = (input: { workerId: string; now: Date }) => Promise<TickActionResult>;

interface VirtualTryOnTickRouteDeps {
  cronSecret?: string | undefined;
  runMaintenance?: TickRunner;
  runGeneration?: TickRunner;
  now?: () => Date;
  workerId?: () => string;
}

type TickCounters = {
  processed: number;
  submitted: number;
  polled: number;
  ready: number;
  failed: number;
  transferred: number;
  qaQueued: number;
  capturing: number;
  retried: number;
  maintenance: number;
};

function requestSecret(request: Request) {
  return request.headers.get("x-cron-secret")
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
    ?? "";
}

async function parseLimit(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const limit = (body as { limit?: unknown }).limit;
  if (limit === undefined) return defaultLimit;
  return typeof limit === "number" && Number.isInteger(limit) && limit >= 1 && limit <= 20 ? limit : null;
}

function defaultRunners(): { runMaintenance: TickRunner; runGeneration: TickRunner } {
  const credits = createDrizzleCreditLedgerStore();
  const runtimeDeps = createDefaultVirtualTryOnRuntimeDeps({ credits });
  const maintenanceStore = createDrizzleBillingMaintenanceStore();
  const operations = createBillingMaintenanceCreditOperations(credits);
  return {
    runMaintenance: ({ workerId, now }) => runBillingMaintenanceTick({ workerId, now, store: maintenanceStore, operations }),
    runGeneration: ({ workerId, now }) => runVirtualTryOnTick({ workerId, now, ...runtimeDeps }),
  };
}

function emptyCounters(): TickCounters {
  return { processed: 0, submitted: 0, polled: 0, ready: 0, failed: 0, transferred: 0, qaQueued: 0, capturing: 0, retried: 0, maintenance: 0 };
}

function countAction(counters: TickCounters, phase: "maintenance" | "generation", action: string | undefined) {
  if (phase === "maintenance") {
    counters.maintenance += 1;
    if (action === "failed_unreserved" || action === "released" || action === "refunded") counters.failed += 1;
    if (action === "release_retry" || action === "refund_retry") counters.retried += 1;
    return;
  }
  if (action === "submit") counters.submitted += 1;
  if (action === "poll") counters.polled += 1;
  if (action === "transfer") counters.transferred += 1;
  if (action === "qa_queued") counters.qaQueued += 1;
  if (action === "capturing") counters.capturing += 1;
  if (action === "ready") counters.ready += 1;
  if (action === "retry" || action === "capture_retry") counters.retried += 1;
  if (action === "recovering_release" || action === "recovering_refund") counters.failed += 1;
}

export async function handleVirtualTryOnTickRequest(request: Request, deps: VirtualTryOnTickRouteDeps = {}) {
  const expectedSecret = deps.cronSecret ?? process.env.CRON_JOB_SECRET;
  if (!expectedSecret) return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  if (requestSecret(request) !== expectedSecret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await parseLimit(request);
  if (limit === null) return NextResponse.json({ error: "invalid_tick_limit" }, { status: 400 });

  try {
    const defaults = deps.runMaintenance && deps.runGeneration ? undefined : defaultRunners();
    const runMaintenance = deps.runMaintenance ?? defaults?.runMaintenance;
    const runGeneration = deps.runGeneration ?? defaults?.runGeneration;
    if (!runMaintenance || !runGeneration) throw new Error("virtual_tryon_tick_runner_missing");

    const counters = emptyCounters();
    const rootWorkerId = deps.workerId?.() ?? `virtual-tryon-cron:${randomUUID()}`;
    const now = deps.now?.() ?? new Date();
    for (let index = 0; counters.processed < limit; index += 1) {
      const preferred = index % 2 === 0 ? "maintenance" : "generation";
      const fallback = preferred === "maintenance" ? "generation" : "maintenance";
      const run = async (phase: "maintenance" | "generation") => {
        const runner = phase === "maintenance" ? runMaintenance : runGeneration;
        const result = await runner({ workerId: `${rootWorkerId}:${phase}`, now });
        if (result.processed !== 1) return false;
        counters.processed += 1;
        countAction(counters, phase, result.action);
        return true;
      };
      if (await run(preferred)) continue;
      if (!(await run(fallback))) break;
    }
    return NextResponse.json(counters);
  } catch {
    return NextResponse.json({ error: "virtual_tryon_tick_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleVirtualTryOnTickRequest(request);
}
