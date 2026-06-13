import { describe, expect, it } from "vitest";

import {
  createInMemoryModelRouteStore,
  resolveModelRoute,
} from "./model-route-resolver";

const providerId = "11111111-1111-4111-8111-111111111111";
const keyId = "22222222-2222-4222-8222-222222222222";
const routeId = "33333333-3333-4333-8333-333333333333";

function activeStore(overrides: Parameters<typeof createInMemoryModelRouteStore>[0] = {}) {
  return createInMemoryModelRouteStore({
    routes: [
      {
        id: routeId,
        purpose: "video_generation",
        environment: "production",
        primaryProviderId: providerId,
        primaryModel: "pixverse-v6",
        fallbackProviderId: null,
        fallbackModel: null,
        status: "active",
        minMarginPercent: 45,
        allowPublicFallback: "false",
      },
    ],
    providers: [
      {
        id: providerId,
        name: "apimart",
        status: "active",
      },
    ],
    keys: [
      {
        id: keyId,
        providerId,
        environment: "production",
        status: "active",
        currentConcurrency: 0,
        concurrentLimit: 2,
        currentDailyCost: "1.000000",
        dailyCostLimit: "10.000000",
        failureCount: 0,
      },
    ],
    ...overrides,
  });
}

describe("resolveModelRoute", () => {
  it("returns active APIMart PixVerse route from database", async () => {
    const result = await resolveModelRoute({
      store: activeStore(),
      purpose: "video_generation",
      environment: "production",
      isPublicJob: true,
      estimatedRevenueCredits: 70,
      estimatedCostUsd: 0.2,
    });

    expect(result).toMatchObject({
      routeId,
      provider: "apimart",
      model: "pixverse-v6",
      providerKeyId: keyId,
      source: "database",
    });
    expect(result.routeSnapshot).toMatchObject({
      routeId,
      purpose: "video_generation",
      environment: "production",
      primaryProvider: "apimart",
      primaryModel: "pixverse-v6",
      routeSource: "database",
      fallbackPolicy: {
        allowPublicFallback: false,
      },
    });
  });

  it("fails closed in production when route is paused", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          routes: [
            {
              id: routeId,
              purpose: "video_generation",
              environment: "production",
              primaryProviderId: providerId,
              primaryModel: "pixverse-v6",
              fallbackProviderId: null,
              fallbackModel: null,
              status: "paused",
              minMarginPercent: 45,
              allowPublicFallback: "false",
            },
          ],
        }),
        purpose: "video_generation",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("No active model route for video_generation in production.");
  });

  it("fails closed when provider is paused", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          providers: [{ id: providerId, name: "apimart", status: "paused" }],
        }),
        purpose: "video_generation",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("Model route provider is not active.");
  });

  it("skips exhausted keys and selects the next active key", async () => {
    const result = await resolveModelRoute({
      store: activeStore({
        keys: [
          {
            id: "key-full",
            providerId,
            environment: "production",
            status: "active",
            currentConcurrency: 2,
            concurrentLimit: 2,
            currentDailyCost: "1.000000",
            dailyCostLimit: "10.000000",
            failureCount: 0,
          },
          {
            id: "key-next",
            providerId,
            environment: "production",
            status: "active",
            currentConcurrency: 0,
            concurrentLimit: 2,
            currentDailyCost: "1.000000",
            dailyCostLimit: "10.000000",
            failureCount: 0,
          },
        ],
      }),
      purpose: "video_generation",
      environment: "production",
      isPublicJob: true,
      estimatedRevenueCredits: 70,
      estimatedCostUsd: 0.2,
    });

    expect(result.providerKeyId).toBe("key-next");
  });

  it("fails closed when daily cost limit is exceeded", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          keys: [
            {
              id: keyId,
              providerId,
              environment: "production",
              status: "active",
              currentConcurrency: 0,
              concurrentLimit: 2,
              currentDailyCost: "10.000000",
              dailyCostLimit: "10.000000",
              failureCount: 0,
            },
          ],
        }),
        purpose: "video_generation",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("No active provider key for video_generation route.");
  });

  it("does not allow experimental video for public jobs", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          routes: [
            {
              id: routeId,
              purpose: "experimental_video",
              environment: "production",
              primaryProviderId: providerId,
              primaryModel: "veo3.1-fast-beta",
              fallbackProviderId: null,
              fallbackModel: null,
              status: "active",
              minMarginPercent: 45,
              allowPublicFallback: "false",
            },
          ],
        }),
        purpose: "experimental_video",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("Public jobs may only resolve video_generation routes.");
  });

  it("does not fallback for public jobs unless explicitly allowed", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          providers: [{ id: providerId, name: "apimart", status: "paused" }],
        }),
        purpose: "video_generation",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("Model route provider is not active.");
  });

  it("does not fallback when margin is below 45 percent", async () => {
    await expect(
      resolveModelRoute({
        store: activeStore({
          routes: [
            {
              id: routeId,
              purpose: "video_generation",
              environment: "production",
              primaryProviderId: providerId,
              primaryModel: "pixverse-v6",
              fallbackProviderId: "fallback-provider",
              fallbackModel: "veo3.1-fast-beta",
              status: "active",
              minMarginPercent: 44,
              allowPublicFallback: "true",
            },
          ],
          providers: [
            { id: providerId, name: "apimart", status: "paused" },
            { id: "fallback-provider", name: "evolink", status: "active" },
          ],
          keys: [
            {
              id: "fallback-key",
              providerId: "fallback-provider",
              environment: "production",
              status: "active",
              currentConcurrency: 0,
              concurrentLimit: 2,
              currentDailyCost: "1.000000",
              dailyCostLimit: "10.000000",
              failureCount: 0,
            },
          ],
        }),
        purpose: "video_generation",
        environment: "production",
        isPublicJob: true,
        estimatedRevenueCredits: 70,
        estimatedCostUsd: 0.2,
      }),
    ).rejects.toThrow("Public fallback requires at least 45 percent margin.");
  });
});
