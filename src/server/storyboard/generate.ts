import { randomUUID } from "node:crypto";

import { getDb } from "@/lib/db/client";
import { storyboards } from "@/lib/db/schema";
import type { JsonValue } from "@/lib/db/schema/common";
import {
  createDeepSeekStoryboard,
  type DeepSeekStoryboardInput,
  type DeepSeekStoryboardResult,
} from "@/lib/providers/deepseek/client";
import {
  createDrizzleProviderCallLogStore,
  type ProviderCallLogStore,
} from "@/lib/providers/log-call";
import type { CreemPromptModerationResult } from "@/lib/providers/creem/moderation";
import type { ShotTemplateDefinition } from "@/lib/templates/types";
import { isVideoDuration, type VideoDuration } from "@/lib/video/specs";
import { validateTemplateSlots } from "@/lib/video/template-slots";
import type { VideoJobReadStore } from "@/server/jobs/get-job";
import { getVideoJobDetail } from "@/server/jobs/get-job";
import type { JobStore } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";
import { checkPrompt } from "@/server/moderation/check-prompt";
import {
  createDrizzleModerationResultStore,
  type ModerationResultStore,
} from "@/server/moderation/results";

import {
  assetFactsSnapshotFromAssets,
  buildGlobalHardConstraints,
} from "./global-constraints";
import { buildGlobalUserIntent } from "./global-intent";
import { parseStoryboardJson, type ParsedStoryboard } from "./schema";

export interface StoryboardRecord {
  id: string;
  videoJobId: string;
  version: number;
  status: string;
  selectedTemplateIds: JsonValue;
  presetId: string | null;
  presetSnapshot: JsonValue | null;
  storyboardJson: JsonValue;
  finalPromptSnapshot: JsonValue | null;
  providerCallLogId: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewStoryboardRecord {
  videoJobId: string;
  selectedTemplateIds: string[];
  presetId?: string | null;
  presetSnapshot?: JsonValue | null;
  storyboardJson: ParsedStoryboard;
  providerCallLogId?: string | null;
}

export interface StoryboardStore {
  createStoryboard(input: NewStoryboardRecord): Promise<StoryboardRecord>;
}

function toRecordInput(input: NewStoryboardRecord) {
  return {
    videoJobId: input.videoJobId,
    version: 1,
    status: "draft",
    selectedTemplateIds: input.selectedTemplateIds,
    presetId: input.presetId ?? null,
    presetSnapshot: input.presetSnapshot ?? null,
    storyboardJson: input.storyboardJson.raw,
    finalPromptSnapshot: null,
    providerCallLogId: input.providerCallLogId ?? null,
    confirmedAt: null,
  };
}

export function createInMemoryStoryboardStore(): StoryboardStore & {
  listStoryboards: () => StoryboardRecord[];
} {
  const records: StoryboardRecord[] = [];

  return {
    async createStoryboard(input) {
      const now = new Date();
      const record: StoryboardRecord = {
        id: randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...toRecordInput(input),
      };
      records.push(record);
      return record;
    },
    listStoryboards() {
      return records;
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleStoryboardStore(
  db: DbClient = getDb(),
): StoryboardStore {
  return {
    async createStoryboard(input) {
      const [record] = await db
        .insert(storyboards)
        .values(toRecordInput(input))
        .returning();

      if (!record) {
        throw new Error("Failed to create storyboard.");
      }

      return record as StoryboardRecord;
    },
  };
}

function assertSelectedTemplatesAvailable({
  selectedTemplateIds,
  availableTemplateIds,
}: {
  selectedTemplateIds: string[];
  availableTemplateIds: string[];
}) {
  if (selectedTemplateIds.length === 0) {
    throw new Error("At least one template must be selected.");
  }

  const available = new Set(availableTemplateIds);
  for (const templateId of selectedTemplateIds) {
    if (!available.has(templateId)) {
      throw new Error(
        `Selected template is not available for this job: ${templateId}.`,
      );
    }
  }
}

function systemPromptForStoryboard() {
  return [
    "You generate clothing product video storyboard JSON only.",
    "Never invent garment details that are not visible in the asset analysis.",
    "Use only the allowed shot_template_id values supplied by the user prompt.",
    "Do not create new template ids.",
  ].join("\n");
}

function userPromptForStoryboard({
  durationSeconds,
  selectedTemplateIds,
  availableTemplateIds,
  userPrompt,
  assetCompleteness,
  globalHardConstraints,
  globalUserIntent,
  presetSnapshot,
  templates,
}: {
  durationSeconds: number;
  selectedTemplateIds: string[];
  availableTemplateIds: string[];
  userPrompt: string;
  assetCompleteness: {
    hasFront: boolean;
    hasBack: boolean;
    hasSide: boolean;
    hasDetail: boolean;
    hasScene: boolean;
    hasModelFront: boolean;
    hasFlatLayOrWhiteBackground: boolean;
    detailTypes: string[];
  };
  globalHardConstraints: string[];
  globalUserIntent: ReturnType<typeof buildGlobalUserIntent>;
  presetSnapshot?: JsonValue | null;
  templates: ShotTemplateDefinition[];
}) {
  const templatesById = new Map(
    templates.map((template) => [template.templateId, template]),
  );

  return JSON.stringify({
    duration_seconds: durationSeconds,
    selected_template_ids: selectedTemplateIds,
    template_slots: selectedTemplateIds.map((templateId, index) => ({
      index,
      template_id: templateId,
    })),
    available_template_ids: availableTemplateIds,
    asset_summary: {
      has_front: assetCompleteness.hasFront,
      has_back: assetCompleteness.hasBack,
      has_side: assetCompleteness.hasSide,
      has_detail: assetCompleteness.hasDetail,
      has_scene: assetCompleteness.hasScene,
      has_model_front: assetCompleteness.hasModelFront,
      has_flat_lay_or_white_background:
        assetCompleteness.hasFlatLayOrWhiteBackground,
      detail_types: assetCompleteness.detailTypes,
      scene_usage: assetCompleteness.hasScene
        ? "background/reference only"
        : "not available",
    },
    selected_template_definitions: selectedTemplateIds.flatMap((templateId) => {
      const template = templatesById.get(templateId);
      if (!template) {
        return [];
      }

      return [
        {
          template_id: template.templateId,
          required_assets: template.requiredAssets,
          base_prompt_intent: template.basePromptIntent,
          system_constraints: template.systemConstraints,
        },
      ];
    }),
    style_preset: presetSnapshot
      ? {
          id: asJsonRecord(presetSnapshot).id ?? null,
          label: asJsonRecord(presetSnapshot).label ?? null,
          prompt_style_hint:
            asJsonRecord(presetSnapshot).promptStyleHint ?? null,
        }
      : null,
    global_hard_constraints: globalHardConstraints,
    global_user_intent: globalUserIntent,
    instructions: [
      "Return only segment prompts.",
      "Do not create, output, or rewrite global constraints.",
      "Every segment prompt must obey global_hard_constraints.",
      "Use only selected_template_ids as segment template_id values.",
      "Use template_slots in order; each segment template_id must match its slot.",
    ],
    user_prompt: userPrompt,
    output_schema: {
      duration_seconds: "number",
      segments: [
        {
          index: "number, zero-based",
          duration_seconds: 8,
          template_id: "must be one selected_template_ids value",
          prompt: "video generation prompt for this segment",
        },
      ],
    },
  });
}

function asJsonRecord(value: JsonValue): Record<string, JsonValue> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, JsonValue>;
}

function assertStoryboardPromptPolicy({
  parsed,
  hasBackAsset,
  hasDetailAsset,
  hasSceneAsset,
}: {
  parsed: ParsedStoryboard;
  hasBackAsset: boolean;
  hasDetailAsset: boolean;
  hasSceneAsset: boolean;
}) {
  const backViolation = /背面|后背|转身|360度|\b(back|rear)\s+(view|side|shot|display)|\bback\s+side\b|\bback\s+of\s+the\s+garment\b|\bfrom\s+behind\b|\brear(?:\s|-)?facing\b|\bturn(?:\s|-)?around\b|\b360\b|\bfront(?:\s|-)?to(?:\s|-)?back\b/i;
  const detailViolation = /细节特写|微距|面料特写|\bmacro\b|\bcloseup\b|\bdetail\s+close(?:\s|-)?up\b|\bclose(?:\s|-)?up\s+(?:detail|fabric|neckline|cuff|print)\b|\bzoom\s+in\s+on\s+fabric\b|\bfabric\s+macro\b|\bneckline\s+close(?:\s|-)?up\b|\bcuff\s+close(?:\s|-)?up\b|\bprint\s+close(?:\s|-)?up\b/i;
  const sceneViolation = /上传.*(场景|背景)|(场景|背景).*(参考|图片|素材)|\b(uploaded|provided)\s+(scene|background)\s+(reference|image|asset)\b|\bscene\/background\s+reference\b/i;

  const violatesPolicy = parsed.segments.some((segment) => {
    if (!hasBackAsset && backViolation.test(segment.prompt)) {
      return true;
    }

    if (!hasDetailAsset && detailViolation.test(segment.prompt)) {
      return true;
    }

    if (!hasSceneAsset && sceneViolation.test(segment.prompt)) {
      return true;
    }

    return false;
  });

  if (violatesPolicy) {
    throw new Error("Storyboard prompt violates global hard constraints.");
  }
}

export async function generateStoryboardDraft({
  jobReadStore,
  jobStore,
  storyboardStore = createDrizzleStoryboardStore(),
  providerCallLogStore = createDrizzleProviderCallLogStore(),
  moderationResultStore = createDrizzleModerationResultStore(),
  jobId,
  userId,
  selectedTemplateIds,
  userPrompt,
  templates,
  moderatePrompt,
  createStoryboard = createDeepSeekStoryboard,
}: {
  jobReadStore: VideoJobReadStore;
  jobStore: JobStore;
  storyboardStore?: StoryboardStore;
  providerCallLogStore?: ProviderCallLogStore;
  moderationResultStore?: ModerationResultStore;
  jobId: string;
  userId: string;
  selectedTemplateIds: string[];
  userPrompt: string;
  templates: ShotTemplateDefinition[];
  moderatePrompt?: (input: {
    prompt: string;
    externalId?: string;
  }) => Promise<CreemPromptModerationResult>;
  createStoryboard?: (
    input: DeepSeekStoryboardInput,
  ) => Promise<DeepSeekStoryboardResult>;
}) {
  const detail = await getVideoJobDetail({
    store: jobReadStore,
    jobId,
    userId,
    templates,
  });

  if (!detail) {
    throw new Error("Video job not found for user.");
  }

  assertSelectedTemplatesAvailable({
    selectedTemplateIds,
    availableTemplateIds: detail.recommendations.availableTemplateIds,
  });

  if (!isVideoDuration(detail.job.durationSeconds)) {
    throw new Error("Unsupported video duration.");
  }
  const highRiskTemplateIds = templates
    .filter(
      (template) =>
        template.riskLevel === "medium_high" ||
        template.riskLevel === "high",
    )
    .map((template) => template.templateId);
  const slotReasons = validateTemplateSlots({
    durationSeconds: detail.job.durationSeconds as VideoDuration,
    templateIds: selectedTemplateIds,
    highRiskTemplateIds,
  });
  if (slotReasons.length > 0) {
    throw new Error(`Invalid template slots: ${slotReasons.join(",")}.`);
  }

  const moderation = await checkPrompt(
    {
      userId,
      videoJobId: jobId,
      source: "user_input",
      prompt: userPrompt,
      externalId: `storyboard:${jobId}:user_input`,
    },
    {
      resultStore: moderationResultStore,
      moderatePrompt,
    },
  );

  if (!moderation.allowed) {
    if (moderation.decision === "error") {
      throw new Error("Prompt moderation unavailable for storyboard generation.");
    }

    throw new Error("Prompt moderation blocked storyboard generation.");
  }

  const startedAt = Date.now();
  const systemPrompt = systemPromptForStoryboard();
  const assetFactsSnapshot = assetFactsSnapshotFromAssets(
    detail.assets.map((asset) => ({ role: asset.role })),
  );
  const globalHardConstraints = buildGlobalHardConstraints({
    hasBackAsset: detail.assetCompleteness.hasBack,
    hasDetailAsset: detail.assetCompleteness.hasDetail,
    hasSceneAsset: detail.assetCompleteness.hasScene,
  });

  const globalUserIntent = buildGlobalUserIntent({
    userPrompt,
    hasDetailAsset: detail.assetCompleteness.hasDetail,
  });
  const deepSeekUserPrompt = userPromptForStoryboard({
    durationSeconds: detail.job.durationSeconds,
    selectedTemplateIds,
    availableTemplateIds: detail.recommendations.availableTemplateIds,
    userPrompt,
    assetCompleteness: detail.assetCompleteness,
    globalHardConstraints,
    globalUserIntent,
    presetSnapshot: detail.job.presetSnapshot,
    templates,
  });

  let providerResult: DeepSeekStoryboardResult;

  try {
    providerResult = await createStoryboard({
      systemPrompt,
      userPrompt: deepSeekUserPrompt,
    });
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: "deepseek",
      model: "unknown",
      purpose: "storyboard",
      userId,
      videoJobId: jobId,
      requestSnapshot: {
        durationSeconds: detail.job.durationSeconds,
        selectedTemplateIds,
      },
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode: "storyboard_generation_error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  let parsed: ParsedStoryboard;

  try {
    parsed = parseStoryboardJson(providerResult.storyboardJson, {
      durationSeconds: detail.job.durationSeconds,
      allowedTemplateIds: selectedTemplateIds,
      selectedTemplateIds,
    });
    assertStoryboardPromptPolicy({
      parsed,
      hasBackAsset: detail.assetCompleteness.hasBack,
      hasDetailAsset: detail.assetCompleteness.hasDetail,
      hasSceneAsset: detail.assetCompleteness.hasScene,
    });
  } catch (error) {
    await providerCallLogStore.createCallLog({
      provider: providerResult.provider,
      model: providerResult.model,
      purpose: "storyboard",
      userId,
      videoJobId: jobId,
      requestSnapshot: {
        durationSeconds: detail.job.durationSeconds,
        selectedTemplateIds,
      },
      responseSummary: providerResult.storyboardJson,
      durationMs: Date.now() - startedAt,
      status: "failed",
      errorCode:
        error instanceof Error &&
        error.message === "Storyboard prompt violates global hard constraints."
          ? "storyboard_policy_error"
          : "storyboard_schema_error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

  parsed = {
    ...parsed,
    raw: {
      ...asJsonRecord(parsed.raw),
      globalHardConstraints,
      globalUserIntent: globalUserIntent as unknown as JsonValue,
      assetFactsSnapshot,
    },
  };

  const callLog = await providerCallLogStore.createCallLog({
    provider: providerResult.provider,
    model: providerResult.model,
    purpose: "storyboard",
    userId,
    videoJobId: jobId,
    requestSnapshot: {
      durationSeconds: detail.job.durationSeconds,
      selectedTemplateIds,
    },
    responseSummary: {
      segmentCount: parsed.segments.length,
      templateIds: parsed.segments.map((segment) => segment.templateId),
    },
    durationMs: Date.now() - startedAt,
    status: "succeeded",
  });
  const storyboard = await storyboardStore.createStoryboard({
    videoJobId: jobId,
    selectedTemplateIds,
    presetId: detail.job.presetId,
    presetSnapshot: detail.job.presetSnapshot,
    storyboardJson: parsed,
    providerCallLogId: callLog.id,
  });

  await transitionJobStatus({
    store: jobStore,
    jobId,
    toStatus: "storyboard_draft_ready",
    reason: "storyboard_generated",
    eventSnapshot: {
      storyboardId: storyboard.id,
      selectedTemplateIds,
    },
  });

  return {
    storyboard,
    parsed,
    providerCallLog: callLog,
  };
}
