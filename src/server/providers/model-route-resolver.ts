import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { modelProviders, modelRoutes, providerKeys } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import type { VideoGenerationProvider } from "@/lib/providers/video-generation/router";

type ProviderStatus = "active" | "paused" | "exhausted" | "error";
type RoutePurpose = "video_generation" | "experimental_video";

export interface ModelRouteRecord {
  id: string;
  purpose: RoutePurpose;
  environment: string;
  primaryProviderId: string | null;
  primaryModel: string;
  fallbackProviderId: string | null;
  fallbackModel: string | null;
  status: ProviderStatus;
  minMarginPercent: number;
  allowPublicFallback: string;
}

export interface ModelProviderRecord {
  id: string;
  name: string;
  status: ProviderStatus;
}

export interface ProviderKeyRecord {
  id: string;
  providerId: string;
  environment: string;
  status: ProviderStatus;
  currentConcurrency: number;
  concurrentLimit: number;
  currentDailyCost: string | null;
  dailyCostLimit: string | null;
  failureCount: number;
}

export interface ModelRouteStore {
  findActiveRoute(
    purpose: RoutePurpose,
    environment: string,
  ): Promise<ModelRouteRecord | null>;
  findProvider(providerId: string): Promise<ModelProviderRecord | null>;
  findActiveKeys(
    providerId: string,
    environment: string,
  ): Promise<ProviderKeyRecord[]>;
}

export interface ResolvedModelRoute {
  routeId: string;
  provider: VideoGenerationProvider;
  model: string;
  providerKeyId: string;
  routeSnapshot: JsonValue;
  source: "database";
}

function providerName(name: string): VideoGenerationProvider {
  const normalized = name.trim().toLowerCase();
  if (normalized === "apimart" || normalized === "evolink") {
    return normalized;
  }

  throw new Error(`Unsupported video generation provider: ${name}.`);
}

function numericCost(value: string | null | undefined) {
  return Number(value ?? "0");
}

function isSelectableKey(key: ProviderKeyRecord) {
  if (key.status !== "active") {
    return false;
  }
  if (key.currentConcurrency >= key.concurrentLimit) {
    return false;
  }
  if (key.failureCount >= 5) {
    return false;
  }
  const dailyLimit = numericCost(key.dailyCostLimit);
  if (dailyLimit > 0 && numericCost(key.currentDailyCost) >= dailyLimit) {
    return false;
  }
  return true;
}

async function selectKey({
  store,
  providerId,
  environment,
}: {
  store: ModelRouteStore;
  providerId: string;
  environment: string;
}) {
  return (await store.findActiveKeys(providerId, environment)).find(isSelectableKey) ?? null;
}

function routeSnapshot({
  route,
  provider,
  model,
  source,
}: {
  route: ModelRouteRecord;
  provider: ModelProviderRecord;
  model: string;
  source: "database";
}): JsonValue {
  return {
    routeId: route.id,
    purpose: route.purpose,
    environment: route.environment,
    primaryProvider: provider.name,
    primaryModel: model,
    fallbackPolicy: {
      allowPublicFallback: route.allowPublicFallback === "true",
      fallbackProviderId: route.fallbackProviderId,
      fallbackModel: route.fallbackModel,
      minMarginPercent: route.minMarginPercent,
    },
    routeSource: source,
  };
}

export async function resolveModelRoute({
  store = createDrizzleModelRouteStore(),
  purpose,
  environment,
  isPublicJob,
}: {
  store?: ModelRouteStore;
  purpose: RoutePurpose;
  environment: string;
  isPublicJob: boolean;
  estimatedRevenueCredits: number;
  estimatedCostUsd: number;
}): Promise<ResolvedModelRoute> {
  if (isPublicJob && purpose !== "video_generation") {
    throw new Error("Public jobs may only resolve video_generation routes.");
  }

  const route = await store.findActiveRoute(purpose, environment);
  if (!route) {
    throw new Error(`No active model route for ${purpose} in ${environment}.`);
  }

  const primaryProviderId = route.primaryProviderId;
  if (!primaryProviderId) {
    throw new Error("Model route is missing primary provider.");
  }

  const provider = await store.findProvider(primaryProviderId);
  if (!provider) {
    throw new Error("Model route provider was not found.");
  }

  if (provider.status !== "active") {
    if (
      isPublicJob &&
      route.allowPublicFallback === "true" &&
      route.fallbackProviderId &&
      route.fallbackModel
    ) {
      if (route.minMarginPercent < 45) {
        throw new Error("Public fallback requires at least 45 percent margin.");
      }
    }
    throw new Error("Model route provider is not active.");
  }

  const key = await selectKey({
    store,
    providerId: primaryProviderId,
    environment,
  });
  if (!key) {
    throw new Error(`No active provider key for ${purpose} route.`);
  }

  const videoProvider = providerName(provider.name);

  return {
    routeId: route.id,
    provider: videoProvider,
    model: route.primaryModel,
    providerKeyId: key.id,
    routeSnapshot: routeSnapshot({
      route,
      provider,
      model: route.primaryModel,
      source: "database",
    }),
    source: "database",
  };
}

export function createInMemoryModelRouteStore(input: {
  routes?: ModelRouteRecord[];
  providers?: ModelProviderRecord[];
  keys?: ProviderKeyRecord[];
}): ModelRouteStore {
  return {
    async findActiveRoute(purpose, environment) {
      return (
        (input.routes ?? []).find(
          (route) =>
            route.purpose === purpose &&
            route.environment === environment &&
            route.status === "active",
        ) ?? null
      );
    },
    async findProvider(providerId) {
      return input.providers?.find((provider) => provider.id === providerId) ?? null;
    },
    async findActiveKeys(providerId, environment) {
      return (input.keys ?? []).filter(
        (key) => key.providerId === providerId && key.environment === environment,
      );
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleModelRouteStore(
  db: DbClient = getDb(),
): ModelRouteStore {
  return {
    async findActiveRoute(purpose, environment) {
      const [route] = await db
        .select({
          id: modelRoutes.id,
          purpose: modelRoutes.purpose,
          environment: modelRoutes.environment,
          primaryProviderId: modelRoutes.primaryProviderId,
          primaryModel: modelRoutes.primaryModel,
          fallbackProviderId: modelRoutes.fallbackProviderId,
          fallbackModel: modelRoutes.fallbackModel,
          status: modelRoutes.status,
          minMarginPercent: modelRoutes.minMarginPercent,
          allowPublicFallback: modelRoutes.allowPublicFallback,
        })
        .from(modelRoutes)
        .where(
          and(
            eq(modelRoutes.purpose, purpose),
            eq(modelRoutes.environment, environment),
            eq(modelRoutes.status, "active"),
          ),
        )
        .limit(1);

      return (route as ModelRouteRecord | undefined) ?? null;
    },
    async findProvider(providerId) {
      const [provider] = await db
        .select({
          id: modelProviders.id,
          name: modelProviders.name,
          status: modelProviders.status,
        })
        .from(modelProviders)
        .where(eq(modelProviders.id, providerId))
        .limit(1);

      return (provider as ModelProviderRecord | undefined) ?? null;
    },
    async findActiveKeys(providerId, environment) {
      const rows = await db
        .select({
          id: providerKeys.id,
          providerId: providerKeys.providerId,
          environment: providerKeys.environment,
          status: providerKeys.status,
          currentConcurrency: providerKeys.currentConcurrency,
          concurrentLimit: providerKeys.concurrentLimit,
          currentDailyCost: providerKeys.currentDailyCost,
          dailyCostLimit: providerKeys.dailyCostLimit,
          failureCount: providerKeys.failureCount,
        })
        .from(providerKeys)
        .where(
          and(
            eq(providerKeys.providerId, providerId),
            eq(providerKeys.environment, environment),
          ),
        );

      return rows as ProviderKeyRecord[];
    },
  };
}
