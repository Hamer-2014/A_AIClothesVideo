import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleShotTemplateStore,
  updateShotTemplateStatus,
} from "@/server/templates/seed";
import type { ShotTemplateStatus } from "@/lib/templates/types";

const allowedStatuses = ["draft", "beta", "active", "paused"] as const;

interface UpdateTemplateStatusDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  updateStatus?: (input: {
    actorRole: "admin" | "operator";
    templateId: string;
    version: number;
    status: ShotTemplateStatus;
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

  if (
    !templateId ||
    !Number.isInteger(version) ||
    !allowedStatuses.includes(status as ShotTemplateStatus)
  ) {
    throw new Error("invalid_template_status_input");
  }

  return {
    templateId,
    version,
    status: status as ShotTemplateStatus,
  };
}

function defaultUpdateStatus(input: {
  actorRole: "admin" | "operator";
  templateId: string;
  version: number;
  status: ShotTemplateStatus;
}) {
  return updateShotTemplateStatus({
    store: createDrizzleShotTemplateStore(),
    ...input,
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
    const result = await (deps.updateStatus ?? defaultUpdateStatus)({
      actorRole: admin.role,
      ...input,
    });

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
