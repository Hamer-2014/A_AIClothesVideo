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

  it("prefers VIDEO_GENERATION_MODEL over EVOLINK_VIDEO_MODEL", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ task_id: "task-generic-model" }), {
        status: 200,
      });
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
          EVOLINK_VIDEO_MODEL: "veo3.1-fast-beta",
          VIDEO_GENERATION_MODEL: "veo3.1-pro-beta",
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.example/v1/videos/generations",
      expect.objectContaining({
        body: expect.stringContaining('"model":"veo3.1-pro-beta"'),
      }),
    );
    expect(result.model).toBe("veo3.1-pro-beta");
  });

  it("accepts a base url that was mistakenly configured as the full generations endpoint", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "task-1",
          status: "pending",
        }),
        { status: 200 },
      );
    });

    await createEvoLinkVideoGeneration(
      {
        prompt: "Generate a front push-in.",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          EVOLINK_API_KEY: "sk-test",
          EVOLINK_BASE_URL: "https://api.evolink.example/v1/videos/generations",
          EVOLINK_VIDEO_MODEL: "veo3.1-fast-beta",
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.evolink.example/v1/videos/generations",
      expect.any(Object),
    );
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
      errorMessage: null,
      raw: expect.any(Object),
    });
  });

  it("parses completed task output urls from the official results array", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "task-1",
          status: "completed",
          results: ["https://provider.example/video.mp4"],
        }),
        { status: 200 },
      );
    });

    const result = await pollEvoLinkTask("task-1", {
      fetch: fetchImpl,
      env: {
        EVOLINK_API_KEY: "sk-test",
        EVOLINK_BASE_URL: "https://api.evolink.example",
        EVOLINK_VIDEO_MODEL: "veo3.1-fast-beta",
      },
    });

    expect(result).toEqual({
      provider: "evolink",
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      status: "succeeded",
      outputUrl: "https://provider.example/video.mp4",
      errorMessage: null,
      raw: expect.any(Object),
    });
  });

  it("parses failed task error messages", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "task-1",
          status: "failed",
          error: {
            code: "generation_failed",
            message: "Input image URL could not be downloaded.",
            type: "task_error",
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
        EVOLINK_VIDEO_MODEL: "veo3.1-fast-beta",
      },
    });

    expect(result).toMatchObject({
      provider: "evolink",
      model: "veo3.1-fast-beta",
      providerTaskId: "task-1",
      status: "failed",
      outputUrl: null,
      errorMessage: "Input image URL could not be downloaded.",
    });
  });
});
