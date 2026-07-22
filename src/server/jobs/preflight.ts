import { mvpShotTemplates } from "@/lib/templates/catalog";
import { recommendShotTemplates } from "@/lib/templates/recommend";
import type { AssetCompleteness } from "@/lib/templates/rules";
import {
  getStylePreset,
  rankTemplatesForPreset,
  selectTemplateIdsForPreset,
} from "@/lib/presets";
import {
  getVideoSpec,
  isVideoDuration,
  isVideoDurationEnabled,
} from "@/lib/video/specs";
import type { AssetRole, VideoJobCreationStore } from "./create-job";
import {
  getCaptureProtocol,
  type CaptureProtocolId,
  type CaptureProtocolSlotRole,
} from "@/lib/video/capture-protocols";

export interface JobPreflightReason {
  code: string;
  message: string;
}

export interface JobPreflightResult {
  canCreateJob: boolean;
  requiredAssetRoles: AssetRole[];
  uploadedAssetRoles: AssetRole[];
  blockingReasons: JobPreflightReason[];
  warnings: JobPreflightReason[];
  recommendedTemplateIds: string[];
  missingRightsAttestationAssetIds: string[];
}

export interface JobPreflightInput {
  store: Pick<VideoJobCreationStore, "findOwnedAssets">;
  userId: string;
  assetIds: string[];
  durationSeconds: number;
  aspectRatio: string;
  presetId?: string | null;
  captureProtocol?: CaptureProtocolId | null;
  useFreeTrialIfAvailable?: boolean;
  videoSpecEnv?: Record<string, string | undefined>;
}

const allowedAspectRatios = new Set(["9:16", "1:1", "16:9"]);

function isAssetRole(value: string | null): value is AssetRole {
  return (
    value === "front" ||
    value === "back" ||
    value === "side" ||
    value === "detail" ||
    value === "scene" ||
    value === "logo" ||
    value === "unknown"
  );
}

function uniqueRoles(roles: AssetRole[]) {
  return Array.from(new Set(roles));
}

function completenessFromRoles(roles: AssetRole[]): AssetCompleteness {
  return {
    hasFront: roles.includes("front"),
    hasBack: roles.includes("back"),
    hasSide: roles.includes("side"),
    hasDetail: roles.includes("detail"),
    hasScene: roles.includes("scene"),
    hasModelFront: false,
    hasModelSide: false,
    hasModelBack: false,
    hasFlatLayOrWhiteBackground: roles.includes("front"),
    hasProductFront: false,
    hasProductSide: false,
    hasProductBack: false,
    garmentConsistency: "unknown",
    modelGarmentConsistency: "unknown",
    modelConsistency: "unknown",
    detailTypes: [],
  };
}

function emptyPreflight(
  blockingReasons: JobPreflightReason[],
  requiredAssetRoles: AssetRole[] = ["front"],
): JobPreflightResult {
  return {
    canCreateJob: false,
    requiredAssetRoles,
    uploadedAssetRoles: [],
    blockingReasons,
    warnings: [],
    recommendedTemplateIds: [],
    missingRightsAttestationAssetIds: [],
  };
}

function missingProtocolRoleReason(
  role: CaptureProtocolSlotRole,
  protocolLabel: string,
): JobPreflightReason {
  const labels: Record<CaptureProtocolSlotRole, string> = {
    front: "正面图",
    back: "背面图",
    side: "侧面图",
    detail: "细节图",
  };

  return {
    code: `${role}_asset_required`,
    message: `${protocolLabel}还需要一张${labels[role]}。`,
  };
}

export async function preflightVideoJob({
  store,
  userId,
  assetIds,
  durationSeconds,
  aspectRatio,
  presetId,
  captureProtocol,
  useFreeTrialIfAvailable,
  videoSpecEnv = process.env,
}: JobPreflightInput): Promise<JobPreflightResult> {
  const uniqueAssetIds = Array.from(new Set(assetIds));
  const blockingReasons: JobPreflightReason[] = [];
  const warnings: JobPreflightReason[] = [];
  const protocol = getCaptureProtocol(captureProtocol);
  const enforceCaptureProtocol = captureProtocol != null;
  const requiredAssetRoles: AssetRole[] = enforceCaptureProtocol
    ? protocol.slots.map((slot) => slot.role)
    : ["front"];

  if (uniqueAssetIds.length === 0) {
    return emptyPreflight([
      {
        code: "asset_required",
        message: "至少需要上传一张服装正面图。",
      },
    ], requiredAssetRoles);
  }

  if (enforceCaptureProtocol && uniqueAssetIds.length !== protocol.slots.length) {
    blockingReasons.push({
      code: "asset_count_mismatch",
      message: "请选择当前生成方式要求的 3 张图片。",
    });
  }

  if (!isVideoDuration(durationSeconds)) {
    return emptyPreflight([
      {
        code: "unsupported_duration",
        message: "暂不支持该视频时长。",
      },
    ]);
  }
  const videoSpec = getVideoSpec(durationSeconds);

  if (!isVideoDurationEnabled(durationSeconds, videoSpecEnv)) {
    blockingReasons.push({
      code: "duration_beta_disabled",
      message: "40 秒付费 Beta 暂未开放。",
    });
  }

  if (!allowedAspectRatios.has(aspectRatio)) {
    return emptyPreflight([
      {
        code: "unsupported_aspect_ratio",
        message: "暂不支持该视频比例。",
      },
    ]);
  }

  const ownedAssets = await store.findOwnedAssets({
    userId,
    assetIds: uniqueAssetIds,
  });

  if (ownedAssets.length !== uniqueAssetIds.length) {
    blockingReasons.push({
      code: "asset_not_found",
      message: "部分素材不存在或不属于当前用户。",
    });
  }

  if (ownedAssets.some((asset) => asset.status !== "uploaded")) {
    blockingReasons.push({
      code: "asset_not_uploaded",
      message: "请等待图片上传完成后再生成。",
    });
  }

  const missingRightsAttestationAssetIds = ownedAssets
    .filter((asset) => !asset.rightsAttested || !asset.rightsAttestationId)
    .map((asset) => asset.id);
  if (missingRightsAttestationAssetIds.length > 0) {
    blockingReasons.push({
      code: "rights_attestation_required",
      message: "请先确认所选素材的版权、肖像与商业使用授权。",
    });
  }

  const uploadedAssetRoles = uniqueRoles(
    ownedAssets
      .filter((asset) => asset.status === "uploaded")
      .map((asset) => asset.detectedRole)
      .filter(isAssetRole),
  );

  for (const requiredRole of requiredAssetRoles) {
    if (uploadedAssetRoles.includes(requiredRole)) {
      continue;
    }
    blockingReasons.push(
      enforceCaptureProtocol
        ? missingProtocolRoleReason(
            requiredRole as CaptureProtocolSlotRole,
            protocol.label,
          )
        : {
            code: "front_asset_required",
            message: "至少需要上传一张服装正面图。",
          },
    );
  }

  if (useFreeTrialIfAvailable === true && !videoSpec.trialAllowed) {
    blockingReasons.push({
      code: "free_trial_duration_unsupported",
      message: "免费试用仅支持 8 秒视频。",
    });
  }

  if (presetId === "marketplace_clean" && uploadedAssetRoles.includes("scene")) {
    warnings.push({
      code: "scene_reference_only",
      message: "场景图仅作为背景、灯光和氛围参考，不会作为服装细节依据。",
    });
  }

  const preset = getStylePreset(presetId);
  const isTrial =
    useFreeTrialIfAvailable === true && videoSpec.trialAllowed;
  const recommendations = rankTemplatesForPreset({
    recommendations: recommendShotTemplates({
      templates: mvpShotTemplates,
      assetCompleteness: completenessFromRoles(uploadedAssetRoles),
      isTrial,
    }),
    preset,
  });
  const recommendedTemplateIds = selectTemplateIdsForPreset({
    recommendations,
    preset,
    durationSeconds,
  });

  if (
    blockingReasons.length === 0 &&
    recommendedTemplateIds.length < videoSpec.segmentCount
  ) {
    blockingReasons.push({
      code: "not_enough_templates",
      message: `${durationSeconds} 秒视频需要至少 ${videoSpec.segmentCount} 个可用镜头模板，请补充对应素材。`,
    });
  }

  return {
    canCreateJob: blockingReasons.length === 0,
    requiredAssetRoles,
    uploadedAssetRoles,
    blockingReasons,
    warnings,
    recommendedTemplateIds,
    missingRightsAttestationAssetIds,
  };
}
