import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDeepSeekStoryboard,
  DeepSeekProviderUnavailableError,
  getDeepSeekConfig,
} from "./client";

describe("DeepSeek storyboard client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when DeepSeek API key is missing", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");

    expect(() => getDeepSeekConfig()).toThrow(DeepSeekProviderUnavailableError);
  });

  it("uses official compatible defaults", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek_key");

    expect(getDeepSeekConfig()).toEqual({
      provider: "deepseek",
      apiKey: "deepseek_key",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
    });
  });

  it("sends storyboard messages and parses JSON content", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek_key");
    vi.stubEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.example");
    vi.stubEnv("DEEPSEEK_STORYBOARD_MODEL", "deepseek-v4-flash");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                duration_seconds: 8,
                segments: [
                  {
                    index: 0,
                    duration_seconds: 8,
                    template_id: "front_push_in",
                    prompt: "Slow front push-in.",
                  },
                ],
              }),
            },
          },
        ],
      });
    };

    const result = await createDeepSeekStoryboard(
      {
        systemPrompt: "Use only allowed templates.",
        userPrompt: "Create one 8 second storyboard.",
      },
      { fetch: fetchMock },
    );

    expect(calls[0]?.[0]).toBe("https://api.deepseek.example/chat/completions");
    const body = JSON.parse(calls[0]?.[1]?.body as string);
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(result).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      storyboardJson: {
        duration_seconds: 8,
      },
    });
  });

  it("does not fabricate success when DeepSeek returns an error", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deepseek_key");
    const fetchMock: typeof fetch = async () =>
      Response.json({ error: "bad_request" }, { status: 400 });

    await expect(
      createDeepSeekStoryboard(
        {
          systemPrompt: "Use only allowed templates.",
          userPrompt: "Create one 8 second storyboard.",
        },
        { fetch: fetchMock },
      ),
    ).rejects.toThrow("DeepSeek storyboard failed with status 400.");
  });
});
