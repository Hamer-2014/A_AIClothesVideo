import { describe, expect, it } from "vitest";

import { sendStitchCallback } from "./callback";

describe("sendStitchCallback", () => {
  it("posts the stitch result back to the main app with the worker secret", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];

    await sendStitchCallback({
      callbackUrl: "https://app.example.com/api/internal/stitch/callback",
      workerSecret: "secret",
      result: {
        stitchJobId: "stitch-1",
        status: "succeeded",
        finalVideoKey: "jobs/job-1/stitched/final.mp4",
        coverKey: "jobs/job-1/covers/cover.webp",
        frameKeys: ["jobs/job-1/qa/frames/0.jpg"],
      },
      fetch: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return Response.json({ ok: true });
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://app.example.com/api/internal/stitch/callback",
    );
    expect(calls[0]?.init.headers).toEqual({
      "content-type": "application/json",
      "x-worker-secret": "secret",
    });
  });

  it("throws when the main app rejects the callback", async () => {
    await expect(
      sendStitchCallback({
        callbackUrl: "https://app.example.com/api/internal/stitch/callback",
        workerSecret: "secret",
        result: { stitchJobId: "stitch-1", status: "failed" },
        fetch: async () => Response.json({ error: "unauthorized" }, { status: 401 }),
      }),
    ).rejects.toThrow("Stitch callback failed with status 401.");
  });
});
