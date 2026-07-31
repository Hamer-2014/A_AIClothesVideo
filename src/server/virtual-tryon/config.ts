import { canUseDevBypass, getPromptModerationMode } from "@/server/moderation/mode";

const visionProviders = new Set(["openai", "apimart", "evolink", "custom"]);

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
  const required = ["APIMART_API_KEY", "CLOUDFLARE_R2_ACCOUNT_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_BUCKET", "VIRTUAL_TRYON_MODEL_FRONT_KEY", "VIRTUAL_TRYON_MODEL_SIDE_KEY", "VIRTUAL_TRYON_MODEL_BACK_KEY", "VISION_PROVIDER", "VISION_API_KEY", "VISION_MODEL_STRICT"];
  if (required.some((name) => !env[name]?.trim())) throw new Error("virtual_tryon_config_unavailable");
  if (!visionProviders.has(env.VISION_PROVIDER!)) throw new Error("virtual_tryon_config_unavailable");
  if (env.VISION_PROVIDER !== "openai" && !env.VISION_BASE_URL?.trim()) throw new Error("virtual_tryon_config_unavailable");
  const moderationMode = getPromptModerationMode(env);
  if (moderationMode === "creem" && !env.CREEM_MODERATION_API_KEY?.trim()) throw new Error("virtual_tryon_config_unavailable");
  if (moderationMode === "creem" && env.APP_ENV?.trim().toLowerCase() === "production" && (!env.CREEM_MODERATION_API_KEY!.startsWith("creem_") || env.CREEM_MODERATION_API_KEY!.startsWith("creem_test_"))) throw new Error("virtual_tryon_config_unavailable");
  if ((moderationMode === "off" || moderationMode === "dev_bypass") && !canUseDevBypass(env)) throw new Error("virtual_tryon_config_unavailable");
  return {
    frontOnlyCreditCost: positiveInteger(env.VIRTUAL_TRYON_FRONT_ONLY_CREDIT_COST),
    threeViewCreditCost: positiveInteger(env.VIRTUAL_TRYON_THREE_VIEW_CREDIT_COST),
    modelKeys: { front: env.VIRTUAL_TRYON_MODEL_FRONT_KEY!, side: env.VIRTUAL_TRYON_MODEL_SIDE_KEY!, back: env.VIRTUAL_TRYON_MODEL_BACK_KEY! },
  };
}

export type VirtualTryOnPublicConfig = { available: boolean; frontOnlyCreditCost: number | null; threeViewCreditCost: number | null };

export function getVirtualTryOnPublicConfig(env: Record<string, string | undefined> = process.env): VirtualTryOnPublicConfig {
  try {
    const config = getVirtualTryOnConfig(env);
    return { available: true, frontOnlyCreditCost: config.frontOnlyCreditCost, threeViewCreditCost: config.threeViewCreditCost };
  } catch {
    return { available: false, frontOnlyCreditCost: null, threeViewCreditCost: null };
  }
}
