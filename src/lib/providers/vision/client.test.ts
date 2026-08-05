import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createVisionAssetAnalysis,
  createVisionConsistencyAnalysis,
  createVisionPostQaCheck,
  createVisionVirtualTryOnQa,
  getVisionConfig,
  VisionProviderUnavailableError,
} from "./client";

describe("vision provider client", () => {
  it.each([
    ["view", "virtual_try_on_view_qa", ["verdict", "targetView", "garment", "person", "inventedDetails", "evidence"]],
    ["cross", "virtual_try_on_cross_qa", ["verdict", "requiredViews", "coverage", "garmentConsistency", "personConsistency", "evidence"]],
  ] as const)("uses a strict Responses JSON schema for %s virtual try-on QA", async (kind, schemaName, required) => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");
    const qaJson = kind === "view"
      ? {
          verdict: "unknown",
          targetView: "front",
          garment: { silhouette: "unknown", color: "unknown", pattern: "unknown", visibleDetails: "unknown" },
          person: { anatomy: "unknown", identityConsistency: "unknown" },
          inventedDetails: false,
          evidence: [],
        }
      : {
          verdict: "unknown",
          requiredViews: ["front", "side", "back"],
          coverage: "unknown",
          garmentConsistency: "unknown",
          personConsistency: "unknown",
          evidence: [],
        };
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(qaJson) }] }],
    }));

    await createVisionVirtualTryOnQa({
      kind,
      imageUrls: ["https://signed/model", "https://signed/generated"],
      targetView: kind === "view" ? "front" : undefined,
      requiredViews: kind === "cross" ? ["front", "side", "back"] : undefined,
      requirements: ["preserve garment"],
    }, { fetch: fetchMock });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: schemaName,
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required,
      },
    });
    const schema = body.text.format.schema;
    if (kind === "view") {
      expect(schema.properties).toEqual({
        verdict: { enum: ["pass", "fail", "unknown"] },
        targetView: { enum: ["front", "side", "back"] },
        garment: {
          type: "object",
          additionalProperties: false,
          required: ["silhouette", "color", "pattern", "visibleDetails"],
          properties: {
            silhouette: { enum: ["match", "mismatch", "unknown"] },
            color: { enum: ["match", "mismatch", "unknown"] },
            pattern: { enum: ["match", "mismatch", "unknown"] },
            visibleDetails: { enum: ["match", "mismatch", "unknown"] },
          },
        },
        person: {
          type: "object",
          additionalProperties: false,
          required: ["anatomy", "identityConsistency"],
          properties: {
            anatomy: { enum: ["natural", "abnormal", "unknown"] },
            identityConsistency: { enum: ["match", "mismatch", "unknown"] },
          },
        },
        inventedDetails: { type: "boolean" },
        evidence: { type: "array", items: { type: "string" } },
      });
    } else {
      expect(schema.properties).toEqual({
        verdict: { enum: ["pass", "fail", "unknown"] },
        requiredViews: {
          type: "array",
          items: { enum: ["front", "side", "back"] },
          minItems: 3,
          maxItems: 3,
        },
        coverage: { enum: ["complete", "incomplete", "unknown"] },
        garmentConsistency: { enum: ["match", "mismatch", "unknown"] },
        personConsistency: { enum: ["match", "mismatch", "unknown"] },
        evidence: { type: "array", items: { type: "string" } },
      });
    }
  });

  it("uses a dedicated virtual try-on QA request", async () => {
    vi.stubEnv("VISION_PROVIDER", "openai"); vi.stubEnv("VISION_API_KEY", "key"); vi.stubEnv("VISION_MODEL_STRICT", "model");
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify({ verdict: "unknown" }) } }] }));
    const result = await createVisionVirtualTryOnQa({ kind: "view", imageUrls: ["https://signed/model", "https://signed/source", "https://signed/generated"], targetView: "front", requirements: ["preserve garment"] }, { fetch: fetchMock });
    expect(result.qaJson).toEqual({ verdict: "unknown" });
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messages[0].content).toContain("strict virtual try-on view QA");
    expect(body.messages[0].content).toContain("platform model reference");
    expect(body.messages[0].content).toContain("identityConsistency only between the generated image and the first platform model reference");
    expect(timeout).toHaveBeenCalledWith(45_000);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("exposes safe provider context when virtual try-on QA returns an HTTP error", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");

    await expect(createVisionVirtualTryOnQa({
      kind: "view",
      imageUrls: ["https://signed/model", "https://signed/generated"],
      targetView: "front",
      requirements: ["preserve garment"],
    }, {
      fetch: async () => Response.json({ error: { message: "sensitive upstream detail" } }, { status: 500 }),
    })).rejects.toMatchObject({
      name: "VisionProviderRequestError",
      provider: "apimart",
      model: "gpt-5.4",
      status: 500,
      code: "http_500",
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
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
    expect(body.text?.format?.schema?.required).toContain("subject_kind");
    expect(body.text?.format?.schema?.properties?.subject_kind).toEqual({
      enum: ["product", "human_model", "unknown"],
    });
    expect(body.input[0].role).toBe("system");
    expect(body.input[0].content[0].text).toContain("subject_kind");
    expect(body.input[0].content[0].text).toContain(
      "human_model only when the visible person is wearing the target garment",
    );
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

  it("analyzes ordered product views with the strict consistency schema", async () => {
    vi.stubEnv("VISION_PROVIDER", "openai");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.openai.example/v1");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                garment_match: "pass",
                model_match: "not_applicable",
                color_match: true,
                pattern_match: true,
                view_coverage: ["front", "side", "back"],
                confidence: "0.93",
                risk_flags: [],
              }),
            },
          },
        ],
      });
    };

    const result = await createVisionConsistencyAnalysis(
      {
        imageUrls: [
          "https://signed.example/front.jpg",
          "https://signed.example/side.jpg",
          "https://signed.example/back.jpg",
        ],
        declaredRoles: ["front", "side", "back"],
        expectedSubjectKind: "product",
      },
      { fetch: fetchMock },
    );
    const requestBody = JSON.parse(calls[0]?.[1]?.body as string);

    expect(requestBody.model).toBe("gpt-5.4");
    expect(requestBody.messages[0].content).toContain(
      "task-local consistency analysis",
    );
    expect(requestBody.messages[0].content.toLowerCase()).toContain(
      "return unknown when evidence is insufficient",
    );
    expect(requestBody.messages[0].content).toContain(
      "Declared role order: front, side, back",
    );
    expect(requestBody.messages[1].content).toHaveLength(3);
    expect(requestBody.messages[1].content[0]).toEqual({
      type: "image_url",
      image_url: { url: "https://signed.example/front.jpg" },
    });
    expect(result.consistencyJson).toEqual({
      garment_match: "pass",
      model_match: "not_applicable",
      color_match: true,
      pattern_match: true,
      view_coverage: ["front", "side", "back"],
      confidence: "0.93",
      risk_flags: [],
    });
  });

  it("uses a dedicated post-QA schema requiring a boolean passed result", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_LITE", "gpt-5.4-nano");
    const timeout = vi.spyOn(AbortSignal, "timeout");
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
    expect(timeout).toHaveBeenCalledWith(45_000);
    expect(calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    expect(result.qaJson).toMatchObject({
      passed: true,
      failure_category: null,
    });
  });

  it("preserves the HTTP status when a post-QA request fails", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");

    await expect(
      createVisionPostQaCheck(
        {
          mode: "strict",
          frameUrls: ["https://signed.example/frame-0.jpg"],
        },
        {
          fetch: async () =>
            new Response("bad gateway", {
              status: 502,
              headers: { "content-type": "text/html" },
            }),
        },
      ),
    ).rejects.toMatchObject({
      name: "VisionProviderRequestError",
      provider: "apimart",
      model: "gpt-5.4",
      status: 502,
      code: "http_502",
    });
  });

  it.each([
    ["network failure", new TypeError("fetch failed"), "network_error"],
    ["timeout", Object.assign(new Error("timed out"), { name: "TimeoutError" }), "timeout"],
  ])("classifies a post-QA %s", async (_label, fetchError, code) => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");

    await expect(
      createVisionPostQaCheck(
        {
          mode: "strict",
          frameUrls: ["https://signed.example/frame-0.jpg"],
        },
        {
          fetch: async () => {
            throw fetchError;
          },
        },
      ),
    ).rejects.toMatchObject({
      name: "VisionProviderRequestError",
      provider: "apimart",
      model: "gpt-5.4",
      code,
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

  it("adds explicit human-turn continuity checks only when requested", async () => {
    vi.stubEnv("VISION_PROVIDER", "apimart");
    vi.stubEnv("VISION_API_KEY", "vision_key");
    vi.stubEnv("VISION_BASE_URL", "https://api.apimart.ai/v1/responses/");
    vi.stubEnv("VISION_MODEL_STRICT", "gpt-5.4");
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      return Response.json({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  passed: true,
                  failure_category: null,
                  checks: [],
                  risk_flags: [],
                  summary: "Human turn continuity passed.",
                }),
              },
            ],
          },
        ],
      });
    };

    await createVisionPostQaCheck(
      {
        mode: "strict",
        frameUrls: ["https://signed.example/frame-0.jpg"],
        qaRequirements: [
          "same visible person across relevant frames",
          "natural head, arm, hand, hip, and leg anatomy",
          "garment front/side/back consistency",
          "turn stops at the supported angle and never completes 360 degrees",
        ],
      },
      { fetch: fetchMock },
    );

    const body = JSON.parse(calls[0]?.[1]?.body as string);
    const instruction = body.input[0].content[0].text;
    expect(instruction).toContain("same visible person across relevant frames");
    expect(instruction).toContain("natural head, arm, hand, hip, and leg anatomy");
    expect(instruction).toContain("garment front/side/back consistency");
    expect(instruction).toContain(
      "turn stops at the supported angle and never completes 360 degrees",
    );
  });
});
