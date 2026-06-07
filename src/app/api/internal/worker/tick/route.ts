import { NextResponse } from "next/server";

import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  analyzeVideoJobAssets,
  createDrizzleVideoJobAssetStore,
} from "@/server/assets/job-analysis";
import { createDrizzleJobLockStore } from "@/server/jobs/locks";
import { createDrizzleJobStore } from "@/server/jobs/state-machine";
import { runWorkerTick } from "@/server/workers/tick";

interface WorkerTickResult {
  processed: number;
  succeeded: number;
  failed: number;
}

interface WorkerTickRouteDeps {
  runTick?: () => Promise<WorkerTickResult>;
}

function getCronSecret() {
  return process.env.CRON_JOB_SECRET;
}

function requestSecret(request: Request) {
  return (
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

async function defaultRunTick(): Promise<WorkerTickResult> {
  const jobStore = createDrizzleJobStore();
  const jobAssetStore = createDrizzleVideoJobAssetStore();

  return runWorkerTick({
    workerId: `cron:${Date.now()}`,
    lockStore: createDrizzleJobLockStore(),
    jobStore,
    eligibleJobStatuses: ["asset_analysis_queued"],
    handlers: {
      liteCheck: async () => {
        throw new Error("Lite check worker is not implemented yet.");
      },
      assetAnalysis: async (job) => {
        await analyzeVideoJobAssets({
          jobStore,
          jobAssetStore,
          jobId: job.id,
          userId: job.userId,
          mode: "standard",
          templates: mvpShotTemplates,
          isTrial: false,
          manageJobStatus: false,
        });
      },
    },
  });
}

export async function handleWorkerTickRequest(
  request: Request,
  deps: WorkerTickRouteDeps = {},
) {
  const expectedSecret = getCronSecret();

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "cron_not_configured" },
      { status: 503 },
    );
  }

  if (requestSecret(request) !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await (deps.runTick ?? defaultRunTick)();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "worker_tick_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleWorkerTickRequest(request);
}
