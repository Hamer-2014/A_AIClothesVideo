import { describe, expect, it } from "vitest";

import { handleGetAuditLogsRequest } from "./route";

describe("GET /api/admin/audit-logs", () => {
  it("rejects non-admin users", async () => {
    const response = await handleGetAuditLogsRequest(
      new Request("http://localhost/api/admin/audit-logs"),
      {
        getAdminSession: async () => null,
      },
    );

    expect(response.status).toBe(403);
  });

  it("rejects operator users", async () => {
    const response = await handleGetAuditLogsRequest(
      new Request("http://localhost/api/admin/audit-logs"),
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
      },
    );

    expect(response.status).toBe(403);
  });

  it("returns filtered audit logs for admin users", async () => {
    const response = await handleGetAuditLogsRequest(
      new Request(
        "http://localhost/api/admin/audit-logs?action=provider_key:create&targetType=provider_key&limit=10",
      ),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        listLogs: async (filters) => [
          {
            id: "audit-1",
            action: filters.action,
            targetType: filters.targetType,
          },
        ],
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      auditLogs: [
        {
          id: "audit-1",
          action: "provider_key:create",
          targetType: "provider_key",
        },
      ],
    });
  });
});
