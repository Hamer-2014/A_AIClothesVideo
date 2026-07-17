import { describe, expect, it } from "vitest";

import { handleGetRightsRemovalRequests } from "./route";

describe("GET /api/admin/rights-removal", () => {
  it("requires an admin or operator session", async () => {
    const response = await handleGetRightsRemovalRequests(
      new Request("http://localhost/api/admin/rights-removal"),
      { getAdminSession: async () => null },
    );
    expect(response.status).toBe(403);
  });

  it("returns filtered cases to operators", async () => {
    const response = await handleGetRightsRemovalRequests(
      new Request(
        "http://localhost/api/admin/rights-removal?status=received&rightsType=likeness&limit=20",
      ),
      {
        getAdminSession: async () => ({
          userId: "operator-1",
          email: "ops@example.com",
          role: "operator",
        }),
        listRequests: async (filters) => [{ id: "request-1", ...filters }],
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requests: [
        {
          id: "request-1",
          status: "received",
          rightsType: "likeness",
          limit: 20,
        },
      ],
    });
  });
});
