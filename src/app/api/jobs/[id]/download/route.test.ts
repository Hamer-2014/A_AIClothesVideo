import { describe, expect, it } from "vitest";

import { handleJobDownloadRequest } from "./route";

describe("GET /api/jobs/[id]/download", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await handleJobDownloadRequest(
      new Request("http://localhost/api/jobs/job-1/download"),
      { params: { id: "job-1" } },
      {
        getSession: async () => null,
      },
    );

    expect(response.status).toBe(401);
  });

  it("redirects to a signed attachment URL for the owner of a deliverable job", async () => {
    const response = await handleJobDownloadRequest(
      new Request(
        "http://localhost/api/jobs/job-1/download?filename=spring-dress.mp4",
      ),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createDownload: async (input) => {
          expect(input.filename).toBe("spring-dress.mp4");
          return {
            url: "https://download.example/final.mp4",
            expiresIn: 900,
          };
        },
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://download.example/final.mp4",
    );
  });
});
