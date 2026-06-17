import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleTrialStatusStore,
  getUserVisibleTrialStatus,
  type TrialStatus,
} from "@/server/trial/status";

type TrialStatusSession = {
  user?: {
    id?: string;
    email?: string | null;
    emailVerified?: boolean | null;
  };
} | null;

interface TrialStatusRouteDeps {
  getSession?: () => Promise<TrialStatusSession>;
  getTrialStatus?: (input: {
    userId: string;
    email?: string | null;
    emailVerified?: boolean | null;
    requestContext: {
      ipAddress: string | null;
      userAgent: string | null;
      path: string | null;
    };
  }) => Promise<TrialStatus>;
}

function requestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return request.headers.get("x-real-ip")?.trim() || null;
}

export async function handleGetTrialStatusRequest(
  request: Request,
  deps: TrialStatusRouteDeps = {},
) {
  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestContext = {
    ipAddress: requestIp(request),
    userAgent: request.headers.get("user-agent"),
    path: new URL(request.url).pathname,
  };
  const getTrialStatus =
    deps.getTrialStatus ??
    ((input) =>
      getUserVisibleTrialStatus({
        store: createDrizzleTrialStatusStore(),
        input: {
          userId: input.userId,
          email: input.email,
          emailVerified: input.emailVerified,
          ipAddress: input.requestContext.ipAddress,
          userAgent: input.requestContext.userAgent,
        },
      }));

  const status = await getTrialStatus({
    userId,
    email: session?.user?.email ?? null,
    emailVerified: session?.user?.emailVerified ?? null,
    requestContext,
  });

  return NextResponse.json(status);
}

export async function GET(request: Request) {
  return handleGetTrialStatusRequest(request);
}
