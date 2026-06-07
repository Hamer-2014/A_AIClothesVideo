import { NextResponse } from "next/server";

import {
  getAdminSession,
  type AdminSession,
} from "@/server/auth/admin-session";
import {
  createDrizzleBillingOpsStore,
  getBillingOpsOverview,
} from "@/server/admin/billing";

interface GetBillingDeps {
  getAdminSession?: () => Promise<AdminSession | null>;
  getOverview?: (input: { userId?: string }) => Promise<unknown>;
}

function defaultGetOverview(input: { userId?: string }) {
  return getBillingOpsOverview({
    store: createDrizzleBillingOpsStore(),
    userId: input.userId,
  });
}

export async function handleGetBillingRequest(
  request: Request,
  deps: GetBillingDeps = {},
) {
  const admin = await (deps.getAdminSession ?? getAdminSession)();
  if (!admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get("userId") ?? undefined;

  return NextResponse.json(
    await (deps.getOverview ?? defaultGetOverview)({ userId }),
  );
}

export async function GET(request: Request) {
  return handleGetBillingRequest(request);
}
