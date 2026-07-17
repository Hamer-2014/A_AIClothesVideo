import { describe, expect, it } from "vitest";

import { handleUpdateRightsRemovalStatusRequest } from "./route";

describe("POST /api/admin/rights-removal/[id]/status", () => {
  it("maps permission and validation failures", async () => {
    const baseRequest = () =>
      new Request("http://localhost/api/admin/rights-removal/request-1/status", {
        method: "POST",
        body: JSON.stringify({
          status: "resolved_removed",
          reason: "完成最终删除操作",
          resolutionSummary: "已完成目标资源删除",
        }),
      });
    const context = { params: { id: "request-1" } };
    const admin = {
      userId: "operator-1",
      email: "ops@example.com",
      role: "operator" as const,
    };

    const forbidden = await handleUpdateRightsRemovalStatusRequest(
      baseRequest(),
      context,
      {
        getAdminSession: async () => admin,
        updateStatus: async () => {
          throw new Error("Actor cannot resolve rights removal requests.");
        },
      },
    );
    const notFound = await handleUpdateRightsRemovalStatusRequest(
      baseRequest(),
      context,
      {
        getAdminSession: async () => admin,
        updateStatus: async () => {
          throw new Error("Rights removal request not found.");
        },
      },
    );

    expect(forbidden.status).toBe(403);
    expect(notFound.status).toBe(404);
  });

  it("updates an allowed status", async () => {
    const response = await handleUpdateRightsRemovalStatusRequest(
      new Request("http://localhost/api/admin/rights-removal/request-1/status", {
        method: "POST",
        body: JSON.stringify({
          status: "triaging",
          reason: "开始核验权利通知",
        }),
      }),
      { params: { id: "request-1" } },
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
        updateStatus: async (input) => ({
          id: input.requestId,
          status: input.status,
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      request: { id: "request-1", status: "triaging" },
    });
  });
});
