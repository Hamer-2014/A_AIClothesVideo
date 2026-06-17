import { NextResponse } from "next/server";

import {
  createDrizzleAdminFunnelStore,
  getAdminFunnelSummary,
} from "@/server/admin/funnel";
import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";

interface GetAdminFunnelSummaryDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  getSummary?: () => Promise<unknown>;
}

function defaultGetSummary() {
  return getAdminFunnelSummary({
    store: createDrizzleAdminFunnelStore(),
  });
}

export async function handleGetAdminFunnelSummaryRequest(
  request: Request,
  deps: GetAdminFunnelSummaryDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  void request;

  return NextResponse.json(await (deps.getSummary ?? defaultGetSummary)());
}

export async function GET(request: Request) {
  return handleGetAdminFunnelSummaryRequest(request);
}
