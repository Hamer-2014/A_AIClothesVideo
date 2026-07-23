import { afterEach, describe, expect, it, vi } from "vitest";

import { CreemModerationUnavailableError } from "@/lib/providers/creem/moderation";

import { checkPrompt } from "./check-prompt";
import { createInMemoryModerationResultStore } from "./results";

const userId = "11111111-1111-4111-8111-111111111111";

describe("checkPrompt", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("allows prompts in dev_bypass mode during development without calling Creem", async () => {
    vi.stubEnv("PROMPT_MODERATION_MODE", "dev_bypass");
    vi.stubEnv("NODE_ENV", "development");
    const store = createInMemoryModerationResultStore();

    const result = await checkPrompt(
      {
        userId,
        source: "user_input",
        prompt: "Bypass this prompt in local development.",
      },
      {
        resultStore: store,
        moderatePrompt: async () => {
          throw new Error("must not call Creem");
        },
      },
    );

    expect(result).toEqual({
      allowed: true,
      decision: "allow",
      moderationId: null,
      errorCode: "prompt_moderation_dev_bypass",
    });
    expect(store.listResults()[0]).toMatchObject({
      decision: "allow",
      errorCode: "prompt_moderation_dev_bypass",
    });
  });

  it("fails closed when off mode is used in production", async () => {
    vi.stubEnv("PROMPT_MODERATION_MODE", "off");
    vi.stubEnv("NODE_ENV", "production");
    const store = createInMemoryModerationResultStore();

    const result = await checkPrompt(
      {
        userId,
        source: "user_input",
        prompt: "Moderation is disabled on purpose.",
      },
      {
        resultStore: store,
        moderatePrompt: async () => {
          throw new Error("must not call Creem");
        },
      },
    );

    expect(result).toEqual({
      allowed: false,
      decision: "error",
      moderationId: null,
      errorCode: "prompt_moderation_off_forbidden",
    });
    expect(store.listResults()[0]).toMatchObject({
      decision: "error",
      errorCode: "prompt_moderation_off_forbidden",
    });
  });

  it("fails closed when dev_bypass is used outside development or test", async () => {
    vi.stubEnv("PROMPT_MODERATION_MODE", "dev_bypass");
    vi.stubEnv("NODE_ENV", "production");
    const store = createInMemoryModerationResultStore();

    const result = await checkPrompt(
      {
        userId,
        source: "user_input",
        prompt: "This should not bypass in production.",
      },
      {
        resultStore: store,
        moderatePrompt: async () => {
          throw new Error("must not call Creem");
        },
      },
    );

    expect(result).toEqual({
      allowed: false,
      decision: "error",
      moderationId: null,
      errorCode: "prompt_moderation_dev_bypass_forbidden",
    });
    expect(store.listResults()[0]).toMatchObject({
      decision: "error",
      errorCode: "prompt_moderation_dev_bypass_forbidden",
    });
  });

  it.each([
    ["off", "production", "development", "prompt_moderation_off_forbidden"],
    ["off", "staging", "test", "prompt_moderation_off_forbidden"],
    [
      "dev_bypass",
      "production",
      "development",
      "prompt_moderation_dev_bypass_forbidden",
    ],
    [
      "dev_bypass",
      "staging",
      "test",
      "prompt_moderation_dev_bypass_forbidden",
    ],
  ])(
    "fails closed for %s when APP_ENV=%s and NODE_ENV=%s",
    async (mode, appEnv, nodeEnv, errorCode) => {
      vi.stubEnv("PROMPT_MODERATION_MODE", mode);
      vi.stubEnv("APP_ENV", appEnv);
      vi.stubEnv("NODE_ENV", nodeEnv);
      const store = createInMemoryModerationResultStore();

      const result = await checkPrompt(
        { userId, source: "user_input", prompt: "This must be moderated." },
        {
          resultStore: store,
          moderatePrompt: async () => {
            throw new Error("must not call Creem");
          },
        },
      );

      expect(result).toMatchObject({
        allowed: false,
        decision: "error",
        errorCode,
      });
    },
  );
});
