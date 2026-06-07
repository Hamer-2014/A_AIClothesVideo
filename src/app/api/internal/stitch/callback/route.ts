import { NextResponse } from "next/server";

import {
  getInternalWorkerSecret,
  isInternalWorkerAuthorized,
} from "@/server/internal/auth";
import {
  createDrizzleStitchStore,
  handleStitchCallback,
} from "@/server/stitch/jobs";
import type { JsonValue } from "@/lib/db/schema/common";

interface StitchCallbackDeps {
  expectedSecret?: string | null;
  handleCallback?: (input: {
    stitchJobId: string;
    status: "succeeded" | "failed";
    finalVideoKey?: string | null;
    coverKey?: string | null;
    frameKeys?: string[];
    callbackSnapshot?: JsonValue;
  }) => Promise<{
    jobId: string;
    stitchJobId: string;
    status: "post_qa_queued" | "post_qa_failed";
  }>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function parseBody(body: unknown): {
  stitchJobId: string;
  status: "succeeded" | "failed";
  finalVideoKey: string | null;
  coverKey: string | null;
  frameKeys: string[];
  callbackSnapshot: JsonValue;
} {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const stitchJobId =
    typeof record.stitchJobId === "string" ? record.stitchJobId.trim() : "";
  const status =
    record.status === "failed" || record.status === "succeeded"
      ? record.status
      : null;

  if (!stitchJobId || !status) {
    throw new Error("invalid_stitch_callback");
  }

  return {
    stitchJobId,
    status,
    finalVideoKey:
      typeof record.finalVideoKey === "string" ? record.finalVideoKey : null,
    coverKey: typeof record.coverKey === "string" ? record.coverKey : null,
    frameKeys: stringArray(record.frameKeys),
    callbackSnapshot: record as JsonValue,
  };
}

function defaultHandleCallback(input: ReturnType<typeof parseBody>) {
  return handleStitchCallback({
    stitchStore: createDrizzleStitchStore(),
    ...input,
  });
}

export async function handleStitchCallbackRequest(
  request: Request,
  deps: StitchCallbackDeps = {},
) {
  if (
    !isInternalWorkerAuthorized({
      request,
      expectedSecret: deps.expectedSecret ?? getInternalWorkerSecret(),
    })
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_stitch_callback" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.handleCallback ?? defaultHandleCallback)(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Stitch job not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "stitch_callback_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleStitchCallbackRequest(request);
}
