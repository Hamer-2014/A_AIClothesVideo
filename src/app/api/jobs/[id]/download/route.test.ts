import { describe, expect, it } from "vitest";

import { createInMemoryFunnelEventStore } from "@/server/analytics/funnel-events";

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
    const funnelStore = createInMemoryFunnelEventStore();
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
        funnelEventStore: funnelStore,
      },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://download.example/final.mp4",
    );
    expect(funnelStore.listEvents()).toEqual([
      expect.objectContaining({
        eventName: "video_downloaded",
        source: "server",
        userId: "user-1",
        metadata: {
          jobId: "job-1",
        },
      }),
    ]);
    expect(JSON.stringify(funnelStore.listEvents())).not.toContain(
      "https://download.example",
    );
  });

  it("rejects download before the job is deliverable", async () => {
    const response = await handleJobDownloadRequest(
      new Request("http://localhost/api/jobs/job-1/download"),
      { params: { id: "job-1" } },
      {
        getSession: async () => ({ user: { id: "user-1" } }),
        createDownload: async () => {
          throw new Error("Video job is not downloadable.");
        },
      },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "not_downloadable" });
  });
});
