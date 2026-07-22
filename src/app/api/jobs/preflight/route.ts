import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleVideoJobCreationStore,
} from "@/server/jobs/create-job";
import {
  preflightVideoJob,
  type JobPreflightResult,
} from "@/server/jobs/preflight";
import {
  defaultCaptureProtocolId,
  isCaptureProtocolId,
  type CaptureProtocolId,
} from "@/lib/video/capture-protocols";

type JobSession = {
  user?: {
    id?: string;
  };
} | null;

interface JobPreflightRouteDeps {
  getSession?: () => Promise<JobSession>;
  preflight?: (input: {
    userId: string;
    assetIds: string[];
    durationSeconds: number;
    aspectRatio: string;
    presetId?: string | null;
    captureProtocol?: CaptureProtocolId | null;
    useFreeTrialIfAvailable?: boolean;
  }) => Promise<JobPreflightResult>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function numberValue(value: unknown) {
  return typeof value === "number" ? value : Number.NaN;
}

export async function handleJobPreflightRequest(
  request: Request,
  deps: JobPreflightRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const input = body as Record<string, unknown>;
  const assetIds = stringArray(input.assetIds);
  const durationSeconds = numberValue(input.durationSeconds);
  const aspectRatio = typeof input.aspectRatio === "string" ? input.aspectRatio : "";
  const presetId = typeof input.presetId === "string" ? input.presetId : null;
  const captureProtocol = isCaptureProtocolId(input.captureProtocol)
    ? input.captureProtocol
    : defaultCaptureProtocolId;
  const useFreeTrialIfAvailable =
    typeof input.useFreeTrialIfAvailable === "boolean"
      ? input.useFreeTrialIfAvailable
      : undefined;
  const runPreflight =
    deps.preflight ??
    ((preflightInput) =>
      preflightVideoJob({
        store: createDrizzleVideoJobCreationStore(),
        ...preflightInput,
      }));

  const result = await runPreflight({
    userId,
    assetIds,
    durationSeconds,
    aspectRatio,
    presetId,
    captureProtocol,
    useFreeTrialIfAvailable,
  });

  return NextResponse.json(result, { status: 200 });
}

export async function POST(request: Request) {
  return handleJobPreflightRequest(request);
}
