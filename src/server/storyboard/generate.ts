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
import type { VideoJobReadStore } from "@/server/jobs/get-job";
import { getVideoJobDetail } from "@/server/jobs/get-job";
import type { JobStore } from "@/server/jobs/state-machine";
import { transitionJobStatus } from "@/server/jobs/state-machine";
import { checkPrompt } from "@/server/moderation/check-prompt";
import {
  createDrizzleModerationResultStore,
  type ModerationResultStore,
} from "@/server/moderation/results";

import { parseStoryboardJson, type ParsedStoryboard } from "./schema";

export interface StoryboardRecord {
  id: string;
  videoJobId: string;
  version: number;
  status: string;
  selectedTemplateIds: JsonValue;
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
}: {
  durationSeconds: number;
  selectedTemplateIds: string[];
  availableTemplateIds: string[];
  userPrompt: string;
}) {
  return JSON.stringify({
    duration_seconds: durationSeconds,
    selected_template_ids: selectedTemplateIds,
    available_template_ids: availableTemplateIds,
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
  isTrial,
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
  isTrial: boolean;
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
    isTrial,
  });

  if (!detail) {
    throw new Error("Video job not found for user.");
  }

  assertSelectedTemplatesAvailable({
    selectedTemplateIds,
    availableTemplateIds: detail.recommendations.availableTemplateIds,
  });

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
    throw new Error("Prompt moderation blocked storyboard generation.");
  }

  const startedAt = Date.now();
  const systemPrompt = systemPromptForStoryboard();
  const deepSeekUserPrompt = userPromptForStoryboard({
    durationSeconds: detail.job.durationSeconds,
    selectedTemplateIds,
    availableTemplateIds: detail.recommendations.availableTemplateIds,
    userPrompt,
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
      allowedTemplateIds: detail.recommendations.availableTemplateIds,
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
      errorCode: "storyboard_schema_error",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }

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
