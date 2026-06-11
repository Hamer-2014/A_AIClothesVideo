import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminAuditStore,
  listAdminAuditLogs,
  redactAuditSnapshot,
  writeAdminAuditLog,
} from "./audit";

describe("admin audit log", () => {
  it("records sensitive admin actions with actor and snapshots", async () => {
    const store = createInMemoryAdminAuditStore();

    const record = await writeAdminAuditLog({
      store,
      actor: {
        userId: "11111111-1111-4111-8111-111111111111",
        email: "admin@example.com",
      },
      action: "provider_key:update",
      targetType: "provider_key",
      targetId: "22222222-2222-4222-8222-222222222222",
      reason: "rotate provider key",
      beforeSnapshot: { status: "paused" },
      afterSnapshot: { status: "active" },
      requestMeta: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    });

    expect(record).toMatchObject({
      adminUserId: "11111111-1111-4111-8111-111111111111",
      actorEmail: "admin@example.com",
      action: "provider_key:update",
      targetType: "provider_key",
      targetId: "22222222-2222-4222-8222-222222222222",
      reason: "rotate provider key",
      beforeSnapshot: { status: "paused" },
      afterSnapshot: { status: "active" },
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    });
    expect(store.listAuditLogs()).toHaveLength(1);
  });

  it("filters audit logs by actor action and target", async () => {
    const store = createInMemoryAdminAuditStore();
    await store.createAuditLog({
      actorEmail: "admin@example.com",
      action: "provider_key:create",
      targetType: "provider_key",
      targetId: "key-1",
      reason: "initial key",
    });
    await store.createAuditLog({
      actorEmail: "ops@example.com",
      action: "segment:retry",
      targetType: "segment",
      targetId: "segment-1",
      reason: "retry segment",
    });

    const rows = await listAdminAuditLogs({
      store,
      filters: {
        actorEmail: "admin@example.com",
        action: "provider_key:create",
        targetType: "provider_key",
        targetId: "key-1",
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("provider_key:create");
  });

  it("redacts key and prompt-like values from audit snapshots", () => {
    expect(
      redactAuditSnapshot({
        encryptedKey: "secret-ciphertext",
        plainKey: "sk-live-secret",
        finalPrompt: "model prompt with sensitive garment details",
        nested: {
          api_key: "provider-secret",
          keyPreview: "sk-l...abcd",
        },
      }),
    ).toEqual({
      encryptedKey: "[REDACTED]",
      plainKey: "[REDACTED]",
      finalPrompt: "[REDACTED]",
      nested: {
        api_key: "[REDACTED]",
        keyPreview: "sk-l...abcd",
      },
    });
  });
});
