import { describe, expect, it } from "vitest";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createInMemoryTemplateActionStore,
  updateTemplateStatusByAdmin,
} from "./template-actions";

const actor = {
  userId: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  role: "admin" as const,
};

describe("template actions", () => {
  it("updates template status and writes audit log", async () => {
    const store = createInMemoryTemplateActionStore([
      {
        templateId: "front_pan",
        version: 1,
        status: "active",
      },
    ]);
    const auditStore = createInMemoryAdminAuditStore();

    const result = await updateTemplateStatusByAdmin({
      store,
      auditStore,
      actor,
      templateId: "front_pan",
      version: 1,
      status: "paused",
      reason: "pause risky template",
    });

    expect(result).toEqual({
      templateId: "front_pan",
      version: 1,
      status: "paused",
    });
    expect(auditStore.listAuditLogs()[0]).toMatchObject({
      action: "template:update_status",
      targetType: "shot_template",
      targetId: "front_pan@1",
      reason: "pause risky template",
    });
  });

  it("rejects short reasons", async () => {
    await expect(
      updateTemplateStatusByAdmin({
        store: createInMemoryTemplateActionStore([
          {
            templateId: "front_pan",
            version: 1,
            status: "active",
          },
        ]),
        auditStore: createInMemoryAdminAuditStore(),
        actor,
        templateId: "front_pan",
        version: 1,
        status: "paused",
        reason: "short",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");
  });

  it("keeps operator access but blocks viewers through role checks", async () => {
    const result = await updateTemplateStatusByAdmin({
      store: createInMemoryTemplateActionStore([
        {
          templateId: "front_pan",
          version: 1,
          status: "active",
        },
      ]),
      auditStore: createInMemoryAdminAuditStore(),
      actor: { ...actor, role: "operator" },
      templateId: "front_pan",
      version: 1,
      status: "paused",
      reason: "pause risky template",
    });

    expect(result.status).toBe("paused");
  });
});
