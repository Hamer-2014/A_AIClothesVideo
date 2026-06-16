import type { StylePreset, StylePresetId } from "./types";

export const defaultStylePresetId: StylePresetId = "minimal_studio";

export const stylePresets: StylePreset[] = [
  {
    id: "minimal_studio",
    label: "极简棚拍",
    shortDescription: "干净背景，突出服装版型，适合商品页展示。",
    defaultIntent: "突出服装版型和整体轮廓，使用干净背景和稳定镜头，避免夸张动作。",
    promptStyleHint:
      "clean studio product video, neutral background, stable garment shape, restrained camera movement",
    preferredTemplateIds: [
      "minimal_studio",
      "front_push_in",
      "front_pan",
      "front_crop_detail",
    ],
    discouragedTemplateIds: ["front_to_back_cut", "model_front_pose"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16, 24],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "low",
  },
  {
    id: "marketplace_clean",
    label: "电商主图动效",
    shortDescription: "适合白底图和平铺图，把静态商品图做成干净动效。",
    defaultIntent: "突出商品主图可售卖感，保持背景干净，优先展示正面轮廓和可见细节。",
    promptStyleHint:
      "clean ecommerce product motion, marketplace-ready, stable garment shape, no invented details",
    preferredTemplateIds: [
      "product_float",
      "front_pan",
      "front_crop_detail",
      "front_push_in",
    ],
    discouragedTemplateIds: ["model_front_pose", "front_to_back_cut", "back_display"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16, 24],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "low",
  },
  {
    id: "social_lifestyle",
    label: "社媒氛围短片",
    shortDescription: "适合 TikTok/Reels 测款，偏轻氛围但不编造强场景。",
    defaultIntent:
      "做成适合社媒测款的轻氛围短片，保持服装真实，不生成素材中不存在的场景、背面或细节。",
    promptStyleHint:
      "social short-form product video, subtle lifestyle mood, no strong invented scene, preserve garment identity",
    preferredTemplateIds: [
      "minimal_studio",
      "front_push_in",
      "front_pan",
      "model_front_pose",
    ],
    discouragedTemplateIds: ["front_to_back_cut", "back_display"],
    trialAllowed: true,
    allowedDurationSeconds: [8, 16],
    defaultDurationSeconds: 8,
    defaultAspectRatio: "9:16",
    riskLevel: "medium",
  },
];
