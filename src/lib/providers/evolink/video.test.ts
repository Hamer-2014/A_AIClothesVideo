import { describe, expect, it, vi } from "vitest";

import {
  EvoLinkProviderUnavailableError,
  createEvoLinkVideoGeneration,
  getEvoLinkVideoConfig,
  pollEvoLinkTask,
} from "./video";

describe("EvoLink video provider", () => {
  it("requires an API key", () => {
    expect(() => getEvoLinkVideoConfig({})).toThrow(
      EvoLinkProviderUnavailableError,
    );
  });

  it("submits a video generation task to EvoLink", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          task_id: "task-1",
          status: "queued",
        }),
        { status: 200 },
      );
    });

    const result = await createEvoLinkVideoGeneration(
      {
        prompt: "Generate a front push-in.",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          EVOLINK_API_KEY: "sk-test",
          EVOLINK_BASE_URL: "https://api.evolink.example",
          EVOLINK_VIDEO_MODEL: "veo3.1-pro-beta",
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.example/v1/videos/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          model: "veo3.1-pro-beta",
          prompt: "Generate a front push-in.",
          aspect_ratio: "9:16",
          duration_seconds: 8,
          image_urls: ["https://signed.example/front.jpg"],
        }),
      }),
    );
    expect(result).toEqual({
      provider: "evolink",
      model: "veo3.1-pro-beta",
      providerTaskId: "task-1",
      raw: {
        task_id: "task-1",
        status: "queued",
      },
    });
  });

  it("parses completed task output urls", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          task_id: "task-1",
          status: "succeeded",
          output: {
            videos: [{ url: "https://provider.example/video.mp4" }],
          },
        }),
        { status: 200 },
      );
    });

    const result = await pollEvoLinkTask("task-1", {
      fetch: fetchImpl,
      env: {
        EVOLINK_API_KEY: "sk-test",
        EVOLINK_BASE_URL: "https://api.evolink.example",
        EVOLINK_VIDEO_MODEL: "veo3.1-pro-beta",
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.example/v1/tasks/task-1",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result).toEqual({
      provider: "evolink",
      model: "veo3.1-pro-beta",
      providerTaskId: "task-1",
      status: "succeeded",
      outputUrl: "https://provider.example/video.mp4",
      raw: expect.any(Object),
    });
  });
});
