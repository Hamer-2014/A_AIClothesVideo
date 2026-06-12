import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminAccessEventStore,
  listAdminAccessEvents,
} from "./access-events";

describe("admin access events", () => {
  it("returns full IP addresses to admins", async () => {
    const store = createInMemoryAdminAccessEventStore([
      {
        id: "event-1",
        userId: "user-1",
        eventType: "trial_granted",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
        metadata: { videoJobId: "job-1" },
        createdAt: new Date("2026-06-12T08:00:00.000Z"),
      },
    ]);

    await expect(listAdminAccessEvents({ store, role: "admin" })).resolves.toEqual([
      expect.objectContaining({
        eventType: "trial_granted",
        ipAddress: "203.0.113.10",
        hasIp: true,
      }),
    ]);
  });

  it("redacts full IP addresses from operators", async () => {
    const store = createInMemoryAdminAccessEventStore([
      {
        id: "event-1",
        userId: "user-1",
        eventType: "trial_denied",
        ipAddress: "203.0.113.10",
        userAgent: "Vitest Browser",
        path: "/api/jobs",
        metadata: null,
        createdAt: new Date("2026-06-12T08:00:00.000Z"),
      },
    ]);

    await expect(listAdminAccessEvents({ store, role: "operator" })).resolves.toEqual([
      expect.objectContaining({
        eventType: "trial_denied",
        ipAddress: null,
        hasIp: true,
      }),
    ]);
  });
});
