import { createHash } from "node:crypto";

import { createAPIMartImageGeneration, pollAPIMartImageTask } from "@/lib/providers/apimart/image";
import type { ProviderCallLogStore } from "@/lib/providers/log-call";
import type { AppearanceView } from "./config";
import { sanitizeVirtualTryOnProviderLog } from "./provider-log";
import type { RuntimeAsset, RuntimeJob } from "./runtime";

type SignedUrlInput = { key: string; expiresIn: number };
type ImageClient = typeof createAPIMartImageGeneration;
type PollClient = typeof pollAPIMartImageTask;

export type VirtualTryOnGenerationProviderDeps = {
  signer: (input: SignedUrlInput) => Promise<string>;
  imageClient?: ImageClient;
  pollClient?: PollClient;
  providerLogStore: ProviderCallLogStore;
};

function promptFor(view: AppearanceView) {
  return "Create a single static " + view + " view of the configured AI model wearing the supplied garment. The ordered references are model, prior generated views when present, then garment front, garment back and garment detail. Use prior generated views only to preserve the same person and garment across views. Preserve the garment silhouette, color, pattern, construction and visible details. Do not invent garment details that are not present in the garment references.";
}

function promptHash(prompt: string) {
  return createHash("sha256").update(prompt).digest("hex");
}

function sourceKeysFor(job: RuntimeJob) {
  if (!job.sourceKeys.front) throw new Error("virtual_tryon_source_keys_invalid");
  const keys = [job.sourceKeys.front];
  if (job.mode === "three_view") {
    if (!job.sourceKeys.back || !job.sourceKeys.detail) throw new Error("virtual_tryon_source_keys_invalid");
    keys.push(job.sourceKeys.back, job.sourceKeys.detail);
  } else if (job.sourceKeys.detail) {
    keys.push(job.sourceKeys.detail);
  }
  return keys;
}

function priorGeneratedKeysFor(job: RuntimeJob, view: AppearanceView) {
  if (job.mode !== "three_view" || view === "front") return [];
  const priorViews = view === "side" ? ["front"] as const : ["front", "side"] as const;
  const keys = priorViews.map((priorView) => job.assets.find((asset) => asset.view === priorView)?.r2Key);
  if (keys.some((key) => !key)) throw new Error("virtual_tryon_prior_view_missing");
  return keys as string[];
}

async function writeLog(input: {
  deps: VirtualTryOnGenerationProviderDeps;
  job: RuntimeJob;
  view: AppearanceView;
  imageCount: number;
  prompt: string;
  status: "succeeded" | "failed";
  taskId?: string | null;
  providerStatus: string;
  errorCode?: string | null;
}) {
  const sanitized = sanitizeVirtualTryOnProviderLog({ view: input.view, imageCount: input.imageCount, promptHash: promptHash(input.prompt), taskId: input.taskId, status: input.providerStatus, errorCode: input.errorCode });
  try {
    await input.deps.providerLogStore.createCallLog({
      provider: "apimart",
      model: "gpt-image-2",
      purpose: "virtual_tryon_image",
      userId: input.job.userId,
      virtualTryonJobId: input.job.id,
      providerTaskId: input.taskId ?? null,
      requestSnapshot: sanitized.requestSnapshot,
      responseSummary: sanitized.responseSummary,
      status: input.status,
      errorCode: sanitized.errorCode,
    });
  } catch {
    // A failed audit write must not discard a provider task ID and trigger resubmission.
  }
}

export function createVirtualTryOnGenerationProvider(deps: VirtualTryOnGenerationProviderDeps) {
  const imageClient = deps.imageClient ?? createAPIMartImageGeneration;
  const pollClient = deps.pollClient ?? pollAPIMartImageTask;
  return {
    async submit(job: RuntimeJob, view: AppearanceView) {
      const modelKey = job.modelKeys[view];
      if (!modelKey) throw new Error("virtual_tryon_model_key_missing");
      const sourceKeys = sourceKeysFor(job);
      const priorKeys = priorGeneratedKeysFor(job, view);
      const prompt = promptFor(view);
      const imageUrls = await Promise.all([modelKey, ...priorKeys, ...sourceKeys].map((key) => deps.signer({ key, expiresIn: 300 })));
      try {
        const result = await imageClient({ prompt, imageUrls });
        await writeLog({ deps, job, view, imageCount: imageUrls.length, prompt, status: "succeeded", taskId: result.providerTaskId, providerStatus: "submitted" });
        return result.providerTaskId;
      } catch (error) {
        await writeLog({ deps, job, view, imageCount: imageUrls.length, prompt, status: "failed", providerStatus: "failed", errorCode: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "provider_error" });
        throw error;
      }
    },
    async poll(job: RuntimeJob, view: AppearanceView, taskId: string): Promise<{ status: RuntimeAsset["providerStatus"]; outputUrl: string | null }> {
      const prompt = promptFor(view);
      try {
        const result = await pollClient(taskId);
        await writeLog({ deps, job, view, imageCount: 0, prompt, status: "succeeded", taskId, providerStatus: result.status });
        return { status: result.status, outputUrl: result.outputUrl };
      } catch (error) {
        await writeLog({ deps, job, view, imageCount: 0, prompt, status: "failed", taskId, providerStatus: "failed", errorCode: error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "provider_error" });
        throw error;
      }
    },
  };
}
