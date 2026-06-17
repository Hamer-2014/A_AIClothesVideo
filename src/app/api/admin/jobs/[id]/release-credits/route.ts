import { NextResponse } from "next/server";

import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";
import {
  createDrizzleAdminJobActionStore,
  releaseJobCreditsByAdmin,
} from "@/server/admin/job-actions";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface ReleaseJobCreditsDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  releaseCredits?: (input: {
    jobId: string;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (reason.length < 6) {
    throw new Error("invalid_release_credits_input");
  }

  return { reason };
}

function defaultReleaseCredits({
  admin,
  request,
  jobId,
  reason,
}: {
  admin: AdminSession;
  request: Request;
  jobId: string;
  reason: string;
}) {
  return releaseJobCreditsByAdmin({
    actionStore: createDrizzleAdminJobActionStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    jobId,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleReleaseJobCreditsRequest(
  request: Request,
  context: { params: { id: string } },
  deps: ReleaseJobCreditsDeps = {},
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
      { error: "invalid_release_credits_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.releaseCredits ??
      ((args) => defaultReleaseCredits({ admin, request, ...args })))({
      jobId: context.params.id,
      reason: input.reason,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot release job credits."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_release_credits_input" },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "Video job not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      [
        "Video job reserved credits are already resolved.",
        "Video job has no reserved ledger to release.",
        "Video job has no paid credits to release.",
        "Video job credits cannot be released in this state.",
      ].includes(error.message)
    ) {
      return NextResponse.json(
        { error: "release_credits_not_allowed", message: error.message },
        { status: 409 },
      );
    }

    return NextResponse.json({ error: "release_credits_failed" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleReleaseJobCreditsRequest(request, {
    params: await context.params,
  });
}
