import { describe, expect, it } from "vitest";

import { handleGetJobListRequest } from "./route";

describe("GET /api/jobs/list", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleGetJobListRequest(
      new Request("http://localhost/api/jobs/list"),
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("returns the current user's jobs", async () => {
    const response = await handleGetJobListRequest(
      new Request("http://localhost/api/jobs/list"),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        getJobs: async ({ userId }) => [
          {
            id: "job-1",
            userId,
            status: "deliverable",
          },
        ],
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        id: "job-1",
        userId: "user-1",
        status: "deliverable",
      },
    ]);
  });
});
