import { createHash } from "node:crypto";
import type { ProviderCallLogStore } from "@/lib/providers/log-call";
import { createVisionVirtualTryOnQa, type VisionVirtualTryOnQaResult } from "@/lib/providers/vision/client";
import type { AppearanceView, VirtualTryOnMode } from "./config";
import { isStrictCrossViewQaPass, isStrictViewQaPass, parseStrictCrossViewQa, parseStrictViewQa } from "./qa-schema";
import type { VirtualTryOnQaStore } from "./qa-store";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export class VirtualTryOnQaLeaseLostError extends Error {
  readonly code = "virtual_tryon_qa_lease_lost";

  constructor() {
    super("virtual_tryon_qa_lease_lost");
    this.name = "VirtualTryOnQaLeaseLostError";
  }
}

type VirtualTryOnQaDeps = {
  signer: (key: string) => Promise<string>;
  visionProvider?: (input: Parameters<typeof createVisionVirtualTryOnQa>[0]) => Promise<VisionVirtualTryOnQaResult>;
  renewLease?: () => Promise<boolean>;
  qaStore: VirtualTryOnQaStore;
  providerLogStore: ProviderCallLogStore;
};

async function requireQaLease(deps: VirtualTryOnQaDeps) {
  if (deps.renewLease && !await deps.renewLease()) {
    throw new VirtualTryOnQaLeaseLostError();
  }
}

function rethrowLeaseLoss(error: unknown) {
  if (error instanceof VirtualTryOnQaLeaseLostError) throw error;
}

type QaFailurePhase = "input" | "signing" | "provider" | "schema" | "persistence";

function errorField(error: unknown, field: "provider" | "model" | "code") {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorStatus(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as { status?: unknown }).status;
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function failureLogContext(error: unknown, phase: QaFailurePhase, provider: string, model: string) {
  const providerErrorCode = errorField(error, "code")
    ?? (error instanceof Error && /^[a-z0-9_-]{1,80}$/i.test(error.message) ? error.message : "unknown_error");
  const httpStatus = errorStatus(error);
  return {
    provider: errorField(error, "provider") ?? provider,
    model: errorField(error, "model") ?? model,
    errorCode: `virtual_tryon_qa_${phase}_failed`,
    responseSummary: {
      verdict: "unknown",
      status: "failed",
      providerErrorCode,
      ...(httpStatus === undefined ? {} : { httpStatus }),
    },
  };
}

export async function runVirtualTryOnQa(
  input: {
    jobId: string;
    userId: string;
    packId: string;
    mode: VirtualTryOnMode;
    sourceKeys: { front: string; back?: string; detail?: string };
    modelKeys: Record<AppearanceView, string>;
    generatedKeys: Partial<Record<AppearanceView, string>>;
  },
  deps: VirtualTryOnQaDeps,
) {
  const views: AppearanceView[] = input.mode === "front_only" ? ["front"] : ["front", "side", "back"];
  const verdicts: Record<string, string> = {};
  let allPassed = true;

  for (const view of views) {
    let phase: QaFailurePhase = "input";
    let imageCount = 0;
    let providerName = "vision";
    let modelName = "strict";
    try {
      const generated = input.generatedKeys[view];
      const model = input.modelKeys[view];
      if (!generated || !model) throw new Error("model_or_generated_view_missing");
      const keys = [model, input.sourceKeys.front, ...(input.sourceKeys.back ? [input.sourceKeys.back] : []), ...(input.sourceKeys.detail ? [input.sourceKeys.detail] : []), generated];
      imageCount = keys.length;
      phase = "signing";
      const urls = await Promise.all(keys.map(deps.signer));
      await requireQaLease(deps);
      phase = "provider";
      const result = await (deps.visionProvider ?? createVisionVirtualTryOnQa)({
        kind: "view",
        imageUrls: urls,
        targetView: view,
        requirements: [
          "ordered images: platform model reference, garment front, garment back if present, garment detail if present, generated target view",
          "compare generated identityConsistency only with the first platform model reference",
          "compare garment fields only with garment references",
          "use unknown when evidence is unavailable",
        ],
      });
      providerName = result.provider;
      modelName = result.model;
      await requireQaLease(deps);
      phase = "schema";
      const qa = parseStrictViewQa(result.qaJson);
      verdicts[view] = qa.verdict;
      allPassed &&= isStrictViewQaPass(qa, view);
      phase = "persistence";
      await deps.qaStore.upsertViewResult(input.packId, view, qa);
      await deps.providerLogStore.createCallLog({
        provider: result.provider,
        model: result.model,
        purpose: "virtual_tryon_qa",
        userId: input.userId,
        virtualTryonJobId: input.jobId,
        requestSnapshot: { scope: "view", view, imageCount: urls.length, promptHash: hash(view) },
        responseSummary: { verdict: qa.verdict, status: "completed" },
        status: "succeeded",
      });
    } catch (error) {
      rethrowLeaseLoss(error);
      await requireQaLease(deps);
      const failure = failureLogContext(error, phase, providerName, modelName);
      verdicts[view] = "unknown";
      allPassed = false;
      await deps.qaStore.upsertViewResult(input.packId, view, { verdict: "unknown" });
      await deps.providerLogStore.createCallLog({
        provider: failure.provider,
        model: failure.model,
        purpose: "virtual_tryon_qa",
        userId: input.userId,
        virtualTryonJobId: input.jobId,
        requestSnapshot: { scope: "view", view, imageCount, failurePhase: phase, promptHash: hash(view) },
        responseSummary: failure.responseSummary,
        status: "failed",
        errorCode: failure.errorCode,
        errorMessage: "Virtual try-on QA failed.",
      });
    }
  }

  let crossVerdict: string | null = null;
  if (input.mode === "three_view") {
    let phase: QaFailurePhase = "input";
    let imageCount = 0;
    let providerName = "vision";
    let modelName = "strict";
    try {
      imageCount = views.length;
      phase = "signing";
      const urls = await Promise.all(views.map((view) => {
        const key = input.generatedKeys[view];
        if (!key) throw new Error("generated_view_missing");
        return deps.signer(key);
      }));
      await requireQaLease(deps);
      phase = "provider";
      const result = await (deps.visionProvider ?? createVisionVirtualTryOnQa)({
        kind: "cross",
        imageUrls: urls,
        requiredViews: views,
        requirements: ["cross view consistency"],
      });
      providerName = result.provider;
      modelName = result.model;
      await requireQaLease(deps);
      phase = "schema";
      const qa = parseStrictCrossViewQa(result.qaJson);
      crossVerdict = qa.verdict;
      allPassed &&= isStrictCrossViewQaPass(qa, views);
      phase = "persistence";
      await deps.qaStore.upsertCrossResult(input.packId, qa);
      await deps.providerLogStore.createCallLog({
        provider: result.provider,
        model: result.model,
        purpose: "virtual_tryon_qa",
        userId: input.userId,
        virtualTryonJobId: input.jobId,
        requestSnapshot: { scope: "cross", imageCount: urls.length, promptHash: hash("front,side,back") },
        responseSummary: { verdict: qa.verdict, status: "completed" },
        status: "succeeded",
      });
    } catch (error) {
      rethrowLeaseLoss(error);
      await requireQaLease(deps);
      const failure = failureLogContext(error, phase, providerName, modelName);
      crossVerdict = "unknown";
      allPassed = false;
      await deps.qaStore.upsertCrossResult(input.packId, { verdict: "unknown" });
      await deps.providerLogStore.createCallLog({
        provider: failure.provider,
        model: failure.model,
        purpose: "virtual_tryon_qa",
        userId: input.userId,
        virtualTryonJobId: input.jobId,
        requestSnapshot: { scope: "cross", imageCount, failurePhase: phase, promptHash: hash("front,side,back") },
        responseSummary: failure.responseSummary,
        status: "failed",
        errorCode: failure.errorCode,
        errorMessage: "Virtual try-on QA failed.",
      });
    }
  }

  const summary = { allPassed, views: verdicts, crossVerdict };
  await deps.qaStore.updateQaSummary(input.packId, summary);
  return summary;
}
