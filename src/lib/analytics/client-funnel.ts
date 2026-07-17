import {
  allowedFunnelMetadataKeys,
  type FunnelEventName,
  type FunnelMetadata,
} from "@/lib/analytics/funnel-contract";

export const FUNNEL_ANONYMOUS_ID_KEY = "runwaytools_funnel_anonymous_id";
export const FUNNEL_SESSION_ID_KEY = "runwaytools_funnel_session_id";

function createClientId(prefix: string) {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${randomPart}`;
}

function storageValue(storage: Storage, key: string, prefix: string) {
  const existing = storage.getItem(key);
  if (existing) {
    return existing;
  }

  const created = createClientId(prefix);
  storage.setItem(key, created);
  return created;
}

export function getClientFunnelIdentity() {
  return {
    anonymousId: storageValue(
      window.localStorage,
      FUNNEL_ANONYMOUS_ID_KEY,
      "anon",
    ),
    sessionId: storageValue(
      window.sessionStorage,
      FUNNEL_SESSION_ID_KEY,
      "session",
    ),
  };
}

function sanitizeClientMetadata(metadata: unknown): FunnelMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const allowedKeys = new Set<string>(allowedFunnelMetadataKeys);
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => allowedKeys.has(key)),
  ) as FunnelMetadata;
}

export async function trackFunnelEvent(
  eventName: FunnelEventName,
  metadata: FunnelMetadata = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const identity = getClientFunnelIdentity();
  await fetch("/api/funnel/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      ...identity,
      path: window.location.pathname,
      metadata: sanitizeClientMetadata(metadata),
    }),
  }).catch(() => undefined);
}
