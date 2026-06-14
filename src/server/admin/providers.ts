import { getDb } from "@/lib/db/client";
import { modelProviders, providerKeys } from "@/lib/db/schema";
import type {
  providerPurposeValues,
  providerStatusValues,
} from "@/lib/db/schema/providers";
import type { AdminRole } from "@/server/auth/admin-access";

import type { AdminAuditActor } from "./audit";

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
      return [];
    },
  };
}
