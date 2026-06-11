import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleAdminJobActionStore,
  createDrizzleAdminPostQaReopenStore,
  reopenPostQaByAdmin,
} from "@/server/admin/job-actions";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";

interface ReopenPostQaDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  reopenPostQa?: (input: {
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

  if (!reason) {
    throw new Error("invalid_reopen_post_qa_input");
  }

  return { reason };
}

function defaultReopenPostQa({
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
  return reopenPostQaByAdmin({
    actionStore: createDrizzleAdminJobActionStore(),
    postQaStore: createDrizzleAdminPostQaReopenStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    jobId,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleReopenPostQaRequest(
  request: Request,
  context: { params: { id: string } },
  deps: ReopenPostQaDeps = {},
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
      { error: "invalid_reopen_post_qa_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.reopenPostQa ??
      ((args) => defaultReopenPostQa({ admin, request, ...args })))({
      jobId: context.params.id,
      reason: input.reason,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Actor cannot reopen Post-QA.") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (error instanceof Error && error.message === "Video job not found.") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (
      error instanceof Error &&
      (error.message === "Video job is not failed in Post-QA." ||
        error.message === "Successful stitch output is required to reopen Post-QA.")
    ) {
      return NextResponse.json(
        { error: "reopen_post_qa_not_allowed", message: error.message },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "reopen_post_qa_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleReopenPostQaRequest(request, {
    params: await context.params,
  });
}
