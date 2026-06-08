import { NextResponse } from "next/server";

import { mvpShotTemplates } from "@/lib/templates/catalog";
import {
  analyzeVideoJobAssets,
  createDrizzleVideoJobAssetStore,
} from "@/server/assets/job-analysis";
import { createDrizzleJobLockStore } from "@/server/jobs/locks";
import { createDrizzleJobStore } from "@/server/jobs/state-machine";
import { createDrizzlePostQaJobStore, getPostQaJobInput } from "@/server/post-qa/jobs";
import { runPostQaCheck } from "@/server/post-qa/check";
import {
  createAndTriggerStitchJobForVideo,
  createDrizzleStitchStore,
} from "@/server/stitch/jobs";
import { runWorkerTick } from "@/server/workers/tick";
import {
  createDrizzleVideoSegmentStore,
  defaultStoreProviderOutput,
  pollSubmittedSegment,
  submitQueuedSegment,
} from "@/server/video/segments";
import { runGenerationWorkerTick } from "@/server/workers/generation-tick";
import { runPostQaWorkerTick } from "@/server/workers/post-qa-tick";

interface WorkerTickResult {
  processed: number;
  succeeded: number;
  failed: number;
  stages?: Record<string, WorkerTickStageResult>;
}

interface WorkerTickStageResult {
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
  const lockStore = createDrizzleJobLockStore();
  const jobAssetStore = createDrizzleVideoJobAssetStore();
  const segmentStore = createDrizzleVideoSegmentStore();
  const stitchStore = createDrizzleStitchStore();
  const postQaJobStore = createDrizzlePostQaJobStore();

  const analysis = await runWorkerTick({
    workerId: `cron:${Date.now()}`,
    lockStore,
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
  const generation = await runGenerationWorkerTick({
    workerId: `cron:${Date.now()}:generation`,
    lockStore,
    jobStore,
    handlers: {
      submitSegments: async (job) => {
        const segments = await segmentStore.listSegmentsForJob(job.id);
        for (const segment of segments.filter((item) => item.status === "queued")) {
          await submitQueuedSegment({
            jobStore,
            segmentStore,
            jobId: job.id,
            segmentId: segment.id,
          });
        }
      },
      pollSegments: async (job) => {
        const segments = await segmentStore.listSegmentsForJob(job.id);
        for (const segment of segments.filter(
          (item) => item.status === "generating" && item.providerTaskId,
        )) {
          await pollSubmittedSegment({
            jobStore,
            segmentStore,
            jobId: job.id,
            segmentId: segment.id,
            storeProviderOutput: defaultStoreProviderOutput,
          });
        }
      },
      createStitchJob: async (job) => {
        await createAndTriggerStitchJobForVideo({
          jobStore,
          stitchStore,
          jobId: job.id,
        });
      },
    },
  });
  const postQa = await runPostQaWorkerTick({
    workerId: `cron:${Date.now()}:post-qa`,
    lockStore,
    jobStore,
    checkPostQa: async (job) => {
      const input = await getPostQaJobInput({
        store: postQaJobStore,
        jobId: job.id,
      });
      await runPostQaCheck({
        jobStore,
        jobId: input.jobId,
        userId: input.userId,
        mode: input.mode,
        frameKeys: input.frameKeys,
      });
    },
  });

  return {
    processed: analysis.processed + generation.processed + postQa.processed,
    succeeded: analysis.succeeded + generation.succeeded + postQa.succeeded,
    failed: analysis.failed + generation.failed + postQa.failed,
    stages: { analysis, generation, postQa },
  };
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
