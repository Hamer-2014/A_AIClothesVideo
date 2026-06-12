import { describe, expect, it } from "vitest";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createProviderKey,
  createInMemoryProviderOpsStore,
  getProviderOpsOverview,
  rotateProviderKey,
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
        primaryModel: "veo3.1-fast-beta",
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

  it("rejects provider key updates when reason is too short", async () => {
    await expect(
      updateProviderKeyStatus({
        store: createStore(),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        keyId: "key-1",
        status: "active",
        reason: "short",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
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
      primaryModel: "veo3.1-fast-beta",
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

  it("rejects model route updates when reason is empty or too short", async () => {
    await expect(
      updateModelRoute({
        store: createStore(),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        routeId: "route-1",
        status: "active",
        reason: "   ",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
  });

  it("allows admin to create provider keys without returning secrets", async () => {
    const store = createInMemoryProviderOpsStore({
      providers: [
        {
          id: "provider-1",
          name: "evolink",
          displayName: "EvoLink",
          status: "active",
          baseUrl: "https://api.evolink.ai",
        },
      ],
      keys: [],
      routes: [],
    });
    const auditStore = createInMemoryAdminAuditStore();

    const key = await createProviderKey({
      store,
      auditStore,
      actor,
      input: {
        providerId: "provider-1",
        label: "EvoLink staging",
        environment: "staging",
        plainKey: "sk-test-1234567890",
        dailyCostLimit: "20.00",
        concurrentLimit: 1,
        status: "paused",
        reason: "initial staging key",
      },
      encryptionSecret: "12345678901234567890123456789012",
    });

    expect(key.keyPreview).toBe("sk-t...7890");
    expect(JSON.stringify(key)).not.toContain("sk-test-1234567890");
    expect(JSON.stringify(key)).not.toContain("encrypted");
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "provider_key:create",
      targetType: "provider_key",
    });
  });

  it("rejects operator provider key creation", async () => {
    await expect(
      createProviderKey({
        store: createInMemoryProviderOpsStore({
          providers: [],
          keys: [],
          routes: [],
        }),
        auditStore: createInMemoryAdminAuditStore(),
        actor: { ...actor, role: "operator" },
        input: {
          providerId: "provider-1",
          label: "bad",
          environment: "staging",
          plainKey: "sk-test",
          dailyCostLimit: "20.00",
          concurrentLimit: 1,
          status: "paused",
          reason: "operator attempt",
        },
        encryptionSecret: "12345678901234567890123456789012",
      }),
    ).rejects.toThrow("Actor cannot create provider keys.");
  });

  it("fails provider key creation without encryption secret", async () => {
    await expect(
      createProviderKey({
        store: createStore(),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        input: {
          providerId: "provider-1",
          label: "missing secret",
          environment: "staging",
          plainKey: "sk-test",
          dailyCostLimit: "20.00",
          concurrentLimit: 1,
          status: "paused",
          reason: "missing encryption secret",
        },
        encryptionSecret: "",
      }),
    ).rejects.toThrow("PROVIDER_KEY_ENCRYPTION_SECRET");
  });

  it("allows admin to rotate provider keys and writes audit", async () => {
    const store = createStore();
    const auditStore = createInMemoryAdminAuditStore();

    const key = await rotateProviderKey({
      store,
      auditStore,
      actor,
      keyId: "key-1",
      plainKey: "sk-rotated-abcdef",
      reason: "scheduled key rotation",
      encryptionSecret: "12345678901234567890123456789012",
    });

    expect(key.keyPreview).toBe("sk-r...cdef");
    expect(JSON.stringify(key)).not.toContain("sk-rotated-abcdef");
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "provider_key:rotate",
      targetType: "provider_key",
      targetId: "key-1",
    });
  });
});
