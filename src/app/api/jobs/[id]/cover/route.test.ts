import { describe, expect, it } from "vitest";

import { handleJobCoverRequest } from "./route";

describe("GET /api/jobs/[id]/cover", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleJobCoverRequest(
      new Request("http://localhost/api/jobs/job-1/cover"),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("redirects to a signed cover URL for the owner of a deliverable job", async () => {
    const response = await handleJobCoverRequest(
      new Request("http://localhost/api/jobs/job-1/cover"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createCover: async (input) => {
          expect(input).toEqual({ jobId: "job-1", userId: "user-1" });
          return {
            url: "https://download.example/cover.webp",
            expiresIn: 900,
          };
        },
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://download.example/cover.webp",
    );
  });

  it("rejects cover access before the cover is available", async () => {
    const response = await handleJobCoverRequest(
      new Request("http://localhost/api/jobs/job-1/cover"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createCover: async () => {
          throw new Error("Video job cover is not available.");
        },
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "cover_not_available" });
  });
});
