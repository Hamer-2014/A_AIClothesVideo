import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleUserBillingStore,
  getUserBillingOverview,
} from "@/server/billing/user-billing";

type BillingSession = {
  user?: {
    id?: string;
  };
} | null;

interface GetBillingOverviewDeps {
  getSession?: () => Promise<BillingSession>;
  getOverview?: (input: { userId: string }) => Promise<unknown>;
}

function defaultGetOverview(input: { userId: string }) {
  return getUserBillingOverview({
    store: createDrizzleUserBillingStore(),
    userId: input.userId,
  });
}

export async function handleGetBillingOverviewRequest(
  _request: Request,
  deps: GetBillingOverviewDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    await (deps.getOverview ?? defaultGetOverview)({ userId }),
  );
}

export async function GET(request: Request) {
  return handleGetBillingOverviewRequest(request);
}
