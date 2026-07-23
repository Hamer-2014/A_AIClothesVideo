import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createCreemPromptModeration,
  CreemModerationUnavailableError,
  getCreemModerationConfig,
} from "./moderation";

describe("Creem prompt moderation client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when moderation API key is missing", () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "");

    expect(() => getCreemModerationConfig()).toThrow(
      CreemModerationUnavailableError,
    );
  });

  it("uses an explicit base URL for sandbox testing", () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "mod_test_key");
    vi.stubEnv("CREEM_BASE_URL", "https://test-api.creem.io");

    expect(getCreemModerationConfig()).toEqual({
      apiKey: "mod_test_key",
      baseUrl: "https://test-api.creem.io",
    });
  });

  it("posts prompt and external id to Creem moderation", async () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "mod_test_key");
    vi.stubEnv("CREEM_BASE_URL", "https://test-api.creem.io");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        id: "mod_1",
        decision: "allow",
      });
    };

    const result = await createCreemPromptModeration(
      {
        prompt: "A model wearing the uploaded red dress.",
        externalId: "job-1:user-input",
      },
      { fetch: fetchMock },
    );

    expect(calls[0]).toEqual([
      "https://test-api.creem.io/v1/moderation/prompt",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "mod_test_key",
        },
      }),
    ]);
    expect(JSON.parse(calls[0]?.[1]?.body as string)).toEqual({
      prompt: "A model wearing the uploaded red dress.",
      external_id: "job-1:user-input",
    });
    expect(result).toEqual({
      id: "mod_1",
      decision: "allow",
      raw: {
        id: "mod_1",
        decision: "allow",
      },
    });
  });

  it("parses flag and deny decisions without converting them to allow", async () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "mod_test_key");
    const flagFetch: typeof fetch = async () =>
      Response.json({ id: "mod_2", decision: "flag" });
    const denyFetch: typeof fetch = async () =>
      Response.json({ id: "mod_3", decision: "deny" });

    await expect(
      createCreemPromptModeration(
        { prompt: "flagged text" },
        { fetch: flagFetch },
      ),
    ).resolves.toMatchObject({ decision: "flag" });
    await expect(
      createCreemPromptModeration(
        { prompt: "denied text" },
        { fetch: denyFetch },
      ),
    ).resolves.toMatchObject({ decision: "deny" });
  });

  it("throws on API errors instead of fabricating allow", async () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "mod_test_key");
    const fetchMock: typeof fetch = async () =>
      Response.json({ error: "temporarily_unavailable" }, { status: 503 });

    await expect(
      createCreemPromptModeration(
        { prompt: "any prompt" },
        { fetch: fetchMock },
      ),
    ).rejects.toThrow("Creem moderation failed with status 503.");
  });

  it("aborts a pending moderation request and reports it as unavailable", async () => {
    vi.stubEnv("CREEM_MODERATION_API_KEY", "mod_test_key");
    const fetchMock: typeof fetch = async (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });

    await expect(
      createCreemPromptModeration(
        { prompt: "A prompt that does not return." },
        { fetch: fetchMock, timeoutMs: 0 },
      ),
    ).rejects.toThrow("Creem moderation request timed out.");
  });
});
