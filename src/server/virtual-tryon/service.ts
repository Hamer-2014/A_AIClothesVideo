import type { VirtualTryOnMode } from "./config";

type AppearanceView = "front" | "side" | "back";
type R2Keys = Partial<Record<AppearanceView, string>>;

export async function finalizeAppearancePack(input: {
  jobId: string;
  packId: string;
  mode: VirtualTryOnMode;
  r2Keys: R2Keys;
  viewPasses: boolean[];
  crossViewPass: boolean;
}, deps: { capture: (input: { idempotencyKey: string }) => Promise<void> }) {
  const requiredViews: AppearanceView[] = input.mode === "front_only" ? ["front"] : ["front", "side", "back"];
  if (!requiredViews.every((view) => Boolean(input.r2Keys[view])) || input.viewPasses.length !== requiredViews.length || !input.viewPasses.every(Boolean) || (input.mode === "three_view" && !input.crossViewPass)) {
    throw new Error("strict_qa_not_passed");
  }
  await deps.capture({ idempotencyKey: "virtual-tryon:" + input.jobId + ":capture" });
  return {
    kind: "virtual_tryon_appearance_pack" as const,
    appearancePackId: input.packId,
    mode: input.mode,
    assetKeys: input.r2Keys,
    provenance: "generated_apimart_gpt_image_2" as const,
    videoGeneration: "not_enabled" as const,
  };
}
