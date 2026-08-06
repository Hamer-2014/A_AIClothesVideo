import { describe, expect, it, vi } from "vitest";

import { createInMemoryProviderCallLogStore } from "@/lib/providers/log-call";
import { createVirtualTryOnGenerationProvider } from "./generation-provider";
import type { RuntimeJob } from "./runtime";

function job(mode: RuntimeJob["mode"] = "three_view"): RuntimeJob {
  return {
    id: "job-1",
    packId: "pack-1",
    userId: "user-1",
    mode,
    status: "queued",
    creditCost: 3,
    lockedUntil: null,
    sourceKeys: {
      front: "users/user-1/assets/front/original.png",
      back: "users/user-1/assets/back/original.png",
      detail: "users/user-1/assets/detail/original.png",
    },
    modelKeys: {
      front: "platform/models/look/front.png",
      side: "platform/models/look/side.png",
      back: "platform/models/look/back.png",
    },
    assets: [],
  };
}

describe("virtual try-on APIMart generation provider", () => {
  it("forms the side reference chain from the transferred front result", async () => {
    const signer = vi.fn(async ({ key }: { key: string; expiresIn: number }) => "https://signed.example/" + key + "?signature=secret");
    const imageClient = vi.fn(async () => ({ provider: "apimart" as const, model: "gpt-image-2", providerTaskId: "task-1" }));
    const input = job();
    input.assets = [{ view: "front", providerTaskId: "task-front", providerStatus: "succeeded", attemptCount: 1, r2Key: "virtual-try-on/job-1/packs/pack-1/front.png" }];
    const provider = createVirtualTryOnGenerationProvider({ signer, imageClient, pollClient: vi.fn(), providerLogStore: createInMemoryProviderCallLogStore() });

    await expect(provider.submit(input, "side")).resolves.toBe("task-1");
    expect(signer.mock.calls.map(([input]) => input)).toEqual([
      { key: "platform/models/look/side.png", expiresIn: 300 },
      { key: "virtual-try-on/job-1/packs/pack-1/front.png", expiresIn: 300 },
      { key: "users/user-1/assets/front/original.png", expiresIn: 300 },
      { key: "users/user-1/assets/back/original.png", expiresIn: 300 },
      { key: "users/user-1/assets/detail/original.png", expiresIn: 300 },
    ]);
    expect(imageClient).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: [
      "https://signed.example/platform/models/look/side.png?signature=secret",
      "https://signed.example/virtual-try-on/job-1/packs/pack-1/front.png?signature=secret",
      "https://signed.example/users/user-1/assets/front/original.png?signature=secret",
      "https://signed.example/users/user-1/assets/back/original.png?signature=secret",
      "https://signed.example/users/user-1/assets/detail/original.png?signature=secret",
    ] }));
  });

  it("uses only the front model and available front garment references for front_only", async () => {
    const signer = vi.fn(async ({ key }: { key: string }) => "signed:" + key);
    const imageClient = vi.fn(async () => ({ provider: "apimart" as const, model: "gpt-image-2", providerTaskId: "task-1" }));
    const input = job("front_only");
    delete input.sourceKeys.back;
    const provider = createVirtualTryOnGenerationProvider({ signer, imageClient, pollClient: vi.fn(), providerLogStore: createInMemoryProviderCallLogStore() });

    await provider.submit(input, "front");
    expect(signer.mock.calls.map(([call]) => call.key)).toEqual([
      "platform/models/look/front.png",
      "users/user-1/assets/front/original.png",
      "users/user-1/assets/detail/original.png",
    ]);
    expect(imageClient).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringMatching(
        /9:16[\s\S]*full body[\s\S]*shoes[\s\S]*garment hem[\s\S]*safe area/i,
      ),
    }));
  });

  it("fails closed when a side or back view lacks its transferred predecessor", async () => {
    const signer = vi.fn();
    const imageClient = vi.fn();
    const provider = createVirtualTryOnGenerationProvider({ signer, imageClient, pollClient: vi.fn(), providerLogStore: createInMemoryProviderCallLogStore() });
    await expect(provider.submit(job(), "side")).rejects.toThrow("virtual_tryon_prior_view_missing");
    expect(signer).not.toHaveBeenCalled();
    await expect(provider.submit({ ...job(), assets: [{ view: "front", providerTaskId: "task", providerStatus: "succeeded", attemptCount: 1, r2Key: "front" }] }, "back")).rejects.toThrow("virtual_tryon_prior_view_missing");
  });

  it("fails closed before signing when a required model key is absent", async () => {
    const input = job();
    delete (input.modelKeys as Partial<RuntimeJob["modelKeys"]>).side;
    const signer = vi.fn();
    const imageClient = vi.fn();
    const provider = createVirtualTryOnGenerationProvider({ signer, imageClient, pollClient: vi.fn(), providerLogStore: createInMemoryProviderCallLogStore() });

    await expect(provider.submit(input, "side")).rejects.toThrow("virtual_tryon_model_key_missing");
    expect(signer).not.toHaveBeenCalled();
    expect(imageClient).not.toHaveBeenCalled();
  });

  it("records only sanitized submit and poll metadata while returning the output URL in memory", async () => {
    const logs = createInMemoryProviderCallLogStore();
    const provider = createVirtualTryOnGenerationProvider({
      signer: async ({ key }) => "https://signed.example/" + key + "?token=secret",
      imageClient: async () => ({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1" }),
      pollClient: async () => ({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1", status: "succeeded", outputUrl: "https://provider.example/output.png?token=secret" }),
      providerLogStore: logs,
    });

    await provider.submit(job("front_only"), "front");
    await expect(provider.poll(job("front_only"), "front", "task-1")).resolves.toMatchObject({ status: "succeeded", outputUrl: "https://provider.example/output.png?token=secret" });

    const encoded = JSON.stringify(logs.listCallLogs());
    expect(encoded).not.toMatch(/https:\/\/|secret|users\/user-1|platform\/models|raw/i);
    expect(logs.listCallLogs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ virtualTryonJobId: "job-1", purpose: "virtual_tryon_image", requestSnapshot: { view: "front", imageCount: 3, promptHash: expect.any(String) } }),
      expect.objectContaining({ virtualTryonJobId: "job-1", purpose: "virtual_tryon_image", responseSummary: { taskId: "task-1", status: "succeeded", cost: null } }),
    ]));
  });

  it("sanitizes a provider failure before writing it to the audit log", async () => {
    const logs = createInMemoryProviderCallLogStore();
    const provider = createVirtualTryOnGenerationProvider({
      signer: async ({ key }) => "https://signed.example/" + key + "?token=secret",
      imageClient: async () => {
        const error = new Error("raw provider response");
        Object.assign(error, { code: "https://provider.example/error?apiKey=secret" });
        throw error;
      },
      pollClient: vi.fn(),
      providerLogStore: logs,
    });

    await expect(provider.submit(job("front_only"), "front")).rejects.toThrow("raw provider response");
    const encoded = JSON.stringify(logs.listCallLogs());
    expect(encoded).not.toMatch(/https:\/\/|secret|apiKey|raw/i);
    expect(logs.listCallLogs()[0]).toMatchObject({ status: "failed", errorCode: "provider_error" });
  });

  it("persists the APIMart task despite a transient audit write failure", async () => {
    const provider = createVirtualTryOnGenerationProvider({
      signer: async ({ key }) => "signed:" + key,
      imageClient: async () => ({ provider: "apimart", model: "gpt-image-2", providerTaskId: "task-1" }),
      pollClient: vi.fn(),
      providerLogStore: { createCallLog: async () => { throw new Error("database_unavailable"); } },
    });

    await expect(provider.submit(job("front_only"), "front")).resolves.toBe("task-1");
  });
});
