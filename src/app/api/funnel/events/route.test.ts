import { describe, expect, it } from "vitest";

import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";

import { handleFunnelEventRequest } from "./route";

describe("POST /api/funnel/events", () => {
  it("records anonymous allowlisted events", async () => {
    const store = createInMemoryFunnelEventStore();
    const response = await handleFunnelEventRequest(
      new Request("http://localhost/api/funnel/events", {
        method: "POST",
        body: JSON.stringify({
          eventName: "trial_cta_clicked",
          anonymousId: "anon-1",
          sessionId: "session-1",
          path: "/",
          metadata: {
            sourcePage: "landing",
            prompt: "should be stripped",
          },
        }),
      }),
      {
        getSession: async () => null,
        store,
      },
    );

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ ok: true });
    expect(store.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "trial_cta_clicked",
        source: "client",
        userId: null,
        anonymousId: "anon-1",
        sessionId: "session-1",
        path: "/",
        metadata: {
          sourcePage: "landing",
        },
      }),
    ]);
  });

  it("uses authenticated user id when available", async () => {
    const store = createInMemoryFunnelEventStore();
    const response = await handleFunnelEventRequest(
      new Request("http://localhost/api/funnel/events", {
        method: "POST",
        body: JSON.stringify({
          eventName: "pricing_viewed",
          anonymousId: "anon-1",
        }),
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        store,
      },
    );

    expect(response.status).toBe(202);
    expect(store.listEvents()[0]).toMatchObject({
      userId: "user-1",
      anonymousId: "anon-1",
    });
  });

  it("returns 400 for unknown events", async () => {
    const store = createInMemoryFunnelEventStore();
    const response = await handleFunnelEventRequest(
      new Request("http://localhost/api/funnel/events", {
        method: "POST",
        body: JSON.stringify({
          eventName: "leak_everything",
          anonymousId: "anon-1",
        }),
      }),
      {
        getSession: async () => null,
        store,
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "unknown_funnel_event" });
    expect(store.listEvents()).toHaveLength(0);
  });
});
