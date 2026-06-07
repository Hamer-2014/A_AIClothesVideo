import type { WorkerConfig } from "./config";
import { parseStitchPayload, type StitchPayload } from "./payload";

export interface StitchResult {
  stitchJobId: string;
  status: "succeeded" | "failed";
  finalVideoKey?: string | null;
  coverKey?: string | null;
  frameKeys?: string[];
  errorMessage?: string;
}

export type StitchExecutor = (input: StitchPayload) => Promise<StitchResult>;

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function readSecret(request: Request) {
  return (
    request.headers.get("x-worker-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    ""
  );
}

export async function handleRequest(
  request: Request,
  {
    config,
    stitch,
  }: {
    config: Pick<WorkerConfig, "workerSecret">;
    stitch: StitchExecutor;
  },
) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return json({ ok: true });
  }

  if (request.method !== "POST" || url.pathname !== "/stitch") {
    return json({ error: "not_found" }, { status: 404 });
  }

  if (readSecret(request) !== config.workerSecret) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: StitchPayload;
  try {
    payload = parseStitchPayload(await request.json().catch(() => ({})));
  } catch {
    return json({ error: "invalid_stitch_payload" }, { status: 400 });
  }

  try {
    return json(await stitch(payload));
  } catch (error) {
    return json(
      {
        stitchJobId: payload.stitchJobId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown stitch error",
      },
      { status: 500 },
    );
  }
}
