import { desc } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { funnelEvents } from "@/lib/db/schema/analytics";
import type { JsonValue } from "@/lib/db/schema/common";
import type { FunnelEventName } from "@/server/analytics/funnel-events";

export interface AdminFunnelEventRecord {
  eventName: FunnelEventName;
  metadata: JsonValue;
  createdAt: Date;
}

export interface AdminFunnelStore {
  listEvents(): Promise<AdminFunnelEventRecord[]>;
}

export interface FunnelEventCount {
  eventName: string;
  count: number;
}

export interface FunnelConversion {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
  rate: number;
}

export interface FunnelPresetSummary {
  presetId: string;
  jobCount: number;
  deliverableCount: number;
  failedCount: number;
  downloadCount: number;
}

export interface AdminFunnelSummary {
  eventCounts: FunnelEventCount[];
  conversions: FunnelConversion[];
  presetSummary: FunnelPresetSummary[];
  generatedAt: string;
}

export function createInMemoryAdminFunnelStore(
  events: AdminFunnelEventRecord[],
): AdminFunnelStore {
  return {
    async listEvents() {
      return [...events];
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminFunnelStore(
  db: DbClient = getDb(),
): AdminFunnelStore {
  return {
    async listEvents() {
      const rows = await db
        .select({
          eventName: funnelEvents.eventName,
          metadata: funnelEvents.metadata,
          createdAt: funnelEvents.createdAt,
        })
        .from(funnelEvents)
        .orderBy(desc(funnelEvents.createdAt));

      return rows as AdminFunnelEventRecord[];
    },
  };
}

function countByEvent(events: AdminFunnelEventRecord[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    counts.set(event.eventName, (counts.get(event.eventName) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([eventName, count]) => ({ eventName, count }))
    .sort((a, b) => a.eventName.localeCompare(b.eventName));
}

function eventCount(counts: FunnelEventCount[], eventName: string) {
  return counts.find((item) => item.eventName === eventName)?.count ?? 0;
}

function conversion({
  key,
  label,
  numerator,
  denominator,
}: {
  key: string;
  label: string;
  numerator: number;
  denominator: number;
}): FunnelConversion {
  return {
    key,
    label,
    numerator,
    denominator,
    rate: denominator > 0 ? numerator / denominator : 0,
  };
}

function metadataObject(metadata: JsonValue): Record<string, JsonValue> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata
    : {};
}

function metadataString(metadata: JsonValue, key: string) {
  const value = metadataObject(metadata)[key];
  return typeof value === "string" ? value : null;
}

function presetSummary(events: AdminFunnelEventRecord[]) {
  const byPreset = new Map<string, FunnelPresetSummary>();

  function ensure(presetId: string) {
    const existing = byPreset.get(presetId);
    if (existing) {
      return existing;
    }

    const created: FunnelPresetSummary = {
      presetId,
      jobCount: 0,
      deliverableCount: 0,
      failedCount: 0,
      downloadCount: 0,
    };
    byPreset.set(presetId, created);
    return created;
  }

  for (const event of events) {
    const presetId = metadataString(event.metadata, "presetId");
    if (!presetId) {
      continue;
    }

    const row = ensure(presetId);
    if (event.eventName === "job_created") {
      row.jobCount += 1;
    } else if (event.eventName === "generation_deliverable") {
      row.deliverableCount += 1;
    } else if (event.eventName === "generation_failed") {
      row.failedCount += 1;
    } else if (event.eventName === "video_downloaded") {
      row.downloadCount += 1;
    }
  }

  return Array.from(byPreset.values()).sort((a, b) =>
    a.presetId.localeCompare(b.presetId),
  );
}

export async function getAdminFunnelSummary({
  store,
}: {
  store: AdminFunnelStore;
}): Promise<AdminFunnelSummary> {
  const events = await store.listEvents();
  const eventCounts = countByEvent(events);

  return {
    eventCounts,
    conversions: [
      conversion({
        key: "workspace_to_upload",
        label: "Workspace -> Upload",
        numerator: eventCount(eventCounts, "asset_uploaded"),
        denominator: eventCount(eventCounts, "workspace_entered"),
      }),
      conversion({
        key: "job_to_deliverable",
        label: "Job Created -> Deliverable",
        numerator: eventCount(eventCounts, "generation_deliverable"),
        denominator: eventCount(eventCounts, "job_created"),
      }),
      conversion({
        key: "trial_to_checkout",
        label: "Trial Generation -> Checkout",
        numerator: eventCount(eventCounts, "checkout_started"),
        denominator: eventCount(eventCounts, "trial_generation_started"),
      }),
    ],
    presetSummary: presetSummary(events),
    generatedAt: new Date().toISOString(),
  };
}
