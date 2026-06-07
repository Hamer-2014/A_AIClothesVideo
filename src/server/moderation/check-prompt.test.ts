import { describe, expect, it } from "vitest";

import { CreemModerationUnavailableError } from "@/lib/providers/creem/moderation";

import { checkPrompt } from "./check-prompt";
import { createInMemoryModerationResultStore } from "./results";

const userId = "11111111-1111-4111-8111-111111111111";

describe("checkPrompt", () => {
  it("allows prompts only when Creem returns allow", async () => {
    const store = createInMemoryModerationResultStore();

    const result = await checkPrompt(
      {
        userId,
        source: "user_input",
        prompt: "Show the uploaded dress in a clean studio.",
      },
      {
        resultStore: store,
        moderatePrompt: async () => ({
          id: "mod_1",
          decision: "allow",
          raw: { id: "mod_1", decision: "allow" },
        }),
      },
    );

    expect(result).toEqual({
      allowed: true,
      decision: "allow",
      moderationId: "mod_1",
      errorCode: null,
    });
    expect(store.listResults()).toHaveLength(1);
    expect(store.listResults()[0]).toMatchObject({
      decision: "allow",
      source: "user_input",
      moderationId: "mod_1",
      promptSummary: "Show the uploaded dress in a clean studio.",
    });
  });

  it("blocks flag and deny decisions", async () => {
    const flagStore = createInMemoryModerationResultStore();
    const denyStore = createInMemoryModerationResultStore();

    await expect(
      checkPrompt(
        {
          userId,
          source: "final_video_prompt",
          prompt: "flagged prompt",
        },
        {
          resultStore: flagStore,
          moderatePrompt: async () => ({
            id: "mod_2",
            decision: "flag",
            raw: { id: "mod_2", decision: "flag" },
          }),
        },
      ),
    ).resolves.toMatchObject({ allowed: false, decision: "flag" });
    await expect(
      checkPrompt(
        {
          userId,
          source: "final_video_prompt",
          prompt: "denied prompt",
        },
        {
          resultStore: denyStore,
          moderatePrompt: async () => ({
            id: "mod_3",
            decision: "deny",
            raw: { id: "mod_3", decision: "deny" },
          }),
        },
      ),
    ).resolves.toMatchObject({ allowed: false, decision: "deny" });
  });

  it("fails closed and records an error when Creem is unavailable", async () => {
    const store = createInMemoryModerationResultStore();
    const longPrompt =
      "A final video prompt that should not be stored in full. ".repeat(8);

    const result = await checkPrompt(
      {
        userId,
        videoJobId: "22222222-2222-4222-8222-222222222222",
        segmentId: "33333333-3333-4333-8333-333333333333",
        source: "final_video_prompt",
        prompt: longPrompt,
      },
      {
        resultStore: store,
        moderatePrompt: async () => {
          throw new CreemModerationUnavailableError();
        },
      },
    );

    expect(result).toEqual({
      allowed: false,
      decision: "error",
      moderationId: null,
      errorCode: "creem_moderation_unavailable",
    });
    expect(store.listResults()[0]).toMatchObject({
      decision: "error",
      errorCode: "creem_moderation_unavailable",
      videoJobId: "22222222-2222-4222-8222-222222222222",
      segmentId: "33333333-3333-4333-8333-333333333333",
    });
    expect(store.listResults()[0]?.promptSummary).not.toBe(longPrompt);
    expect(store.listResults()[0]?.promptSummary?.length).toBeLessThanOrEqual(80);
  });
});
