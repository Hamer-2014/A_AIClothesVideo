import { describe, expect, it } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";

import {
  createInMemoryAssetConsistencyStore,
  parseConsistencyJson,
  runAssetConsistencyAnalysis,
} from "./consistency";

const validJson = {
  garment_match: "pass",
  model_match: "not_applicable",
  color_match: true,
  pattern_match: true,
  view_coverage: ["front", "side", "back"],
  confidence: "0.93",
  risk_flags: [],
};

describe("asset consistency analysis", () => {
  it("parses a passing product-view result", () => {
    expect(parseConsistencyJson(validJson, "product")).toMatchObject({
      status: "passed",
      garmentMatch: "pass",
      modelMatch: "not_applicable",
      colorMatch: true,
      patternMatch: true,
      viewCoverage: ["front", "side", "back"],
    });
  });

  it("rejects malformed provider decisions", () => {
    expect(() =>
      parseConsistencyJson(
        { ...validJson, garment_match: "maybe" },
        "product",
      ),
    ).toThrow("Consistency JSON has invalid garment_match.");
  });

  it("requires both garment and task-local model matches for human views", () => {
    expect(
      parseConsistencyJson(
        {
          ...validJson,
          model_match: "pass",
        },
        "human_model",
      ).status,
    ).toBe("passed");
    expect(
      parseConsistencyJson(
        {
          ...validJson,
          model_match: "unknown",
        },
        "human_model",
      ).status,
    ).toBe("unknown");
  });

  it("stores and logs a successful task-local consistency check", async () => {
    const store = createInMemoryAssetConsistencyStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    const result = await runAssetConsistencyAnalysis({
      store,
      providerCallLogStore,
      videoJobId: "job-1",
      analysisKind: "product_views",
      expectedSubjectKind: "product",
      assets: [
        {
          assetId: "front-1",
          role: "front",
          imageUrl: "https://signed.example/front.jpg",
        },
        {
          assetId: "side-1",
          role: "side",
          imageUrl: "https://signed.example/side.jpg",
        },
      ],
      analyzeConsistency: async (input) => ({
        provider: "openai",
        model: "gpt-5.4",
        consistencyJson: {
          ...validJson,
          view_coverage: input.declaredRoles,
        },
        raw: { id: "consistency-1" },
      }),
    });

    expect(result).toMatchObject({
      status: "passed",
      providerCallLogId: expect.any(String),
    });
    expect(store.listAnalyses()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      provider: "openai",
      model: "gpt-5.4",
      purpose: "strict_asset_review",
      videoJobId: "job-1",
      requestSnapshot: {
        analysisKind: "product_views",
        expectedSubjectKind: "product",
        assets: [
          { assetId: "front-1", role: "front" },
          { assetId: "side-1", role: "side" },
        ],
      },
      status: "succeeded",
    });
    expect(
      JSON.stringify(providerCallLogStore.listCallLogs()[0]?.requestSnapshot),
    ).not.toContain("signed.example");
  });

  it("fails closed without aborting the analysis job when vision is unavailable", async () => {
    const store = createInMemoryAssetConsistencyStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();

    const unavailable = await runAssetConsistencyAnalysis({
      store,
      providerCallLogStore,
      videoJobId: "job-1",
      analysisKind: "product_views",
      expectedSubjectKind: "product",
      assets: [
        {
          assetId: "front-1",
          role: "front",
          imageUrl: "https://signed.example/front.jpg",
        },
        {
          assetId: "side-1",
          role: "side",
          imageUrl: "https://signed.example/side.jpg",
        },
      ],
      analyzeConsistency: async () => {
        throw new Error("vision unavailable");
      },
    });

    expect(unavailable).toMatchObject({
      status: "unknown",
      garmentMatch: "unknown",
      modelMatch: "not_applicable",
      resultJson: { error: "provider_unavailable" },
    });
    expect(store.listAnalyses()).toHaveLength(1);
    expect(providerCallLogStore.listCallLogs()[0]).toMatchObject({
      purpose: "strict_asset_review",
      status: "failed",
      errorCode: "vision_provider_error",
      errorMessage: "vision unavailable",
    });
  });

  it("upserts one record per job and analysis kind", async () => {
    const store = createInMemoryAssetConsistencyStore();
    const providerCallLogStore = createInMemoryProviderCallLogStore();
    const input = {
      store,
      providerCallLogStore,
      videoJobId: "job-1",
      analysisKind: "product_views",
      expectedSubjectKind: "product" as const,
      assets: [
        {
          assetId: "front-1",
          role: "front",
          imageUrl: "https://signed.example/front.jpg",
        },
      ],
      analyzeConsistency: async () => ({
        provider: "openai",
        model: "gpt-5.4",
        consistencyJson: validJson,
        raw: { id: "consistency-1" },
      }),
    };

    await runAssetConsistencyAnalysis(input);
    await runAssetConsistencyAnalysis(input);

    expect(store.listAnalyses()).toHaveLength(1);
  });
});
