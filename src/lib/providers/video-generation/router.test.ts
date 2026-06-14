import { describe, expect, it } from "vitest";

import {
  createVideoGeneration,
  createVideoGenerationForProvider,
  getVideoGenerationConfig,
  pollVideoGenerationTaskForProvider,
  pollVideoGenerationTask,
} from "./router";

describe("video generation provider router", () => {
  it("routes EvoLink submissions with env API key and VIDEO_GENERATION_MODEL", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const requestsWithHeaders: Array<{ authorization: string | null }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(url),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      requestsWithHeaders.push({
        authorization: headers.get("Authorization"),
      });

      return Response.json({ task_id: "task-generic-model" });
    };

    const result = await createVideoGeneration(
      {
        prompt: "front push-in",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          VIDEO_GENERATION_PROVIDER: "evolink",
          VIDEO_GENERATION_MODEL: "veo-env-model",
          EVOLINK_API_KEY: "sk-env-evolink",
          EVOLINK_BASE_URL: "https://api.evolink.example",
        },
      },
    );

    expect(result).toMatchObject({
      provider: "evolink",
      model: "veo-env-model",
      providerTaskId: "task-generic-model",
    });
    expect(requests[0]?.body.model).toBe("veo-env-model");
    expect(requestsWithHeaders[0]?.authorization).toBe("Bearer sk-env-evolink");
  });

  it("defaults to APIMart PixVerse when VIDEO_GENERATION_PROVIDER is not set", () => {
    const config = getVideoGenerationConfig({
      APIMART_API_KEY: "sk-test",
    });

    expect(config).toMatchObject({
      provider: "apimart",
      model: "pixverse-v6",
    });
  });

  it("routes APIMart submissions through the APIMart adapter", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        code: 200,
        data: [{ status: "submitted", task_id: "task-apimart" }],
      });

    const result = await createVideoGenerationForProvider(
      "apimart",
      {
        prompt: "front push-in",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          VIDEO_GENERATION_PROVIDER: "apimart",
          VIDEO_GENERATION_MODEL: "pixverse-v6",
          APIMART_API_KEY: "sk-env-apimart",
          APIMART_BASE_URL: "https://api.apimart.ai",
        },
      },
    );

    expect(result).toMatchObject({
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task-apimart",
    });
  });

  it("routes submissions through an explicitly resolved provider", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        code: 200,
        data: [{ status: "submitted", task_id: "task-apimart" }],
      });

    const result = await createVideoGenerationForProvider(
      "apimart",
      {
        prompt: "front push-in",
        imageUrls: ["https://signed.example/front.jpg"],
        aspectRatio: "9:16",
      },
      {
        fetch: fetchImpl,
        env: {
          VIDEO_GENERATION_PROVIDER: "evolink",
          VIDEO_GENERATION_MODEL: "pixverse-v6",
          APIMART_API_KEY: "sk-env-apimart",
          APIMART_BASE_URL: "https://api.apimart.ai",
        },
      },
    );

    expect(result).toMatchObject({
      provider: "apimart",
      model: "pixverse-v6",
      providerTaskId: "task-apimart",
    });
  });

  it("rejects unsupported video generation providers explicitly", async () => {
    await expect(
      createVideoGeneration(
        {
          prompt: "front push-in",
          imageUrls: [],
          aspectRatio: "9:16",
        },
        {
          env: {
            VIDEO_GENERATION_PROVIDER: "unknown-provider",
          },
        },
      ),
    ).rejects.toThrow("Unsupported video generation provider: unknown-provider");
  });

  it("routes task polling through the selected provider", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({
        status: "completed",
        output: { url: "https://provider.example/video.mp4" },
      });

    const result = await pollVideoGenerationTask("task-1", {
      fetch: fetchImpl,
      env: {
        VIDEO_GENERATION_PROVIDER: "evolink",
        VIDEO_GENERATION_MODEL: "veo-env-model",
        EVOLINK_API_KEY: "sk-env-evolink",
        EVOLINK_BASE_URL: "https://api.evolink.example",
      },
    });

    expect(result).toMatchObject({
      provider: "evolink",
      model: "veo-env-model",
      providerTaskId: "task-1",
      status: "succeeded",
      outputUrl: "https://provider.example/video.mp4",
    });
  });

  it("polls a task with the persisted provider instead of the current env provider", async () => {
    const fetchImpl: typeof fetch = async (url) => {
      expect(String(url)).toBe("https://api.apimart.example/v1/tasks/task-apimart");
      return Response.json({
        code: 200,
        data: {
          id: "task-apimart",
          status: "completed",
          result: {
            videos: [{ url: ["https://provider.example/apimart.mp4"] }],
          },
        },
      });
    };

    const result = await pollVideoGenerationTaskForProvider(
      "apimart",
      "task-apimart",
      {
        fetch: fetchImpl,
        env: {
          VIDEO_GENERATION_PROVIDER: "evolink",
          VIDEO_GENERATION_MODEL: "pixverse-v6",
          APIMART_API_KEY: "sk-env-apimart",
          APIMART_BASE_URL: "https://api.apimart.example",
          EVOLINK_BASE_URL: "https://api.evolink.example",
        },
      },
    );

    expect(result).toMatchObject({
      provider: "apimart",
      providerTaskId: "task-apimart",
      status: "succeeded",
      outputUrl: "https://provider.example/apimart.mp4",
    });
  });
});
