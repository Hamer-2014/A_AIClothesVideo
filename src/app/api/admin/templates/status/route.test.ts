import { describe, expect, it } from "vitest";

import { handleUpdateTemplateStatusRequest } from "./route";

describe("POST /api/admin/templates/status", () => {
  it("returns 403 for non-admin users", async () => {
    const response = await handleUpdateTemplateStatusRequest(
      new Request("http://localhost/api/admin/templates/status", {
        method: "POST",
        body: JSON.stringify({
          templateId: "front_pan",
          version: 1,
          status: "paused",
        }),
      }),
      {
        getAdminSession: async () => null,
      },
    );

    expect(response.status).toBe(403);
  });

  it("updates template status for admins", async () => {
    const response = await handleUpdateTemplateStatusRequest(
      new Request("http://localhost/api/admin/templates/status", {
        method: "POST",
        body: JSON.stringify({
          templateId: "front_pan",
          version: 1,
          status: "paused",
          reason: "pause unstable template",
        }),
      }),
      {
        getAdminSession: async () => ({
          userId: "admin-1",
          email: "admin@example.com",
          role: "admin",
        }),
        updateStatus: async (input) => ({
          templateId: input.templateId,
          version: input.version,
          status: input.status,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      templateId: "front_pan",
      version: 1,
      status: "paused",
    });
  });

  it("rejects missing, whitespace-only, and short reasons", async () => {
    for (const reason of ["", "   ", "short"]) {
      const response = await handleUpdateTemplateStatusRequest(
        new Request("http://localhost/api/admin/templates/status", {
          method: "POST",
          body: JSON.stringify({
            templateId: "front_pan",
            version: 1,
            status: "paused",
            reason,
          }),
        }),
        {
          getAdminSession: async () => ({
            userId: "admin-1",
            email: "admin@example.com",
            role: "admin",
          }),
        },
      );

      expect(response.status).toBe(400);
    }
  });
});
