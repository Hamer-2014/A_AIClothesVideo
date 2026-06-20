import { describe, expect, it } from "vitest";

import {
  buildJobProgressDisplay,
  placeholderCopyForProgress,
  type DisplayableJobProgress,
} from "./progress-display";

function progress(
  overrides: Partial<DisplayableJobProgress> = {},
): DisplayableJobProgress {
  return {
    status: "segment_generating",
    phase: "generation",
    message: null,
    segmentProgress: {
      total: 3,
      queued: 1,
      generating: 1,
      succeeded: 1,
      failed: 0,
    },
    stitching: { status: "not_started" },
    postQa: { status: "not_started" },
    creditCost: 130,
    billingMode: "paid",
    creditStatus: "reserved",
    downloadReady: false,
    updatedAt: new Date(Date.now() - 60_000).toISOString(),
    ...overrides,
  };
}

describe("job progress display model", () => {
  it("uses seller-friendly generation copy with current lens progress", () => {
    const display = buildJobProgressDisplay(progress());

    expect(display.title).toBe("正在生成视频镜头");
    expect(display.description).toContain("正在生成第 2 个镜头，共 3 个");
    expect(display.description).toContain("通常需要 2-4 分钟");
    expect(display.steps.find((step) => step.key === "generation")?.state).toBe(
      "active",
    );
  });

  it("does not expose raw technical step labels", () => {
    const display = buildJobProgressDisplay(progress());

    expect(display.steps.map((step) => step.label)).toEqual([
      "素材检查",
      "分镜准备",
      "生成镜头",
      "合成成片",
      "质量检查",
      "可下载",
    ]);
  });

  it("shows paid reserved credit trust copy", () => {
    const display = buildJobProgressDisplay(progress());

    expect(display.creditTitle).toBe("已冻结 130 点");
    expect(display.creditDescription).toBe(
      "视频通过质量检查后才会正式扣除。生成失败会自动退回。",
    );
  });

  it("shows free trial copy without credits anxiety", () => {
    const display = buildJobProgressDisplay(
      progress({
        billingMode: "free_trial",
        creditCost: 0,
        creditStatus: "trial",
      }),
    );

    expect(display.creditTitle).toBe("免费试用任务");
    expect(display.creditDescription).toBe("不扣点数。输出为低分辨率并带水印。");
  });

  it("shows light delayed notice after 3 minutes", () => {
    const display = buildJobProgressDisplay(
      progress({ updatedAt: new Date(Date.now() - 4 * 60_000).toISOString() }),
    );

    expect(display.delayNotice).toBe(
      "这个步骤比平时更久，通常是生成服务排队或视频较复杂。任务仍在处理中，你可以稍后回来查看。",
    );
  });

  it("shows stronger delayed notice after 15 minutes", () => {
    const display = buildJobProgressDisplay(
      progress({ updatedAt: new Date(Date.now() - 16 * 60_000).toISOString() }),
    );

    expect(display.delayNotice).toBe(
      "任务等待时间较长，我们会继续自动检查。如果最终失败，冻结点数会自动释放。",
    );
  });

  it("does not show delayed notice for completed jobs", () => {
    const display = buildJobProgressDisplay(
      progress({
        phase: "deliverable",
        status: "deliverable",
        downloadReady: true,
        updatedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      }),
    );

    expect(display.delayNotice).toBeNull();
  });

  it("returns failed recovery copy and workspace recreate link", () => {
    const display = buildJobProgressDisplay(
      progress({
        jobId: "job_123",
        phase: "failed",
        status: "failed_released",
        creditStatus: "released",
        message: "APIMart provider status 500",
      }),
    );

    expect(display.title).toBe("本次任务未交付成片");
    expect(display.failureMessage).toBe(
      "生成服务暂时繁忙，本次没有交付成片。冻结点数会自动退回，你可以稍后重试。",
    );
    expect(display.recoveryHref).toBe("/workspace?sourceJobId=job_123");
  });

  it("returns pending preview placeholder copy", () => {
    const copy = placeholderCopyForProgress(progress({ phase: "post_qa" }));

    expect(copy.label).toBe("成片预览将在这里显示");
    expect(copy.description).toContain("正在进行质量检查");
  });
});
