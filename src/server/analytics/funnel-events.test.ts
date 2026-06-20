import { describe, expect, it } from "vitest";

import {
  createInMemoryFunnelEventStore,
  recordFunnelEvent,
} from "./funnel-events";

describe("funnel events", () => {
  it("records allowlisted events", async () => {
    const store = createInMemoryFunnelEventStore();

    await recordFunnelEvent({
      store,
      eventName: "workspace_entered",
      source: "server",
      userId: "user-1",
      path: "/workspace",
      metadata: {
        presetId: "minimal_studio",
        durationSeconds: 8,
      },
    });

    expect(store.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "workspace_entered",
        source: "server",
        userId: "user-1",
        path: "/workspace",
        metadata: {
          presetId: "minimal_studio",
          durationSeconds: 8,
        },
      }),
    ]);
  });

  it("rejects unknown events", async () => {
    const store = createInMemoryFunnelEventStore();

    await expect(
      recordFunnelEvent({
        store,
        eventName: "raw_provider_debug_dump",
        source: "server",
      }),
    ).rejects.toThrow("Unknown funnel event.");
    expect(store.listEvents()).toHaveLength(0);
  });

  it("keeps only safe metadata keys", async () => {
    const store = createInMemoryFunnelEventStore();

    await recordFunnelEvent({
      store,
      eventName: "guest_generate_clicked",
      source: "server",
      metadata: {
        presetId: "minimal_studio",
        durationSeconds: 8,
        aspectRatio: "9:16",
        billingMode: "free_trial",
        jobId: "job-1",
        sourcePage: "workspace",
        status: "asset_analysis_queued",
        reasonCategory: "provider",
        mode: "trial",
        assetRole: "front",
        draftRestored: true,
        prompt: "full prompt must not be stored",
        fileName: "dress.jpg",
        signedUrl: "https://r2.example.com/signed",
        apiKey: "sk-secret",
        providerResponse: { raw: true },
        riskScore: 99,
        reasonCodes: ["email_trial_used"],
        internalHash: "hash-value",
      },
    });

    expect(store.listEvents()[0]?.metadata).toEqual({
      presetId: "minimal_studio",
      durationSeconds: 8,
      aspectRatio: "9:16",
      billingMode: "free_trial",
      jobId: "job-1",
      sourcePage: "workspace",
      status: "asset_analysis_queued",
      reasonCategory: "provider",
      mode: "trial",
      assetRole: "front",
      draftRestored: true,
    });
    expect(JSON.stringify(store.listEvents())).not.toContain("full prompt");
    expect(JSON.stringify(store.listEvents())).not.toContain("dress.jpg");
    expect(JSON.stringify(store.listEvents())).not.toContain("signed");
    expect(JSON.stringify(store.listEvents())).not.toContain("sk-secret");
    expect(JSON.stringify(store.listEvents())).not.toContain("riskScore");
    expect(JSON.stringify(store.listEvents())).not.toContain("email_trial_used");
    expect(JSON.stringify(store.listEvents())).not.toContain("hash-value");
  });
});
