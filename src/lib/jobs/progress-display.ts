import { userFacingJobMessage } from "./user-facing-message";

export interface DisplayableJobProgress {
  jobId?: string;
  status: string;
  phase: string;
  message?: string | null;
  segmentProgress: {
    total: number;
    queued: number;
    generating: number;
    succeeded: number;
    failed: number;
  };
  stitching: { status: string };
  postQa: { status: string };
  creditCost?: number;
  billingMode?: "free_trial" | "paid" | string;
  creditStatus?:
    | "not_reserved"
    | "reserved"
    | "captured"
    | "released"
    | "trial"
    | string;
  downloadReady: boolean;
  updatedAt?: string | Date | null;
}

export type DisplayStepState = "done" | "active" | "pending" | "failed";

export interface JobProgressDisplay {
  title: string;
  description: string;
  statusPill: string;
  steps: Array<{
    key: string;
    label: string;
    state: DisplayStepState;
  }>;
  creditTitle: string;
  creditDescription: string;
  delayNotice: string | null;
  failureMessage: string | null;
  recoveryHref: string | null;
}

const steps = [
  { key: "asset_analysis", label: "素材检查" },
  { key: "storyboard", label: "分镜准备" },
  { key: "generation", label: "生成镜头" },
  { key: "stitching", label: "合成成片" },
  { key: "post_qa", label: "质量检查" },
  { key: "deliverable", label: "可下载" },
];

function normalizedStepKey(phase: string) {
  if (phase === "pre_generation") {
    return "generation";
  }

  if (phase === "setup") {
    return "asset_analysis";
  }

  return phase;
}

function currentSegment(progress: DisplayableJobProgress) {
  const total = progress.segmentProgress.total;
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    total,
    Math.max(1, progress.segmentProgress.succeeded + progress.segmentProgress.generating),
  );
}

function phaseCopy(progress: DisplayableJobProgress) {
  const total = progress.segmentProgress.total;
  const current = currentSegment(progress);

  if (progress.phase === "failed") {
    return {
      title: "本次任务未交付成片",
      description: "请查看处理建议。未交付的付费任务不会正式扣点。",
      statusPill: "未交付",
    };
  }

  if (progress.downloadReady || progress.phase === "deliverable") {
    return {
      title: "视频已完成",
      description: "可以预览和下载成片。",
      statusPill: "可下载",
    };
  }

  switch (progress.phase) {
    case "asset_analysis":
      return {
        title: "正在检查素材",
        description: "正在检查图片角度、清晰度和可用镜头。通常需要 2-4 分钟。",
        statusPill: "素材检查",
      };
    case "storyboard":
      return {
        title: "正在准备分镜",
        description: "正在根据素材和风格预设准备视频分镜。通常需要 2-4 分钟。",
        statusPill: "分镜准备",
      };
    case "pre_generation":
      return {
        title: "正在进行生成前检查",
        description: "正在完成合规检查和点数确认，通过后会开始生成镜头。通常需要 2-4 分钟。",
        statusPill: "生成前检查",
      };
    case "generation":
      return {
        title: "正在生成视频镜头",
        description:
          total > 0
            ? `正在生成第 ${current} 个镜头，共 ${total} 个。通常需要 2-4 分钟。`
            : "正在生成视频镜头。通常需要 2-4 分钟。",
        statusPill: "生成镜头",
      };
    case "stitching":
      return {
        title: "正在合成完整视频",
        description: "镜头已生成，正在合成为完整视频。通常需要 2-4 分钟。",
        statusPill: "合成成片",
      };
    case "post_qa":
      return {
        title: "正在进行质量检查",
        description: "正在检查成片画面稳定性，通过后会开放预览和下载。通常需要 2-4 分钟。",
        statusPill: "质量检查",
      };
    default:
      return {
        title: "正在准备任务",
        description: "任务正在排队或准备素材，开始生成后进度会自动更新。通常需要 2-4 分钟。",
        statusPill: "处理中",
      };
  }
}

function buildSteps(progress: DisplayableJobProgress) {
  const activeKey = normalizedStepKey(progress.phase);
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === activeKey),
  );

  return steps.map((step, index) => {
    const state: DisplayStepState =
      progress.phase === "failed"
        ? index < activeIndex
          ? "done"
          : index === activeIndex
            ? "failed"
            : "pending"
        : index < activeIndex
          ? "done"
          : index === activeIndex
            ? "active"
            : "pending";

    return {
      ...step,
      state,
    };
  });
}

function creditCopy(progress: DisplayableJobProgress) {
  const amount = progress.creditCost ?? 0;

  if (progress.billingMode === "free_trial" || progress.creditStatus === "trial") {
    return {
      creditTitle: "免费试用任务",
      creditDescription: "不扣点数。输出为低分辨率并带水印。",
    };
  }

  switch (progress.creditStatus) {
    case "reserved":
      return {
        creditTitle: `已冻结 ${amount} 点`,
        creditDescription: "视频通过质量检查后才会正式扣除。生成失败会自动退回。",
      };
    case "captured":
      return {
        creditTitle: `已扣除 ${amount} 点`,
        creditDescription: "视频已通过质量检查并开放下载。",
      };
    case "released":
      return {
        creditTitle: "点数已退回",
        creditDescription: "本次任务未交付，冻结点数已退回可用余额。",
      };
    default:
      return {
        creditTitle: amount > 0 ? `预计冻结 ${amount} 点` : "未产生点数消耗",
        creditDescription:
          amount > 0
            ? "点击生成后先冻结，失败会自动释放。"
            : "当前任务不会产生点数消耗。",
      };
  }
}

function phaseAgeMinutes(updatedAt?: string | Date | null) {
  if (!updatedAt) {
    return 0;
  }

  const date = new Date(updatedAt);
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return 0;
  }

  return Math.max(0, (Date.now() - time) / 60_000);
}

function delayNotice(progress: DisplayableJobProgress) {
  if (progress.downloadReady || progress.phase === "deliverable" || progress.phase === "failed") {
    return null;
  }

  const age = phaseAgeMinutes(progress.updatedAt);
  if (age >= 15) {
    return "任务等待时间较长，我们会继续自动检查。如果最终失败，冻结点数会自动释放。";
  }

  if (age >= 3) {
    return "这个步骤比平时更久，通常是生成服务排队或视频较复杂。任务仍在处理中，你可以稍后回来查看。";
  }

  return null;
}

export function buildJobProgressDisplay(
  progress: DisplayableJobProgress,
): JobProgressDisplay {
  const copy = phaseCopy(progress);
  const credit = creditCopy(progress);
  const failureMessage =
    progress.phase === "failed" ? userFacingJobMessage(progress.message) : null;

  return {
    ...copy,
    steps: buildSteps(progress),
    ...credit,
    delayNotice: delayNotice(progress),
    failureMessage,
    recoveryHref:
      progress.phase === "failed" && progress.jobId
        ? `/workspace?sourceJobId=${encodeURIComponent(progress.jobId)}`
        : null,
  };
}

export function placeholderCopyForProgress(progress: DisplayableJobProgress) {
  if (progress.phase === "failed" || progress.status.startsWith("failed")) {
    return {
      label: "本次任务未交付成片",
      description: "可以返回工作台重新创建。未交付的付费任务不会正式扣点。",
    };
  }

  if (progress.downloadReady) {
    return {
      label: "视频已完成",
      description: "可以预览和下载成片。",
    };
  }

  const display = buildJobProgressDisplay(progress);
  return {
    label: "成片预览将在这里显示",
    description: `${display.title}。任务会继续处理，你可以稍后回来查看。`,
  };
}
