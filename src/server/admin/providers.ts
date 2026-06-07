import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { modelProviders, modelRoutes, providerKeys } from "@/lib/db/schema";
import type {
  providerPurposeValues,
  providerStatusValues,
} from "@/lib/db/schema/providers";
import { canRolePerformAdminAction, type AdminRole } from "@/server/auth/admin-access";

import {
  type AdminAuditActor,
  type AdminAuditStore,
  type AdminAuditRequestMeta,
  toAuditSnapshot,
  writeAdminAuditLog,
} from "./audit";

export type ProviderStatus = (typeof providerStatusValues)[number];
export type ProviderPurpose = (typeof providerPurposeValues)[number];

export interface ProviderOpsActor extends AdminAuditActor {
  role: AdminRole;
}

export interface ProviderOpsProvider {
  id: string;
  name: string;
  displayName: string;
  status: ProviderStatus;
  baseUrl: string | null;
}

export interface ProviderOpsKey {
  id: string;
  providerId: string;
  label: string;
  environment: string;
  status: ProviderStatus;
  keyPreview: string;
  dailyCostLimit: string;
  currentDailyCost: string;
  concurrentLimit: number;
  currentConcurrency: number;
  failureCount: number;
}

export interface ProviderOpsRoute {
  id: string;
  purpose: ProviderPurpose;
  environment: string;
  primaryProviderId: string | null;
  primaryModel: string;
  fallbackProviderId: string | null;
  fallbackModel: string | null;
  status: ProviderStatus;
  minMarginPercent: number;
  allowPublicFallback: string;
}

export interface ProviderOpsStore {
  listProviders(): Promise<ProviderOpsProvider[]>;
  listKeys(): Promise<ProviderOpsKey[]>;
  listRoutes(): Promise<ProviderOpsRoute[]>;
  findKey(keyId: string): Promise<ProviderOpsKey | null>;
  updateKeyStatus(input: {
    keyId: string;
    status: ProviderStatus;
  }): Promise<ProviderOpsKey>;
  findRoute(routeId: string): Promise<ProviderOpsRoute | null>;
  updateRoute(input: {
    routeId: string;
    status?: ProviderStatus;
    primaryModel?: string;
    minMarginPercent?: number;
    allowPublicFallback?: boolean;
  }): Promise<ProviderOpsRoute>;
}

export async function getProviderOpsOverview({
  store,
}: {
  store: ProviderOpsStore;
}) {
  const [providers, keys, routes] = await Promise.all([
    store.listProviders(),
    store.listKeys(),
    store.listRoutes(),
  ]);

  return {
    providers,
    keys,
    routes,
  };
}

export async function updateProviderKeyStatus({
  store,
  auditStore,
  actor,
  keyId,
  status,
  reason,
  requestMeta,
}: {
  store: ProviderOpsStore;
  auditStore: AdminAuditStore;
  actor: ProviderOpsActor;
  keyId: string;
  status: ProviderStatus;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "provider_key:update")) {
    throw new Error("Actor cannot update provider keys.");
  }

  const before = await store.findKey(keyId);
  if (!before) {
    throw new Error("Provider key not found.");
  }

  const after = await store.updateKeyStatus({ keyId, status });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "provider_key:update",
    targetType: "provider_key",
    targetId: keyId,
    reason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return after;
}

export async function updateModelRoute({
  store,
  auditStore,
  actor,
  routeId,
  status,
  primaryModel,
  minMarginPercent,
  allowPublicFallback,
  reason,
  requestMeta,
}: {
  store: ProviderOpsStore;
  auditStore: AdminAuditStore;
  actor: ProviderOpsActor;
  routeId: string;
  status?: ProviderStatus;
  primaryModel?: string;
  minMarginPercent?: number;
  allowPublicFallback?: boolean;
  reason: string;
  requestMeta?: AdminAuditRequestMeta;
}) {
  if (!canRolePerformAdminAction(actor.role, "model_route:update")) {
    throw new Error("Actor cannot update model routes.");
  }

  const before = await store.findRoute(routeId);
  if (!before) {
    throw new Error("Model route not found.");
  }

  const after = await store.updateRoute({
    routeId,
    status,
    primaryModel,
    minMarginPercent,
    allowPublicFallback,
  });
  await writeAdminAuditLog({
    store: auditStore,
    actor,
    action: "model_route:update",
    targetType: "model_route",
    targetId: routeId,
    reason,
    beforeSnapshot: toAuditSnapshot(before),
    afterSnapshot: toAuditSnapshot(after),
    requestMeta,
  });

  return after;
}

export function createInMemoryProviderOpsStore(input: {
  providers: ProviderOpsProvider[];
  keys: ProviderOpsKey[];
  routes: ProviderOpsRoute[];
}): ProviderOpsStore {
  const providers = input.providers.map((provider) => ({ ...provider }));
  const keys = new Map(input.keys.map((key) => [key.id, { ...key }]));
  const routes = new Map(input.routes.map((route) => [route.id, { ...route }]));

  return {
    async listProviders() {
      return providers.map((provider) => ({ ...provider }));
    },
    async listKeys() {
      return Array.from(keys.values()).map((key) => ({ ...key }));
    },
    async listRoutes() {
      return Array.from(routes.values()).map((route) => ({ ...route }));
    },
    async findKey(keyId) {
      const key = keys.get(keyId);
      return key ? { ...key } : null;
    },
    async updateKeyStatus({ keyId, status }) {
      const key = keys.get(keyId);
      if (!key) {
        throw new Error("Provider key not found.");
      }
      const updated = { ...key, status };
      keys.set(keyId, updated);
      return { ...updated };
    },
    async findRoute(routeId) {
      const route = routes.get(routeId);
      return route ? { ...route } : null;
    },
    async updateRoute({
      routeId,
      status,
      primaryModel,
      minMarginPercent,
      allowPublicFallback,
    }) {
      const route = routes.get(routeId);
      if (!route) {
        throw new Error("Model route not found.");
      }
      const updated = {
        ...route,
        status: status ?? route.status,
        primaryModel: primaryModel ?? route.primaryModel,
        minMarginPercent: minMarginPercent ?? route.minMarginPercent,
        allowPublicFallback:
          allowPublicFallback === undefined
            ? route.allowPublicFallback
            : String(allowPublicFallback),
      };
      routes.set(routeId, updated);
      return { ...updated };
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleProviderOpsStore(
  db: DbClient = getDb(),
): ProviderOpsStore {
  return {
    async listProviders() {
      return db
        .select({
          id: modelProviders.id,
          name: modelProviders.name,
          displayName: modelProviders.displayName,
          status: modelProviders.status,
          baseUrl: modelProviders.baseUrl,
        })
        .from(modelProviders);
    },
    async listKeys() {
      return db
        .select({
          id: providerKeys.id,
          providerId: providerKeys.providerId,
          label: providerKeys.label,
          environment: providerKeys.environment,
          status: providerKeys.status,
          keyPreview: providerKeys.keyPreview,
          dailyCostLimit: providerKeys.dailyCostLimit,
          currentDailyCost: providerKeys.currentDailyCost,
          concurrentLimit: providerKeys.concurrentLimit,
          currentConcurrency: providerKeys.currentConcurrency,
          failureCount: providerKeys.failureCount,
        })
        .from(providerKeys);
    },
    async listRoutes() {
      return db
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
        .from(modelRoutes);
    },
    async findKey(keyId) {
      const [key] = await db
        .select({
          id: providerKeys.id,
          providerId: providerKeys.providerId,
          label: providerKeys.label,
          environment: providerKeys.environment,
          status: providerKeys.status,
          keyPreview: providerKeys.keyPreview,
          dailyCostLimit: providerKeys.dailyCostLimit,
          currentDailyCost: providerKeys.currentDailyCost,
          concurrentLimit: providerKeys.concurrentLimit,
          currentConcurrency: providerKeys.currentConcurrency,
          failureCount: providerKeys.failureCount,
        })
        .from(providerKeys)
        .where(eq(providerKeys.id, keyId))
        .limit(1);

      return (key as ProviderOpsKey | undefined) ?? null;
    },
    async updateKeyStatus({ keyId, status }) {
      const [key] = await db
        .update(providerKeys)
        .set({ status })
        .where(eq(providerKeys.id, keyId))
        .returning({
          id: providerKeys.id,
          providerId: providerKeys.providerId,
          label: providerKeys.label,
          environment: providerKeys.environment,
          status: providerKeys.status,
          keyPreview: providerKeys.keyPreview,
          dailyCostLimit: providerKeys.dailyCostLimit,
          currentDailyCost: providerKeys.currentDailyCost,
          concurrentLimit: providerKeys.concurrentLimit,
          currentConcurrency: providerKeys.currentConcurrency,
          failureCount: providerKeys.failureCount,
        });

      if (!key) {
        throw new Error("Provider key not found.");
      }

      return key as ProviderOpsKey;
    },
    async findRoute(routeId) {
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
        .where(eq(modelRoutes.id, routeId))
        .limit(1);

      return (route as ProviderOpsRoute | undefined) ?? null;
    },
    async updateRoute({
      routeId,
      status,
      primaryModel,
      minMarginPercent,
      allowPublicFallback,
    }) {
      const [route] = await db
        .update(modelRoutes)
        .set({
          ...(status ? { status } : {}),
          ...(primaryModel ? { primaryModel } : {}),
          ...(minMarginPercent === undefined ? {} : { minMarginPercent }),
          ...(allowPublicFallback === undefined
            ? {}
            : { allowPublicFallback: String(allowPublicFallback) }),
        })
        .where(eq(modelRoutes.id, routeId))
        .returning({
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
        });

      if (!route) {
        throw new Error("Model route not found.");
      }

      return route as ProviderOpsRoute;
    },
  };
}
