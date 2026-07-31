export type VirtualTryOnMode = "front_only" | "three_view";
export type AppearanceView = "front" | "side" | "back";

export function requiredViewsFor(input: {
  mode: VirtualTryOnMode;
  frontAssetId: string | null;
  backAssetId: string | null;
  detailAssetId: string | null;
}): AppearanceView[] {
  if (input.mode === "front_only") {
    if (!input.frontAssetId) throw new Error("front_only_requires_front");
    return ["front"];
  }
  if (!input.frontAssetId || !input.backAssetId || !input.detailAssetId) {
    throw new Error("three_view_requires_front_back_detail");
  }
  return ["front", "side", "back"];
}

function positiveInteger(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("virtual_tryon_config_unavailable");
  return parsed;
}

export function getVirtualTryOnConfig(env: Record<string, string | undefined> = process.env) {
  const required = ["APIMART_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "VIRTUAL_TRYON_MODEL_FRONT_KEY", "VIRTUAL_TRYON_MODEL_SIDE_KEY", "VIRTUAL_TRYON_MODEL_BACK_KEY"];
  if (required.some((name) => !env[name]?.trim())) throw new Error("virtual_tryon_config_unavailable");
  return {
    frontOnlyCreditCost: positiveInteger(env.VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST),
    threeViewCreditCost: positiveInteger(env.VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST),
    modelKeys: { front: env.VIRTUAL_TRYON_MODEL_FRONT_KEY!, side: env.VIRTUAL_TRYON_MODEL_SIDE_KEY!, back: env.VIRTUAL_TRYON_MODEL_BACK_KEY! },
  };
}
