import { describe, expect, it } from "vitest";

import {
  createInMemoryAdminAuditStore,
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
});
