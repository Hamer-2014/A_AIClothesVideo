import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  adjustUserCreditsByAdmin,
} from "@/server/admin/billing";
import {
  createDrizzleAdminAuditStore,
  getRequestMeta,
} from "@/server/admin/audit";

interface AdjustCreditsDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  adjustCredits?: (input: {
    targetUserId: string;
    amount: number;
    reason: string;
  }) => Promise<unknown>;
}

function parseBody(body: unknown) {
  const record =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  const amount = typeof record.amount === "number" ? record.amount : Number.NaN;
  const reason = typeof record.reason === "string" ? record.reason.trim() : "";

  if (
    !userId ||
    !Number.isInteger(amount) ||
    amount <= 0 ||
    reason.length < 6
  ) {
    throw new Error("invalid_credit_adjust_input");
  }

  return {
    targetUserId: userId,
    amount,
    reason,
  };
}

function defaultAdjustCredits({
  admin,
  request,
  targetUserId,
  amount,
  reason,
}: {
  admin: AdminSession;
  request: Request;
  targetUserId: string;
  amount: number;
  reason: string;
}) {
  return adjustUserCreditsByAdmin({
    auditStore: createDrizzleAdminAuditStore(),
    actor: admin,
    targetUserId,
    amount,
    reason,
    requestMeta: getRequestMeta(request),
  });
}

export async function handleAdjustCreditsRequest(
  request: Request,
  deps: AdjustCreditsDeps = {},
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
      { error: "invalid_credit_adjust_input" },
      { status: 400 },
    );
  }

  try {
    const result = await (deps.adjustCredits ??
      ((args) => defaultAdjustCredits({ admin, request, ...args })))(input);
    return NextResponse.json(result);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Actor cannot adjust credits."
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (
      error instanceof Error &&
      error.message === "Admin action reason must be at least 6 characters."
    ) {
      return NextResponse.json(
        { error: "invalid_credit_adjust_input" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "credit_adjust_failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleAdjustCreditsRequest(request);
}
