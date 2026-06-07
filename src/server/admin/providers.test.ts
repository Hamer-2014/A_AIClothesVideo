import { describe, expect, it } from "vitest";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createInMemoryProviderOpsStore,
  getProviderOpsOverview,
  updateModelRoute,
  updateProviderKeyStatus,
} from "./providers";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};

function createStore() {
  return createInMemoryProviderOpsStore({
    providers: [
      {
        id: "provider-1",
        name: "evolink",
        displayName: "EvoLink",
        status: "active",
        baseUrl: "https://api.evolink.ai",
      },
    ],
    keys: [
      {
        id: "key-1",
        providerId: "provider-1",
        label: "main",
        environment: "development",
        status: "paused",
        keyPreview: "sk_...1234",
        dailyCostLimit: "100",
        currentDailyCost: "0",
        concurrentLimit: 2,
        currentConcurrency: 0,
        failureCount: 0,
      },
    ],
    routes: [
      {
        id: "route-1",
        purpose: "video_generation",
        environment: "development",
        primaryProviderId: "provider-1",
        primaryModel: "veo3.1-pro-beta",
        fallbackProviderId: null,
        fallbackModel: null,
        status: "paused",
        minMarginPercent: 45,
        allowPublicFallback: "false",
      },
    ],
  });
}

describe("provider ops", () => {
  it("returns provider overview without encrypted keys", async () => {
    const overview = await getProviderOpsOverview({ store: createStore() });

    expect(overview.keys[0]).toEqual(
      expect.objectContaining({
        id: "key-1",
        keyPreview: "sk_...1234",
      }),
    );
    expect(overview.keys[0]).not.toHaveProperty("encryptedKey");
  });

  it("updates provider key status and writes audit log", async () => {
    const store = createStore();
    const auditStore = createInMemoryAdminAuditStore();

    const result = await updateProviderKeyStatus({
      store,
      auditStore,
      actor,
      keyId: "key-1",
      status: "active",
      reason: "enable provider",
    });

    expect(result.status).toBe("active");
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "provider_key:update",
      targetType: "provider_key",
      targetId: "key-1",
      reason: "enable provider",
    });
  });

  it("blocks operators from updating provider keys", async () => {
    await expect(
      updateProviderKeyStatus({
        store: createStore(),
        auditStore: createInMemoryAdminAuditStore(),
        actor: { ...actor, role: "operator" },
        keyId: "key-1",
        status: "active",
        reason: "operator should not do this",
      }),
    ).rejects.toThrow("Actor cannot update provider keys.");
  });

  it("updates model route and writes audit log", async () => {
    const store = createStore();
    const auditStore = createInMemoryAdminAuditStore();

    const result = await updateModelRoute({
      store,
      auditStore,
      actor,
      routeId: "route-1",
      status: "active",
      primaryModel: "veo3.1-pro-beta",
      minMarginPercent: 50,
      allowPublicFallback: false,
      reason: "activate route",
    });

    expect(result).toMatchObject({
      id: "route-1",
      status: "active",
      minMarginPercent: 50,
      allowPublicFallback: "false",
    });
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "model_route:update",
      targetType: "model_route",
      targetId: "route-1",
    });
  });
});
