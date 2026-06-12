import { describe, expect, it, vi } from "vitest";

import {
  APIMartVideoProviderUnavailableError,
  createAPIMartVideoGeneration,
  getAPIMartVideoConfig,
  pollAPIMartTask,
} from "./video";

describe("APIMart video provider", () => {
  it("requires an API key", () => {
    expect(() => getAPIMartVideoConfig({})).toThrow(
      APIMartVideoProviderUnavailableError,
    );
  });

  it("submits a PixVerse video generation task to APIMart", async () => {
    const fetchImpl = vi.fn(async () => {
      return Response.json({
        code: 200,
        data: [
          {
            status: "submitted",
            task_id: "task_apimart_1",
          },
        ],
      });
    });

    const result = await createAPIMartVideoGeneration(
      {
        prompt: "Generate a front push-in.",
        imageUrls: [
          "https://signed.example/front.jpg",
          "https://signed.example/detail.jpg",
        ],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          APIMART_API_KEY: "sk-test",
          APIMART_BASE_URL: "https://api.apimart.ai/v1/videos/generations",
          APIMART_PIXVERSE_MODEL: "pixverse-v6",
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.apimart.ai/v1/videos/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          model: "pixverse-v6",
          prompt: "Generate a front push-in.",
          duration: 8,
          resolution: "540p",
          size: "9:16",
          img_references: [
            "https://signed.example/front.jpg",
            "https://signed.example/detail.jpg",
          ],
        }),
      }),
    );
    expect(result).toEqual({
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task_apimart_1",
      raw: {
        code: 200,
        data: [
          {
            status: "submitted",
            task_id: "task_apimart_1",
          },
        ],
      },
    });
  });

  it("uses image_urls for single-image PixVerse tasks", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        code: 200,
        data: [{ status: "submitted", task_id: "task_single_image" }],
      }),
    );

    await createAPIMartVideoGeneration(
      {
        prompt: "Generate a front push-in.",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          APIMART_API_KEY: "sk-test",
          APIMART_BASE_URL: "https://api.apimart.ai",
          VIDEO_GENERATION_MODEL: "pixverse-v6",
        },
      },
    );

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.apimart.ai/v1/videos/generations",
      expect.objectContaining({
        body: expect.stringContaining('"image_urls":["https://signed.example/front.jpg"]'),
      }),
    );
  });

  it("polls APIMart task status and extracts completed video url", async () => {
    const fetchImpl = vi.fn(async () => {
      return Response.json({
        code: 200,
        data: {
          id: "task_apimart_1",
          status: "completed",
          result: {
            videos: [
              {
                url: ["https://upload.apimart.ai/f/video/result.mp4"],
              },
            ],
          },
        },
      });
    });

    const result = await pollAPIMartTask("task_apimart_1", {
      fetch: fetchImpl,
      env: {
        APIMART_API_KEY: "sk-test",
        APIMART_BASE_URL: "https://api.apimart.ai/v1/videos/generations",
        APIMART_PIXVERSE_MODEL: "pixverse-v6",
      },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.apimart.ai/v1/tasks/task_apimart_1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual({
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task_apimart_1",
      status: "succeeded",
      outputUrl: "https://upload.apimart.ai/f/video/result.mp4",
      errorMessage: null,
      raw: expect.any(Object),
    });
  });

  it("normalizes failed APIMart task errors", async () => {
    const fetchImpl = vi.fn(async () => {
      return Response.json({
        code: 200,
        data: {
          id: "task_apimart_1",
          status: "failed",
          error: {
            message: "pixverse error 400063: moderation failed",
          },
        },
      });
    });

    const result = await pollAPIMartTask("task_apimart_1", {
      fetch: fetchImpl,
      env: {
        APIMART_API_KEY: "sk-test",
      },
    });

    expect(result).toMatchObject({
      provider: "apimart",
      providerTaskId: "task_apimart_1",
      status: "failed",
      outputUrl: null,
      errorMessage: "pixverse error 400063: moderation failed",
    });
  });
});
