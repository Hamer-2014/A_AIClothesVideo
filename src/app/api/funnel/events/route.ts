import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth/server";
import {
  createDrizzleFunnelEventStore,
  recordFunnelEvent,
  type FunnelEventStore,
  UnknownFunnelEventError,
} from "@/server/analytics/funnel-events";

type FunnelSession = {
  user?: {
    id?: string;
  };
} | null;

interface FunnelEventRouteDeps {
  getSession?: () => Promise<FunnelSession>;
  store?: FunnelEventStore;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function handleFunnelEventRequest(
  request: Request,
  deps: FunnelEventRouteDeps = {},
) {
  const body = await request.json().catch(() => ({}));
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const eventName = stringValue(input.eventName);

  if (!eventName) {
    return NextResponse.json({ error: "invalid_funnel_event" }, { status: 400 });
  }

  const session = await (deps.getSession ?? getServerSession)();
  const userId = session?.user?.id ?? null;
  const anonymousId = stringValue(input.anonymousId);

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { error: "missing_funnel_identity" },
      { status: 400 },
    );
  }

  try {
    await recordFunnelEvent({
      store: deps.store ?? createDrizzleFunnelEventStore(),
      eventName,
      source: "client",
      userId,
      anonymousId,
      sessionId: stringValue(input.sessionId),
      path: stringValue(input.path),
      metadata: input.metadata,
    });
  } catch (error) {
    if (error instanceof UnknownFunnelEventError) {
      return NextResponse.json(
        { error: "unknown_funnel_event" },
        { status: 400 },
      );
    }

    console.error("Failed to record client funnel event", {
      eventName,
      error,
    });
    return NextResponse.json(
      { error: "funnel_event_write_failed" },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}

export async function POST(request: Request) {
  return handleFunnelEventRequest(request);
}
