// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  FUNNEL_ANONYMOUS_ID_KEY,
  FUNNEL_SESSION_ID_KEY,
  getClientFunnelIdentity,
  trackFunnelEvent,
} from "./client-funnel";

describe("client funnel analytics", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("creates stable anonymous and session ids in browser storage", () => {
    const first = getClientFunnelIdentity();
    const second = getClientFunnelIdentity();

    expect(first).toEqual(second);
    expect(first.anonymousId).toMatch(/^anon_/);
    expect(first.sessionId).toMatch(/^session_/);
    expect(window.localStorage.getItem(FUNNEL_ANONYMOUS_ID_KEY)).toBe(
      first.anonymousId,
    );
    expect(window.sessionStorage.getItem(FUNNEL_SESSION_ID_KEY)).toBe(
      first.sessionId,
    );
  });

  it("does not import server modules into the browser bundle", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/analytics/client-funnel.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/from\s+["']@\/server\//);
  });

  it("posts safe funnel events with path and identity", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 202 }));
    window.history.replaceState({}, "", "/workspace?mode=trial");

    await trackFunnelEvent("guest_generate_clicked", {
      presetId: "minimal_studio",
      durationSeconds: 8,
      prompt: "must not be sent",
    } as Parameters<typeof trackFunnelEvent>[1]);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/funnel/events",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }),
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      eventName: "guest_generate_clicked",
      anonymousId: expect.stringMatching(/^anon_/),
      sessionId: expect.stringMatching(/^session_/),
      path: "/workspace",
      metadata: {
        presetId: "minimal_studio",
        durationSeconds: 8,
      },
    });
  });
});
