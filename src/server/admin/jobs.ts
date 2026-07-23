import { desc, eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import {
  adminJobNotes,
  assets,
  assetAnalyses,
  assetConsistencyAnalyses,
  creditLedger,
  jobStateEvents,
  postQaResults,
  promptModerationResults,
  providerCallLogs,
  stitchJobs,
  storyboards,
  videoJobAssets,
  videoJobs,
  videoSegments,
} from "@/lib/db/schema";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

type AdminCreditLedgerType =
  | "purchase"
  | "trial_grant"
  | "reserve"
  | "capture"
  | "release"
  | "refund"
  | "purchase_reversal"
  | "admin_adjust";

export interface AdminJobRecord {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  durationSeconds: number;
  aspectRatio: string;
  billingMode?: string;
  creditCost: number;
  presetId: string | null;
  presetSnapshot: unknown;
  trialEligibilitySnapshot: unknown;
  reservedLedgerId: string | null;
  finalVideoKey: string | null;
  coverKey: string | null;
  isTest: boolean;
  failureReason: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminSegmentRecord {
  id: string;
  videoJobId: string;
  segmentIndex: number;
  status: string;
  templateId: string;
  provider: string | null;
  model: string | null;
  providerTaskId: string | null;
  videoKey: string | null;
  prompt: string;
  lastError: string | null;
  attemptCount: number;
}

export interface AdminAssetRecord {
  videoJobId: string;
  assetId: string;
  role: string;
  sortOrder: number;
  fileName?: string;
  originalKey?: string;
  detectedRole?: string | null;
}

export interface AdminAnalysisRecord {
  videoJobId: string;
  assetId: string;
  analysisJson: unknown;
  mode?: string;
}

export interface AdminStoryboardRecord {
  id: string;
  videoJobId: string;
  status: string;
  presetId: string | null;
  presetSnapshot: unknown;
  selectedTemplateIds: unknown;
  storyboardJson: unknown;
  finalPromptSnapshot?: unknown;
  createdAt: Date;
}

export interface AdminProviderLogRecord {
  id: string;
  videoJobId: string | null;
  segmentId: string | null;
  purpose: string;
  provider: string;
  modelRouteId: string | null;
  routeSnapshot: unknown;
  model: string;
  status: string;
  durationMs: number | null;
  costEstimate: string | null;
  fallbackReason: string | null;
  responseSummary: unknown;
  providerTaskId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AdminModerationResultRecord {
  id: string;
  videoJobId: string | null;
  segmentId: string | null;
  source: string;
  decision: string;
  provider: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: Date;
}

export interface AdminLedgerRecord {
  id: string;
  userId: string;
  relatedJobId: string | null;
  type: AdminCreditLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reason: string;
  idempotencyKey: string;
  createdAt: Date;
}

export interface AdminStitchJobRecord {
  id: string;
  videoJobId: string;
  status: string;
  segmentKeys: unknown;
  finalVideoKey: string | null;
  coverKey: string | null;
  frameKeys: unknown;
  lastError: string | null;
  createdAt?: Date;
}

export interface AdminPostQaRecord {
  id: string;
  videoJobId: string;
  status: string;
  mode: string;
  failureCategory: string | null;
  frameKeys: unknown;
  resultJson: unknown;
  createdAt: Date;
}

export interface AdminStateEventRecord {
  id: string;
  videoJobId: string;
  segmentId: string | null;
  fromStatus: string | null;
  toStatus: string;
  reason: string | null;
  actorType: string;
  actorId: string | null;
  eventSnapshot: unknown;
  createdAt: Date;
}

export interface AdminConsistencyAnalysisRecord {
  videoJobId: string;
  analysisKind: string;
  status: string;
  garmentMatch: string;
  modelMatch: string;
  colorMatch: boolean;
  patternMatch: boolean;
  viewCoverage: unknown;
  confidence: string | null;
  riskFlags: unknown;
  resultJson: unknown;
}

export interface AdminJobNoteRecord {
  id: string;
  jobId: string;
  adminUserId: string;
  note: string;
  createdAt: Date;
}

export interface AdminJobDiagnosis {
  kind:
    | "deliverable"
    | "post_qa_stalled"
    | "segment_failed"
    | "stitch_failed"
    | "moderation_blocked"
    | "credits_need_attention"
    | "in_progress";
  severity: "info" | "warning" | "critical";
  title: string;
  recommendation: string;
  needsManualAction: boolean;
}

export interface AdminJobStore {
  findJob(jobId: string): Promise<AdminJobRecord | null>;
  listAssets(jobId: string): Promise<AdminAssetRecord[]>;
  listAnalyses(jobId: string): Promise<AdminAnalysisRecord[]>;
  listConsistencyAnalyses(jobId: string): Promise<AdminConsistencyAnalysisRecord[]>;
  findLatestStoryboard(jobId: string): Promise<AdminStoryboardRecord | null>;
  listSegments(jobId: string): Promise<AdminSegmentRecord[]>;
  listProviderLogs(jobId: string): Promise<AdminProviderLogRecord[]>;
  listModerationResults(jobId: string): Promise<AdminModerationResultRecord[]>;
  listLedger(jobId: string): Promise<AdminLedgerRecord[]>;
  listStitchJobs(jobId: string): Promise<AdminStitchJobRecord[]>;
  listPostQaResults(jobId: string): Promise<AdminPostQaRecord[]>;
  listStateEvents(jobId: string): Promise<AdminStateEventRecord[]>;
  listNotes(jobId: string): Promise<AdminJobNoteRecord[]>;
}

function isStale(updatedAt: Date, now: Date) {
  return now.getTime() - updatedAt.getTime() > STALE_THRESHOLD_MS;
}

function hasUnresolvedReserve(ledger: AdminLedgerRecord[]) {
  const hasReserve = ledger.some((entry) => entry.type === "reserve");
  const hasResolution = ledger.some((entry) =>
    ["capture", "release", "refund"].includes(entry.type),
  );

  return hasReserve && !hasResolution;
}

function hasCapturedCredits(ledger: AdminLedgerRecord[]) {
  return ledger.some((entry) => entry.type === "capture");
}

export function diagnoseAdminJob({
  job,
  segments,
  stitchJobs,
  moderationResults,
  ledger,
  now,
}: {
  job: AdminJobRecord;
  segments: AdminSegmentRecord[];
  stitchJobs: AdminStitchJobRecord[];
  moderationResults: AdminModerationResultRecord[];
  ledger: AdminLedgerRecord[];
  now: Date;
}): AdminJobDiagnosis {
  if (
    job.status === "deliverable" &&
    job.finalVideoKey &&
    job.creditCost > 0 &&
    !hasCapturedCredits(ledger)
  ) {
    return {
      kind: "credits_need_attention",
      severity: "critical",
      title: "已交付但未扣点",
      recommendation:
        "任务已经 deliverable，但 credit_ledger 没有 capture。先核对 Post-QA resolve 和账本，再决定补扣、补偿或人工处理。",
      needsManualAction: true,
    };
  }

  if (job.status === "deliverable" && job.finalVideoKey) {
    return {
      kind: "deliverable",
      severity: "info",
      title: "任务可交付",
      recommendation: "检查下载链路、封面和 Post-QA 记录，确认用户侧可正常获取成片。",
      needsManualAction: false,
    };
  }

  if (
    ["post_qa_queued", "post_qa_running"].includes(job.status) &&
    isStale(job.updatedAt, now)
  ) {
    return {
      kind: "post_qa_stalled",
      severity: "warning",
      title: "Post-QA 可能卡住",
      recommendation: "先检查 frame keys 和 provider logs，必要时重开 Post-QA，不要直接放行交付。",
      needsManualAction: true,
    };
  }

  if (
    job.status === "prompt_moderation_blocked" ||
    moderationResults.some((result) => result.decision !== "allow")
  ) {
    return {
      kind: "moderation_blocked",
      severity: "critical",
      title: "任务被合规拦截",
      recommendation: "不要重试生成。需要用户修改 prompt 后重新走审核链路。",
      needsManualAction: true,
    };
  }

  if (
    job.status === "segment_failed" ||
    segments.some((segment) => segment.status === "failed")
  ) {
    return {
      kind: "segment_failed",
      severity: "critical",
      title: "存在失败片段",
      recommendation: "优先重试失败 segment，不要整单重跑；同时检查 provider task id 和 last error。",
      needsManualAction: true,
    };
  }

  if (
    stitchJobs.some((stitchJob) => stitchJob.status === "failed") ||
    (["stitching_queued", "stitching_running", "stitched"].includes(job.status) &&
      !job.finalVideoKey)
  ) {
    return {
      kind: "stitch_failed",
      severity: "critical",
      title: "拼接链路异常",
      recommendation: "检查 Cloud Run、stitch job、segment keys 和 finalVideoKey，确认不是回写或 ffmpeg 失败。",
      needsManualAction: true,
    };
  }

  if (
    ["failed_released", "failed_refunded", "post_qa_failed", "segment_failed"].includes(
      job.status,
    ) &&
    hasUnresolvedReserve(ledger)
  ) {
    return {
      kind: "credits_need_attention",
      severity: "warning",
      title: "点数冻结可能未闭环",
      recommendation: "账本里有 reserve 但没有 capture/release/refund，先核对 credit ledger，再决定释放或退款。",
      needsManualAction: true,
    };
  }

  return {
    kind: "in_progress",
    severity: "info",
    title: "任务仍在推进中",
    recommendation: "继续检查当前状态对应的 provider logs、状态事件和最近更新时间，确认是否真的在推进而不是静默卡住。",
    needsManualAction: false,
  };
}

export async function getAdminJobDetail({
  store,
  jobId,
  now = new Date(),
}: {
  store: AdminJobStore;
  jobId: string;
  now?: Date;
}) {
  const job = await store.findJob(jobId);
  if (!job) {
    return null;
  }

  const [
    assetRecords,
    analysisRecords,
    consistencyAnalysisRecords,
    latestStoryboard,
    segmentRecords,
    providerLogRecords,
    moderationResultRecords,
    ledgerRecords,
    stitchJobRecords,
    postQaResultRecords,
    stateEventRecords,
    noteRecords,
  ] = await Promise.all([
    store.listAssets(jobId),
    store.listAnalyses(jobId),
    store.listConsistencyAnalyses(jobId),
    store.findLatestStoryboard(jobId),
    store.listSegments(jobId),
    store.listProviderLogs(jobId),
    store.listModerationResults(jobId),
    store.listLedger(jobId),
    store.listStitchJobs(jobId),
    store.listPostQaResults(jobId),
    store.listStateEvents(jobId),
    store.listNotes(jobId),
  ]);

  const diagnosis = diagnoseAdminJob({
    job,
    segments: segmentRecords,
    stitchJobs: stitchJobRecords,
    moderationResults: moderationResultRecords,
    ledger: ledgerRecords,
    now,
  });

  return {
    job,
    diagnosis,
    assets: assetRecords,
    analyses: analysisRecords,
    consistencyAnalyses: consistencyAnalysisRecords,
    latestStoryboard,
    segments: [...segmentRecords].sort(
      (left, right) => left.segmentIndex - right.segmentIndex,
    ),
    providerLogs: [...providerLogRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    moderationResults: [...moderationResultRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    ledger: [...ledgerRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    stitchJobs: [...stitchJobRecords].sort((left, right) => {
      if (!left.createdAt || !right.createdAt) {
        return 0;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    }),
    postQaResults: [...postQaResultRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    stateEvents: [...stateEventRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
    notes: [...noteRecords].sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
    ),
  };
}

export function createInMemoryAdminJobStore(input: {
  jobs: AdminJobRecord[];
  assets?: AdminAssetRecord[];
  analyses?: AdminAnalysisRecord[];
  consistencyAnalyses?: AdminConsistencyAnalysisRecord[];
  storyboards?: AdminStoryboardRecord[];
  segments: AdminSegmentRecord[];
  providerLogs: AdminProviderLogRecord[];
  moderationResults: AdminModerationResultRecord[];
  ledger: AdminLedgerRecord[];
  stitchJobs: AdminStitchJobRecord[];
  postQaResults: AdminPostQaRecord[];
  stateEvents?: AdminStateEventRecord[];
  notes?: AdminJobNoteRecord[];
}): AdminJobStore {
  return {
    async findJob(jobId) {
      return input.jobs.find((job) => job.id === jobId) ?? null;
    },
    async listAssets(jobId) {
      return (input.assets ?? []).filter((asset) => asset.videoJobId === jobId);
    },
    async listAnalyses(jobId) {
      return (input.analyses ?? []).filter((analysis) => analysis.videoJobId === jobId);
    },
    async findLatestStoryboard(jobId) {
      return (
        [...(input.storyboards ?? [])]
          .filter((storyboard) => storyboard.videoJobId === jobId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
      );
    },
    async listSegments(jobId) {
      return input.segments.filter((segment) => segment.videoJobId === jobId);
    },
    async listProviderLogs(jobId) {
      return input.providerLogs.filter((log) => log.videoJobId === jobId);
    },
    async listModerationResults(jobId) {
      return input.moderationResults.filter((result) => result.videoJobId === jobId);
    },
    async listLedger(jobId) {
      return input.ledger.filter((entry) => entry.relatedJobId === jobId);
    },
    async listStitchJobs(jobId) {
      return input.stitchJobs.filter((record) => record.videoJobId === jobId);
    },
    async listPostQaResults(jobId) {
      return input.postQaResults.filter((record) => record.videoJobId === jobId);
    },
    async listStateEvents(jobId) {
      return (input.stateEvents ?? []).filter((event) => event.videoJobId === jobId);
    },
    async listConsistencyAnalyses(jobId) {
      return (input.consistencyAnalyses ?? []).filter(
        (analysis) => analysis.videoJobId === jobId,
      );
    },
    async listNotes(jobId) {
      return (input.notes ?? []).filter((note) => note.jobId === jobId);
    },
  };
}

type DbClient = ReturnType<typeof getDb>;

export function createDrizzleAdminJobStore(db: DbClient = getDb()): AdminJobStore {
  return {
    async findJob(jobId) {
      const [job] = await db
        .select({
          id: videoJobs.id,
          userId: videoJobs.userId,
          status: videoJobs.status,
          userVisibleStatus: videoJobs.userVisibleStatus,
          durationSeconds: videoJobs.durationSeconds,
          aspectRatio: videoJobs.aspectRatio,
          billingMode: videoJobs.billingMode,
          creditCost: videoJobs.creditCost,
          presetId: videoJobs.presetId,
          presetSnapshot: videoJobs.presetSnapshot,
          trialEligibilitySnapshot: videoJobs.trialEligibilitySnapshot,
          reservedLedgerId: videoJobs.reservedLedgerId,
          finalVideoKey: videoJobs.finalVideoKey,
          coverKey: videoJobs.coverKey,
          isTest: videoJobs.isTest,
          failureReason: videoJobs.failureReason,
          lastError: videoJobs.lastError,
          createdAt: videoJobs.createdAt,
          updatedAt: videoJobs.updatedAt,
        })
        .from(videoJobs)
        .where(eq(videoJobs.id, jobId))
        .limit(1);

      return (job as AdminJobRecord | undefined) ?? null;
    },
    async listAssets(jobId) {
      return db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: videoJobAssets.assetId,
          role: videoJobAssets.role,
          sortOrder: videoJobAssets.sortOrder,
          fileName: assets.fileName,
          originalKey: assets.originalKey,
          detectedRole: assets.detectedRole,
        })
        .from(videoJobAssets)
        .innerJoin(assets, eq(videoJobAssets.assetId, assets.id))
        .where(eq(videoJobAssets.videoJobId, jobId))
        .orderBy(videoJobAssets.sortOrder);
    },
    async listAnalyses(jobId) {
      return db
        .select({
          videoJobId: videoJobAssets.videoJobId,
          assetId: assetAnalyses.assetId,
          analysisJson: assetAnalyses.analysisJson,
          mode: assetAnalyses.mode,
        })
        .from(assetAnalyses)
        .innerJoin(videoJobAssets, eq(assetAnalyses.assetId, videoJobAssets.assetId))
        .where(eq(videoJobAssets.videoJobId, jobId))
        .orderBy(desc(assetAnalyses.createdAt));
    },
    async listConsistencyAnalyses(jobId) {
      return db
        .select({
          videoJobId: assetConsistencyAnalyses.videoJobId,
          analysisKind: assetConsistencyAnalyses.analysisKind,
          status: assetConsistencyAnalyses.status,
          garmentMatch: assetConsistencyAnalyses.garmentMatch,
          modelMatch: assetConsistencyAnalyses.modelMatch,
          colorMatch: assetConsistencyAnalyses.colorMatch,
          patternMatch: assetConsistencyAnalyses.patternMatch,
          viewCoverage: assetConsistencyAnalyses.viewCoverage,
          confidence: assetConsistencyAnalyses.confidence,
          riskFlags: assetConsistencyAnalyses.riskFlags,
          resultJson: assetConsistencyAnalyses.resultJson,
        })
        .from(assetConsistencyAnalyses)
        .where(eq(assetConsistencyAnalyses.videoJobId, jobId));
    },
    async findLatestStoryboard(jobId) {
      const [storyboard] = await db
        .select({
          id: storyboards.id,
          videoJobId: storyboards.videoJobId,
          status: storyboards.status,
          presetId: storyboards.presetId,
          presetSnapshot: storyboards.presetSnapshot,
          selectedTemplateIds: storyboards.selectedTemplateIds,
          storyboardJson: storyboards.storyboardJson,
          finalPromptSnapshot: storyboards.finalPromptSnapshot,
          createdAt: storyboards.createdAt,
        })
        .from(storyboards)
        .where(eq(storyboards.videoJobId, jobId))
        .orderBy(desc(storyboards.createdAt))
        .limit(1);

      return (storyboard as AdminStoryboardRecord | undefined) ?? null;
    },
    async listSegments(jobId) {
      return db
        .select({
          id: videoSegments.id,
          videoJobId: videoSegments.videoJobId,
          segmentIndex: videoSegments.segmentIndex,
          status: videoSegments.status,
          templateId: videoSegments.templateId,
          provider: videoSegments.provider,
          model: videoSegments.model,
          providerTaskId: videoSegments.providerTaskId,
          videoKey: videoSegments.videoKey,
          prompt: videoSegments.prompt,
          lastError: videoSegments.lastError,
          attemptCount: videoSegments.attemptCount,
        })
        .from(videoSegments)
        .where(eq(videoSegments.videoJobId, jobId))
        .orderBy(videoSegments.segmentIndex);
    },
    async listProviderLogs(jobId) {
      return db
        .select({
          id: providerCallLogs.id,
          videoJobId: providerCallLogs.videoJobId,
          segmentId: providerCallLogs.segmentId,
          purpose: providerCallLogs.purpose,
          provider: providerCallLogs.provider,
          modelRouteId: providerCallLogs.modelRouteId,
          routeSnapshot: providerCallLogs.routeSnapshot,
          model: providerCallLogs.model,
          status: providerCallLogs.status,
          durationMs: providerCallLogs.durationMs,
          costEstimate: providerCallLogs.costEstimate,
          fallbackReason: providerCallLogs.fallbackReason,
          responseSummary: providerCallLogs.responseSummary,
          providerTaskId: providerCallLogs.providerTaskId,
          errorCode: providerCallLogs.errorCode,
          errorMessage: providerCallLogs.errorMessage,
          createdAt: providerCallLogs.createdAt,
        })
        .from(providerCallLogs)
        .where(eq(providerCallLogs.videoJobId, jobId))
        .orderBy(desc(providerCallLogs.createdAt));
    },
    async listModerationResults(jobId) {
      return db
        .select({
          id: promptModerationResults.id,
          videoJobId: promptModerationResults.videoJobId,
          segmentId: promptModerationResults.segmentId,
          source: promptModerationResults.source,
          decision: promptModerationResults.decision,
          provider: promptModerationResults.moderationId,
          errorCode: promptModerationResults.errorCode,
          errorMessage: promptModerationResults.errorMessage,
          createdAt: promptModerationResults.createdAt,
        })
        .from(promptModerationResults)
        .where(eq(promptModerationResults.videoJobId, jobId))
        .orderBy(desc(promptModerationResults.createdAt));
    },
    async listLedger(jobId) {
      return db
        .select({
          id: creditLedger.id,
          userId: creditLedger.userId,
          relatedJobId: creditLedger.relatedJobId,
          type: creditLedger.type,
          amount: creditLedger.amount,
          balanceBefore: creditLedger.balanceBefore,
          balanceAfter: creditLedger.balanceAfter,
          reason: creditLedger.reason,
          idempotencyKey: creditLedger.idempotencyKey,
          createdAt: creditLedger.createdAt,
        })
        .from(creditLedger)
        .where(eq(creditLedger.relatedJobId, jobId))
        .orderBy(desc(creditLedger.createdAt));
    },
    async listStitchJobs(jobId) {
      return db
        .select({
          id: stitchJobs.id,
          videoJobId: stitchJobs.videoJobId,
          status: stitchJobs.status,
          segmentKeys: stitchJobs.segmentKeys,
          finalVideoKey: stitchJobs.finalVideoKey,
          coverKey: stitchJobs.coverKey,
          frameKeys: stitchJobs.frameKeys,
          lastError: stitchJobs.lastError,
          createdAt: stitchJobs.createdAt,
        })
        .from(stitchJobs)
        .where(eq(stitchJobs.videoJobId, jobId))
        .orderBy(desc(stitchJobs.createdAt));
    },
    async listPostQaResults(jobId) {
      return db
        .select({
          id: postQaResults.id,
          videoJobId: postQaResults.videoJobId,
          status: postQaResults.status,
          mode: postQaResults.mode,
          failureCategory: postQaResults.failureCategory,
          frameKeys: postQaResults.frameKeys,
          resultJson: postQaResults.resultJson,
          createdAt: postQaResults.createdAt,
        })
        .from(postQaResults)
        .where(eq(postQaResults.videoJobId, jobId))
        .orderBy(desc(postQaResults.createdAt));
    },
    async listStateEvents(jobId) {
      return db
        .select({
          id: jobStateEvents.id,
          videoJobId: jobStateEvents.videoJobId,
          segmentId: jobStateEvents.segmentId,
          fromStatus: jobStateEvents.fromStatus,
          toStatus: jobStateEvents.toStatus,
          reason: jobStateEvents.reason,
          actorType: jobStateEvents.actorType,
          actorId: jobStateEvents.actorId,
          eventSnapshot: jobStateEvents.eventSnapshot,
          createdAt: jobStateEvents.createdAt,
        })
        .from(jobStateEvents)
        .where(eq(jobStateEvents.videoJobId, jobId))
        .orderBy(desc(jobStateEvents.createdAt));
    },
    async listNotes(jobId) {
      return db
        .select({
          id: adminJobNotes.id,
          jobId: adminJobNotes.jobId,
          adminUserId: adminJobNotes.adminUserId,
          note: adminJobNotes.note,
          createdAt: adminJobNotes.createdAt,
        })
        .from(adminJobNotes)
        .where(eq(adminJobNotes.jobId, jobId))
        .orderBy(desc(adminJobNotes.createdAt));
    },
  };
}
