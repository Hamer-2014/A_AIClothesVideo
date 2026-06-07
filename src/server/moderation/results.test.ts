import { describe, expect, it } from "vitest";

import { createInMemoryModerationResultStore } from "./results";

const userId = "11111111-1111-4111-8111-111111111111";

describe("moderation result store", () => {
  it("stores allow and error moderation results", async () => {
    const store = createInMemoryModerationResultStore();

    await store.createResult({
      userId,
      source: "user_input",
      promptHash: "hash-1",
      promptSummary: "short prompt",
      externalId: "ext-1",
      moderationId: "mod-1",
      decision: "allow",
      latencyMs: 20,
    });
    await store.createResult({
      userId,
      videoJobId: "22222222-2222-4222-8222-222222222222",
      segmentId: "33333333-3333-4333-8333-333333333333",
      source: "final_video_prompt",
      promptHash: "hash-2",
      promptSummary: "prompt summary",
      decision: "error",
      errorCode: "creem_unavailable",
      errorMessage: "Creem moderation API key is not configured.",
      latencyMs: 1,
    });

    expect(store.listResults()).toHaveLength(2);
    expect(store.listResults()[0]).toMatchObject({
      userId,
      source: "user_input",
      decision: "allow",
      moderationId: "mod-1",
    });
    expect(store.listResults()[1]).toMatchObject({
      decision: "error",
      errorCode: "creem_unavailable",
    });
  });
});
