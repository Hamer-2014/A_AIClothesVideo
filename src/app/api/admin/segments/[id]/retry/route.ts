import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  retryVideoSegmentByAdmin,
} from "@/server/admin/job-actions";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";

interface RetrySegmentDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  retrySegment?: (input: {
    jobId: string;
    segmentId: string;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const jobId = typeof record.jobId === "string" ? record.jobId.trim() : "";
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (!jobId || !reason) {
    throw new Error("invalid_retry_segment_input");
  }

  return { jobId, reason };
}

function defaultRetrySegment({
  admin,
  request,
  jobId,
  segmentId,
  reason,
}: {
  admin: AdminSession;
  request: Request;
  jobId: string;
  segmentId: string;
  reason: string;
}) {
  return retryVideoSegmentByAdmin({
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    jobId,
    segmentId,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleRetrySegmentRequest(
  request: Request,
  context: { params: { id: string } },
  deps: RetrySegmentDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let input: ReturnType<typeof parseBody>;
  try {
    input = parseBody(await request.json().catch(() => ({})));
  } catch {
    return NextResponse.json(
      { error: "invalid_retry_segment_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.retrySegment ??
      ((args) => defaultRetrySegment({ admin, request, ...args })))({
      jobId: input.jobId,
      segmentId: context.params.id,
      reason: input.reason,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot retry video segments."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Video segment not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "segment_retry_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleRetrySegmentRequest(request, {
    params: await context.params,
  });
}
