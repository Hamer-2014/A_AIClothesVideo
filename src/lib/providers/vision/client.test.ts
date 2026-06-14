import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createVisionAssetAnalysis,
  createVisionPostQaCheck,
  getVisionConfig,
  VisionProviderUnavailableError,
} from "./client";

describe("vision provider client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when provider settings are missing", () => {
    vi.stubEnv("VISION_PROVIDER", "");
    vi.stubEnv("VISION_API_KEY", "");

    expect(() => getVisionConfig("standard")).toThrow(
      VisionProviderUnavailableError,
    );
  });

  it("uses configured model by mode", () => {
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.openai.example/v1");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");

    expect(getVisionConfig("standard")).toEqual({
      provider: "openai",
      apiKey: "vision_key",
      baseUrl: "https://api.openai.example/v1",
      model: "gpt-5.4-mini",
    });
  });

  it("normalizes non-openai base URLs by removing trailing path slashes", () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");

    expect(getVisionConfig("standard")).toEqual({
      provider: "apimart",
      apiKey: "vision_key",
      baseUrl: "https://api.apimart.ai/v1",
      model: "gpt-5.4-mini",
    });
  });

  it("uses the OpenAI base URL when VISION_BASE_URL is empty", () => {
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");

    expect(getVisionConfig("standard").baseUrl).toBe("https://api.openai.com/v1");
  });

  it("rejects unsupported vision providers", () => {
    vi.stubEnv("VISION_PROVIDER", "random_vendor");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");

    expect(() => getVisionConfig("standard")).toThrow(
      VisionProviderUnavailableError,
    );
  });

  it("sends image URLs as image inputs and parses JSON content", async () => {
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.openai.example/v1");
    vi.stubEnv("VISION_MODEL_LITE", "gpt-5.4-nano");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                asset_role: "front",
                garment_category: "dress",
                view_angle: "front",
                human_present: "no",
                visible_details: ["front_shape"],
                not_visible_details: [],
                quality: {
                  is_garment: true,
                  is_clear: true,
                  is_safe: true,
                  has_flat_lay_or_white_background: true,
                },
                confidence: "high",
                risk_flags: [],
              }),
            },
          },
        ],
      });
    };

    const result = await createVisionAssetAnalysis(
      {
        mode: "lite",
        imageUrls: ["https://signed.example/front.jpg"],
      },
      { fetch: fetchMock },
    );

    expect(calls[0]?.[0]).toBe("https://api.openai.example/v1/chat/completions");
    const body = JSON.parse(calls[0]?.[1]?.body as string);
    expect(body.model).toBe("gpt-5.4-nano");
    expect(body.stream).toBe(false);
    expect(body.messages[1].content).toEqual([
      {
        type: "image_url",
        image_url: { url: "https://signed.example/front.jpg" },
      },
    ]);
    expect(result).toMatchObject({
      provider: "openai",
      model: "gpt-5.4-nano",
      analysisJson: {
        asset_role: "front",
        garment_category: "dress",
      },
    });
  });

  it("targets the responses endpoint with structured output and parses output_text content", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        id: "resp_123",
        status: "completed",
        output: [
          {
            id: "msg_123",
            type: "message",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  asset_role: "front",
                  garment_category: "dress",
                  view_angle: "front",
                  human_present: "no",
                  visible_details: ["front_shape"],
                  not_visible_details: [],
                  quality: {
                    is_garment: true,
                    is_clear: true,
                    is_safe: true,
                    has_flat_lay_or_white_background: true,
                  },
                  confidence: "high",
                  risk_flags: [],
                }),
              },
            ],
          },
        ],
      });
    };

    const result = await createVisionAssetAnalysis(
      {
        mode: "standard",
        imageUrls: ["https://signed.example/frame-1.jpg"],
      },
      { fetch: fetchMock },
    );

    expect(calls[0]?.[0]).toBe("https://api.apimart.ai/v1/responses");
    const body = JSON.parse(calls[0]?.[1]?.body as string);
    expect(body).not.toHaveProperty("stream");
    expect(body.text?.format).toMatchObject({
      type: "json_schema",
      name: "asset_analysis",
      strict: true,
    });
    expect(body.input[0].role).toBe("system");
    expect(body.input[0].content[0]).toEqual({
      type: "input_text",
      text:
        "Analyze clothing product images. Return only JSON with asset_role, garment_category, view_angle, human_present, visible_details, not_visible_details, quality, confidence, risk_flags.",
    });
    expect(body.input[1].content).toEqual([
      {
        type: "input_image",
        image_url: "https://signed.example/frame-1.jpg",
      },
    ]);
    expect(result.analysisJson).toEqual({
      asset_role: "front",
      garment_category: "dress",
      view_angle: "front",
      human_present: "no",
      visible_details: ["front_shape"],
      not_visible_details: [],
      quality: {
        is_garment: true,
        is_clear: true,
        is_safe: true,
        has_flat_lay_or_white_background: true,
      },
      confidence: "high",
      risk_flags: [],
    });
  });

  it("does not fabricate success when provider returns an error", async () => {
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");
    const fetchMock: typeof fetch = async () =>
      Response.json({ error: "bad_request" }, { status: 400 });

    await expect(
      createVisionAssetAnalysis(
        {
          mode: "standard",
          imageUrls: ["https://signed.example/front.jpg"],
        },
        { fetch: fetchMock },
      ),
    ).rejects.toThrow("Vision provider failed with status 400.");
  });

  it("uses a dedicated post-QA schema requiring a boolean passed result", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_LITE", "gpt-5.4-nano");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        id: "resp_qa_123",
        status: "completed",
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  passed: true,
                  failure_category: null,
                  checks: [
                    {
                      name: "garment_consistency",
                      passed: true,
                      notes: "Generated frames preserve the garment.",
                    },
                  ],
                  risk_flags: [],
                  summary: "The stitched video is acceptable.",
                }),
              },
            ],
          },
        ],
      });
    };

    const result = await createVisionPostQaCheck(
      {
        mode: "lite",
        frameUrls: ["https://signed.example/frame-0.jpg"],
      },
      { fetch: fetchMock },
    );

    expect(calls[0]?.[0]).toBe("https://api.apimart.ai/v1/responses");
    const body = JSON.parse(calls[0]?.[1]?.body as string);
    expect(body.text?.format).toMatchObject({
      type: "json_schema",
      name: "post_qa",
      strict: true,
    });
    expect(body.text?.format?.schema?.required).toContain("passed");
    expect(body.input[0].content[0].text).toContain(
      "Return only JSON with passed",
    );
    expect(body.input[0].content[0].text).not.toContain("asset_role");
    expect(result.qaJson).toMatchObject({
      passed: true,
      failure_category: null,
    });
  });

  it("instructs post-QA not to fail childrenswear only because a child model is present", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_STANDARD", "gpt-5.4-mini");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        output: [
          {
            type: "message",
            status: "completed",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  passed: true,
                  failure_category: null,
                  checks: [],
                  risk_flags: ["minor_present"],
                  summary: "Child model appears in a childrenswear product context.",
                }),
              },
            ],
          },
        ],
      });
    };

    await createVisionPostQaCheck(
      {
        mode: "standard",
        frameUrls: ["https://signed.example/frame-0.jpg"],
      },
      { fetch: fetchMock },
    );

    const body = JSON.parse(calls[0]?.[1]?.body as string);
    const instruction = body.input[0].content[0].text;
    expect(instruction).toContain("childrenswear");
    expect(instruction).toContain("minor_present");
    expect(instruction).toContain("not a failure reason by itself");
    expect(instruction).toContain("sexualized");
    expect(instruction).toContain("exploitation");
    expect(instruction).toContain("privacy-sensitive");
  });
});
