import { NextResponse } from "next/server";

import {
  getInternalWorkerSecret,
  isInternalWorkerAuthorized,
} from "@/server/internal/auth";
import {
  createDrizzlePostQaStore,
  resolvePostQaResult,
} from "@/server/post-qa/resolve";
import type { JsonValue } from "@/lib/db/schema/common";

interface ResolvePostQaDeps {
  expectedSecret?: string | null;
  resolvePostQa?: (input: {
    jobId: string;
    status: "passed" | "failed";
    mode: "off" | "lite" | "standard" | "strict";
    frameKeys: string[];
    resultJson?: JsonValue | null;
    failureCategory?: string | null;
  }) => Promise<{
    jobId: string;
    status: "deliverable" | "failed_released";
    ledgerType: "capture" | "release";
  }>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function parseMode(value: unknown) {
  return value === "off" ||
    value === "lite" ||
    value === "standard" ||
    value === "strict"
    ? value
    : "standard";
}

function parseBody(body: unknown): {
  jobId: string;
  status: "passed" | "failed";
  mode: "off" | "lite" | "standard" | "strict";
  frameKeys: string[];
  resultJson: JsonValue | null;
  failureCategory: string | null;
} {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";
  const status =
    record.status === "failed" || record.status === "passed"
      ? record.status
      : null;

  if (!jobId || !status) {
    throw new Error("invalid_post_qa_input");
  }

  return {
    jobId,
    status,
    mode: parseMode(record.mode),
    frameKeys: stringArray(record.frameKeys),
    resultJson: (record.resultJson ?? null) as JsonValue | null,
    failureCategory:
      typeof record.failureCategory === "string" ? record.failureCategory : null,
  };
}

function defaultResolvePostQa(input: ReturnType<typeof parseBody>) {
  return resolvePostQaResult({
    postQaStore: createDrizzlePostQaStore(),
    ...input,
  });
}

export async function handleResolvePostQaRequest(
  request: Request,
  deps: ResolvePostQaDeps = {},
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
      { error: "invalid_post_qa_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.resolvePostQa ?? defaultResolvePostQa)(input);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Video job not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "post_qa_resolve_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleResolvePostQaRequest(request);
}
