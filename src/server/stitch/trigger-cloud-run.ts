export interface CloudRunStitchPayload {
  stitchJobId: string;
  videoJobId: string;
  segmentKeys: string[];
  finalVideoKey: string;
  coverKey?: string | null;
  frameKeyPrefix?: string | null;
  postQaMode: "off" | "lite" | "standard" | "strict";
  callbackUrl: string;
}

export interface CloudRunStitchTriggerResult {
  accepted: boolean;
  stitchJobId?: string;
}

export function getCloudRunStitchConfig() {
  return {
    cloudRunUrl: process.env.CLOUD_RUN_STITCH_URL ?? "",
    workerSecret: process.env.CLOUD_RUN_STITCH_SECRET ?? "",
  };
}

function buildStitchUrl(cloudRunUrl: string) {
  const trimmed = cloudRunUrl.trim();
  if (!trimmed) {
    throw new Error("CLOUD_RUN_STITCH_URL is not configured.");
  }

  return `${trimmed.replace(/\/+$/, "")}/stitch`;
}

export async function triggerCloudRunStitchJob({
  cloudRunUrl = getCloudRunStitchConfig().cloudRunUrl,
  workerSecret = getCloudRunStitchConfig().workerSecret,
  payload,
  fetch: fetchImpl = fetch,
}: {
  cloudRunUrl?: string;
  workerSecret?: string;
  payload: CloudRunStitchPayload;
  fetch?: typeof fetch;
}): Promise<CloudRunStitchTriggerResult> {
  if (!workerSecret.trim()) {
    throw new Error("CLOUD_RUN_STITCH_SECRET is not configured.");
  }

  const response = await fetchImpl(buildStitchUrl(cloudRunUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-worker-secret": workerSecret,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Cloud Run stitch trigger failed with status ${response.status}.`);
  }

  return (await response.json()) as CloudRunStitchTriggerResult;
}
