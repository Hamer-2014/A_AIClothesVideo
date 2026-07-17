import { NextResponse } from "next/server";

import { createDrizzleAdminAuditStore, getRequestMeta } from "@/server/admin/audit";
import {
  createDrizzleAdminRightsRemovalStore,
  updateRightsRemovalStatus,
} from "@/server/admin/rights-removal";
import type { RightsRemovalStatus } from "@/server/compliance/rights-removal";
import { getAdminSession, type AdminSession } from "@/server/auth/admin-session";

const statuses = new Set<RightsRemovalStatus>([
  "received",
  "triaging",
  "awaiting_information",
  "action_required",
  "resolved_removed",
  "resolved_rejected",
]);

interface UpdateRightsRemovalStatusDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  updateStatus?: (input: {
    requestId: string;
    status: RightsRemovalStatus;
    reason: string;
    resolutionSummary?: string | null;
  }) => Promise<unknown>;
}

function parseBody(value: unknown) {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const status =
    typeof record.status === "string" &&
    statuses.has(record.status as RightsRemovalStatus)
      ? (record.status as RightsRemovalStatus)
      : null;
  const reason = typeof record.reason === "string" ? record.reason : "";
  const resolutionSummary =
    typeof record.resolutionSummary === "string"
      ? record.resolutionSummary
      : undefined;
  if (!status) {
    throw new Error("invalid_rights_removal_status_input");
  }
  return { status, reason, resolutionSummary };
}

export async function handleUpdateRightsRemovalStatusRequest(
  request: Request,
  context: { params: { id: string } },
  deps: UpdateRightsRemovalStatusDeps = {},
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
      { error: "invalid_rights_removal_status_input" },
      { status: 400 },
    );
  }

  try {
    const updated = await (
      deps.updateStatus ??
      ((args) =>
        updateRightsRemovalStatus({
          store: createDrizzleAdminRightsRemovalStore(),
          auditStore: createDrizzleAdminAuditStore(),
          actor: admin,
          requestMeta: getRequestMeta(request),
          ...args,
        }))
    )({ requestId: context.params.id, ...input });
    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("Actor cannot")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (message === "Rights removal request not found.") {
      return NextResponse.json({ error: "rights_removal_not_found" }, { status: 404 });
    }
    if (
      message === "Invalid rights removal status transition." ||
      message === "Admin action reason must be at least 6 characters." ||
      message === "Resolution summary is required."
    ) {
      return NextResponse.json(
        { error: "invalid_rights_removal_status_input" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "rights_removal_status_update_failed" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handleUpdateRightsRemovalStatusRequest(request, {
    params: await context.params,
  });
}
