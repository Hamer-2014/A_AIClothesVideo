import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleTemplateActionStore,
  updateTemplateStatusByAdmin,
} from "@/server/admin/template-actions";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";
import type { ShotTemplateStatus } from "@/lib/templates/types";

const allowedStatuses = ["draft", "beta", "active", "paused"] as const;

interface UpdateTemplateStatusDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  updateStatus?: (input: {
    templateId: string;
    version: number;
    status: ShotTemplateStatus;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const templateId =
    typeof record.templateId === "string" ? record.templateId.trim() : "";
  const version = typeof record.version === "number" ? record.version : Number.NaN;
  const status = record.status;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (
    !templateId ||
    !Number.isInteger(version) ||
    !allowedStatuses.includes(status as ShotTemplateStatus) ||
    reason.length < 6
  ) {
    throw new Error("invalid_template_status_input");
  }

  return {
    templateId,
    version,
    status: status as ShotTemplateStatus,
    reason,
  };
}

function defaultUpdateStatus(input: {
  admin: AdminSession;
  request: Request;
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
  reason: string;
}) {
  return updateTemplateStatusByAdmin({
    store: createDrizzleTemplateActionStore(),
    auditStore: createDrizzleAdminAuditStore(),
    actor: input.admin,
    templateId: input.templateId,
    version: input.version,
    status: input.status,
    reason: input.reason,
    requestMeta: getRequestMeta(input.request),
  });
}

export async function handleUpdateTemplateStatusRequest(
  request: Request,
  deps: UpdateTemplateStatusDeps = {},
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
      { error: "invalid_template_status_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.updateStatus ??
      ((args) => defaultUpdateStatus({ admin, request, ...args })))(input);

    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot update template status."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_template_status_input" },
        { status: 400 },
      );
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Shot template not found")
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "template_status_update_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleUpdateTemplateStatusRequest(request);
}
