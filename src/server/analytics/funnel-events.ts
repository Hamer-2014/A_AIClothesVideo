import { randomUUID } from "node:crypto";

import {
  allowedFunnelMetadataKeys,
  funnelEventNames,
  type FunnelEventName,
  type FunnelMetadata,
} from "@/lib/analytics/funnel-contract";
import { getDb } from "@/lib/db/client";
import { funnelEvents } from "@/lib/db/schema/analytics";
import type { JsonValue } from "@/lib/db/schema/common";

export {
  allowedFunnelMetadataKeys,
  funnelEventNames,
  type FunnelEventName,
  type FunnelMetadata,
} from "@/lib/analytics/funnel-contract";

export type FunnelEventSource = "client" | "server";

export interface FunnelEventRecord {
  id: string;
  userId: string | null;
  anonymousId: string | null;
  sessionId: string | null;
  eventName: FunnelEventName;
  source: FunnelEventSource;
  path: string | null;
  metadata: FunnelMetadata;
  createdAt: Date;
}

export interface FunnelEventStore {
  createEvent(input: Omit<FunnelEventRecord, "id" | "createdAt">): Promise<FunnelEventRecord>;
}

export class UnknownFunnelEventError extends Error {
  constructor() {
    super("Unknown funnel event.");
    this.name = "UnknownFunnelEventError";
  }
}

const funnelEventNameSet = new Set<string>(funnelEventNames);
const allowedMetadataKeySet = new Set<string>(allowedFunnelMetadataKeys);

export function isFunnelEventName(value: string): value is FunnelEventName {
  return funnelEventNameSet.has(value);
}

export function sanitizeFunnelMetadata(metadata: unknown): FunnelMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const output: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (allowedMetadataKeySet.has(key) && isJsonValue(value)) {
      output[key] = value;
    }
  }

  return output as FunnelMetadata;
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object") {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

export function createInMemoryFunnelEventStore(): FunnelEventStore & {
  listEvents: () => FunnelEventRecord[];
} {
  const events: FunnelEventRecord[] = [];

  return {
    async createEvent(input) {
      const event: FunnelEventRecord = {
        id: randomUUID(),
        createdAt: new Date(),
        ...input,
      };
      events.push(event);
      return event;
    },
    listEvents() {
      return [...events];
    },
  };
}

export function createNoopFunnelEventStore(): FunnelEventStore {
  return {
    async createEvent(input) {
      return {
        id: randomUUID(),
        createdAt: new Date(),
        ...input,
      };
    },
  };
}

export function createDrizzleFunnelEventStore(): FunnelEventStore {
  const db = getDb();

  return {
    async createEvent(input) {
      const [event] = await db
        .insert(funnelEvents)
        .values({
          userId: input.userId,
          anonymousId: input.anonymousId,
          sessionId: input.sessionId,
          eventName: input.eventName,
          source: input.source,
          path: input.path,
          metadata: input.metadata,
        })
        .returning();

      if (!event) {
        throw new Error("Funnel event was not inserted.");
      }

      return {
        id: event.id,
        userId: event.userId,
        anonymousId: event.anonymousId,
        sessionId: event.sessionId,
        eventName: event.eventName as FunnelEventName,
        source: event.source as FunnelEventSource,
        path: event.path,
        metadata: sanitizeFunnelMetadata(event.metadata),
        createdAt: event.createdAt,
      };
    },
  };
}

export function createRuntimeFunnelEventStore(): FunnelEventStore {
  if (process.env.NODE_ENV === "test") {
    return createNoopFunnelEventStore();
  }

  return createDrizzleFunnelEventStore();
}

export async function recordFunnelEvent({
  store = createRuntimeFunnelEventStore(),
  eventName,
  source,
  userId = null,
  anonymousId = null,
  sessionId = null,
  path = null,
  metadata = {},
}: {
  store?: FunnelEventStore;
  eventName: string;
  source: FunnelEventSource;
  userId?: string | null;
  anonymousId?: string | null;
  sessionId?: string | null;
  path?: string | null;
  metadata?: unknown;
}) {
  if (!isFunnelEventName(eventName)) {
    throw new UnknownFunnelEventError();
  }

  return store.createEvent({
    userId,
    anonymousId,
    sessionId,
    eventName,
    source,
    path,
    metadata: sanitizeFunnelMetadata(metadata),
  });
}

export async function recordFunnelEventSafely(
  input: Parameters<typeof recordFunnelEvent>[0],
) {
  try {
    await recordFunnelEvent(input);
    return true;
  } catch (error) {
    console.error("Failed to record funnel event", {
      eventName: input.eventName,
      error,
    });
    return false;
  }
}
