import { describe, expect, it } from "vitest";

import { createInMemoryAdminAuditStore } from "./audit";
import {
  createInMemoryAdminRightsRemovalStore,
  updateRightsRemovalStatus,
} from "./rights-removal";

describe("admin rights removal", () => {
  it("lets operators triage but only admins resolve a case", async () => {
    const store = createInMemoryAdminRightsRemovalStore([
      {
        id: "request-1",
        publicReference: "RR-TEST123",
        status: "received",
        resolutionSummary: null,
        resolvedAt: null,
      },
    ]);
    const auditStore = createInMemoryAdminAuditStore();

    await expect(
      updateRightsRemovalStatus({
        store,
        auditStore,
        actor: {
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        },
        requestId: "request-1",
        status: "triaging",
        reason: "开始核验权利通知",
      }),
    ).resolves.toMatchObject({ status: "triaging" });

    await expect(
      updateRightsRemovalStatus({
        store,
        auditStore,
        actor: {
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        },
        requestId: "request-1",
        status: "resolved_removed",
        reason: "确认并完成删除处理",
        resolutionSummary: "已核验并由运维删除目标资源",
      }),
    ).rejects.toThrow("Actor cannot resolve rights removal requests.");

    expect(auditStore.listAuditLogs()).toEqual([
      expect.objectContaining({
        action: "rights_removal:triage",
        targetType: "rights_removal_request",
        targetId: "request-1",
      }),
    ]);
  });

  it("rejects invalid transitions, short reasons, and missing summaries", async () => {
    const auditStore = createInMemoryAdminAuditStore();

    await expect(
      updateRightsRemovalStatus({
        store: createInMemoryAdminRightsRemovalStore([
          {
            id: "request-1",
            publicReference: "RR-TEST123",
            status: "received",
            resolutionSummary: null,
            resolvedAt: null,
          },
        ]),
        auditStore,
        actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
        requestId: "request-1",
        status: "action_required",
        reason: "非法状态跳转",
      }),
    ).rejects.toThrow("Invalid rights removal status transition.");

    await expect(
      updateRightsRemovalStatus({
        store: createInMemoryAdminRightsRemovalStore([
          {
            id: "request-1",
            publicReference: "RR-TEST123",
            status: "received",
            resolutionSummary: null,
            resolvedAt: null,
          },
        ]),
        auditStore,
        actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
        requestId: "request-1",
        status: "triaging",
        reason: "短",
      }),
    ).rejects.toThrow("Admin action reason must be at least 6 characters.");

    await expect(
      updateRightsRemovalStatus({
        store: createInMemoryAdminRightsRemovalStore([
          {
            id: "request-1",
            publicReference: "RR-TEST123",
            status: "action_required",
            resolutionSummary: null,
            resolvedAt: null,
          },
        ]),
        auditStore,
        actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
        requestId: "request-1",
        status: "resolved_removed",
        reason: "完成最终处理操作",
      }),
    ).rejects.toThrow("Resolution summary is required.");
  });

  it("rejects unknown cases", async () => {
    await expect(
      updateRightsRemovalStatus({
        store: createInMemoryAdminRightsRemovalStore([]),
        auditStore: createInMemoryAdminAuditStore(),
        actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
        requestId: "missing",
        status: "triaging",
        reason: "开始核验权利通知",
      }),
    ).rejects.toThrow("Rights removal request not found.");
  });
});
