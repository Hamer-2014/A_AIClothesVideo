# User Generation Waiting Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the user-facing job waiting/status UI with a clear, reassuring generation progress experience that uses seller-friendly language, preserves credit trust, and keeps raw operational details out of the first viewport.

**Architecture:** Add a small display-model layer for job progress copy and step state, then render that model in the existing job detail components. Keep backend workflow/status names unchanged; translate them only at the UI boundary. Add a lightweight server field for state age so the client can show delayed-state notices without fake countdowns.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

## Confirmed Product Decisions

- Storyboard JSON should become a user-readable storyboard summary. Raw JSON should not be visible by default on the user task detail page.
- Expected generation time should be expressed as a soft range: "通常需要 2-4 分钟". Do not show a precise countdown or fake percentage.
- Delayed-state notices:
  - 3 minutes: light notice.
  - 15 minutes: stronger notice.
- Failed user flow should show "返回工作台重新创建" for now. Do not implement one-click regeneration in this pass.
- Include `sourceJobId=<jobId>` in the "返回工作台重新创建" link so a later pass can reuse existing assets. This pass must not copy assets or silently recreate jobs.
- Tone should be professional and reassuring: Minimal Premium SaaS, no "AI magic" language.

## File Structure

- Create `src/lib/jobs/progress-display.ts`
  - Pure display-model functions for phase title, step states, credit copy, delayed notices, and preview placeholder copy.
- Create `src/lib/jobs/progress-display.test.ts`
  - Unit tests for display-model behavior.
- Modify `src/server/jobs/progress.ts`
  - Return `updatedAt` from `video_jobs` so the client can calculate current-state age.
- Modify `src/server/jobs/progress.test.ts`
  - Assert `updatedAt` is exposed in progress payload.
- Modify `src/components/jobs/job-progress.tsx`
  - Replace raw operational cards with user-facing title, helper text, stepper, credit notice, delayed notice, and failure recovery link.
- Modify `src/components/jobs/job-progress.test.tsx`
  - Update tests around visible copy and hidden raw status labels.
- Modify `src/components/jobs/job-live-panels.tsx`
  - Use shared placeholder copy from the display model.
- Modify `src/components/jobs/job-live-panels.test.tsx`
  - Assert pending preview copy is user-friendly.
- Modify `src/lib/jobs/user-facing-message.ts`
  - Expand technical-error-to-user-copy mapping.
- Modify `src/lib/jobs/user-facing-message.test.ts`
  - Cover provider, moderation, asset, QA, credits, and default failure messages.
- Modify `src/app/(dashboard)/jobs/[id]/page.tsx`
  - Replace default raw storyboard JSON section with a user-readable summary and a secondary/collapsed technical details block only if still needed.
- Modify or create `src/app/(dashboard)/jobs/[id]/page.test.ts`
  - Assert the job page does not show raw JSON as the primary storyboard presentation.

## UX Content Model

User-facing steps:

```ts
const USER_PROGRESS_STEPS = [
  { key: "asset_analysis", label: "素材检查" },
  { key: "storyboard", label: "分镜准备" },
  { key: "generation", label: "生成镜头" },
  { key: "stitching", label: "合成成片" },
  { key: "post_qa", label: "质量检查" },
  { key: "deliverable", label: "可下载" },
] as const;
```

Phase copy:

```ts
asset_analysis:
  title: "正在检查素材"
  description: "正在检查图片角度、清晰度和可用镜头。通常需要 2-4 分钟。"

storyboard:
  title: "正在准备分镜"
  description: "正在根据素材和风格预设准备视频分镜。通常需要 2-4 分钟。"

pre_generation:
  title: "正在进行生成前检查"
  description: "正在完成合规检查和点数确认，通过后会开始生成镜头。通常需要 2-4 分钟。"

generation:
  title: "正在生成视频镜头"
  description: "正在生成第 {current} 个镜头，共 {total} 个。通常需要 2-4 分钟。"

stitching:
  title: "正在合成完整视频"
  description: "镜头已生成，正在合成为完整视频。通常需要 2-4 分钟。"

post_qa:
  title: "正在进行质量检查"
  description: "正在检查成片画面稳定性，通过后会开放预览和下载。通常需要 2-4 分钟。"

deliverable:
  title: "视频已完成"
  description: "可以预览和下载成片。"

failed:
  title: "本次任务未交付成片"
  description: "请查看处理建议。未交付的付费任务不会正式扣点。"
```

Delayed notices:

```ts
if (phaseAgeMinutes >= 15) {
  return "任务等待时间较长，我们会继续自动检查。如果最终失败，冻结点数会自动释放。";
}

if (phaseAgeMinutes >= 3) {
  return "这个步骤比平时更久，通常是生成服务排队或视频较复杂。任务仍在处理中，你可以稍后回来查看。";
}
```

Credit copy:

```ts
free_trial/trial:
  title: "免费试用任务"
  description: "不扣点数。输出为低分辨率并带水印。"

reserved:
  title: "已冻结 {amount} 点"
  description: "视频通过质量检查后才会正式扣除。生成失败会自动退回。"

captured:
  title: "已扣除 {amount} 点"
  description: "视频已通过质量检查并开放下载。"

released:
  title: "点数已退回"
  description: "本次任务未交付，冻结点数已退回可用余额。"

default:
  title: "预计冻结 {amount} 点"
  description: "点击生成后先冻结，失败会自动释放。"
```

## Task 1: Add Progress Display Model

**Files:**
- Create: `src/lib/jobs/progress-display.ts`
- Create: `src/lib/jobs/progress-display.test.ts`

- [ ] **Step 1: Write failing display-model tests**

Create `src/lib/jobs/progress-display.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildJobProgressDisplay,
  placeholderCopyForProgress,
  type DisplayableJobProgress,
} from "./progress-display";

function progress(overrides: Partial<DisplayableJobProgress> = {}): DisplayableJobProgress {
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
    expect(display.steps.find((step) => step.key === "generation")?.state).toBe("active");
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npx vitest run src/lib/jobs/progress-display.test.ts
```

Expected: FAIL because `src/lib/jobs/progress-display.ts` does not exist.

- [ ] **Step 3: Implement display model**

Create `src/lib/jobs/progress-display.ts`:

```ts
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
  creditStatus?: "not_reserved" | "reserved" | "captured" | "released" | "trial" | string;
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

  return steps.map((step, index) => ({
    ...step,
    state:
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
            : "pending",
  }));
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
        creditDescription: amount > 0 ? "点击生成后先冻结，失败会自动释放。" : "当前任务不会产生点数消耗。",
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

export function buildJobProgressDisplay(progress: DisplayableJobProgress): JobProgressDisplay {
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
```

- [ ] **Step 4: Run display-model tests**

Run:

```bash
npx vitest run src/lib/jobs/progress-display.test.ts
```

Expected: PASS.

## Task 2: Expose Progress Updated Time

**Files:**
- Modify: `src/server/jobs/progress.ts`
- Modify: `src/server/jobs/progress.test.ts`

- [ ] **Step 1: Write failing test for updatedAt**

Add this assertion to an existing `getVideoJobProgress` test in `src/server/jobs/progress.test.ts`, or add this new test if no matching test exists:

```ts
it("returns updatedAt so the UI can show delayed-state notices", async () => {
  const updatedAt = new Date("2026-06-19T08:00:00.000Z");
  const store = createInMemoryJobProgressStore({
    jobs: [
      {
        id: "job_1",
        userId: "user_1",
        status: "segment_generating",
        userVisibleStatus: "生成中",
        lastError: null,
        failureReason: null,
        finalVideoKey: null,
        coverKey: null,
        creditCost: 70,
        billingMode: "paid",
        reservedLedgerId: "ledger_1",
        updatedAt,
      },
    ],
    segments: [{ videoJobId: "job_1", status: "generating" }],
    stitchJobs: [],
    postQaResults: [],
  });

  const progress = await getVideoJobProgress({
    store,
    jobId: "job_1",
    userId: "user_1",
  });

  expect(progress?.updatedAt).toEqual(updatedAt);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run src/server/jobs/progress.test.ts
```

Expected: FAIL because `JobProgressRecord` and return payload do not include `updatedAt`.

- [ ] **Step 3: Add `updatedAt` to progress store and payload**

In `src/server/jobs/progress.ts`:

```ts
export interface JobProgressRecord {
  id: string;
  userId: string;
  status: string;
  userVisibleStatus: string;
  lastError: string | null;
  failureReason: string | null;
  finalVideoKey: string | null;
  coverKey: string | null;
  creditCost: number;
  billingMode: string;
  reservedLedgerId: string | null;
  updatedAt: Date;
}
```

Add to the return payload:

```ts
updatedAt: job.updatedAt,
```

Add to Drizzle select:

```ts
updatedAt: videoJobs.updatedAt,
```

- [ ] **Step 4: Run progress tests**

Run:

```bash
npx vitest run src/server/jobs/progress.test.ts
```

Expected: PASS.

## Task 3: Expand Failure Message Mapping

**Files:**
- Modify: `src/lib/jobs/user-facing-message.ts`
- Modify: `src/lib/jobs/user-facing-message.test.ts`

- [ ] **Step 1: Write failing tests**

Create or update `src/lib/jobs/user-facing-message.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { userFacingJobMessage } from "./user-facing-message";

describe("userFacingJobMessage", () => {
  it("maps provider errors to service-busy copy", () => {
    expect(userFacingJobMessage("APIMart provider status 500")).toBe(
      "生成服务暂时繁忙，本次没有交付成片。冻结点数会自动退回，你可以稍后重试。",
    );
  });

  it("maps moderation errors to prompt revision copy", () => {
    expect(userFacingJobMessage("prompt_moderation_blocked policy denied")).toBe(
      "当前描述无法用于生成，请修改场景或文案后重试。",
    );
  });

  it("maps asset analysis errors to upload guidance copy", () => {
    expect(userFacingJobMessage("asset analysis failed: low quality image")).toBe(
      "素材检查未通过。建议上传更清晰的正面图后重试。",
    );
  });

  it("maps post QA errors to quality failure copy", () => {
    expect(userFacingJobMessage("post_qa_failed abnormal frame")).toBe(
      "成片质量未通过检查，本次不会扣点。你可以更换素材或选择更稳妥的镜头后重试。",
    );
  });

  it("maps credits errors to billing copy", () => {
    expect(userFacingJobMessage("credits balance insufficient")).toBe(
      "点数不足，请充值后继续生成。",
    );
  });

  it("falls back to safe generic copy", () => {
    expect(userFacingJobMessage("unexpected internal error")).toBe(
      "任务未能完成。本次未交付成片时不会正式扣点，你可以稍后重试。",
    );
  });

  it("returns null when there is no message", () => {
    expect(userFacingJobMessage(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npx vitest run src/lib/jobs/user-facing-message.test.ts
```

Expected: FAIL until the mapping is expanded.

- [ ] **Step 3: Implement mapping**

Update `src/lib/jobs/user-facing-message.ts`:

```ts
export function userFacingJobMessage(message?: string | null) {
  if (!message) {
    return null;
  }

  if (/\b(EvoLink|APIMart|provider|task polling|timeout|timed out|status 4\d\d|status 5\d\d)\b/i.test(message)) {
    return "生成服务暂时繁忙，本次没有交付成片。冻结点数会自动退回，你可以稍后重试。";
  }

  if (/\b(moderation|prompt_moderation|policy|blocked|denied)\b/i.test(message)) {
    return "当前描述无法用于生成，请修改场景或文案后重试。";
  }

  if (/\b(asset|image|analysis|low quality|blur|occlusion|素材)\b/i.test(message)) {
    return "素材检查未通过。建议上传更清晰的正面图后重试。";
  }

  if (/\b(post_qa|quality|frame|abnormal|质检)\b/i.test(message)) {
    return "成片质量未通过检查，本次不会扣点。你可以更换素材或选择更稳妥的镜头后重试。";
  }

  if (/\b(credit|credits|balance|insufficient|点数|余额)\b/i.test(message)) {
    return "点数不足，请充值后继续生成。";
  }

  return "任务未能完成。本次未交付成片时不会正式扣点，你可以稍后重试。";
}
```

- [ ] **Step 4: Run failure-message tests**

Run:

```bash
npx vitest run src/lib/jobs/user-facing-message.test.ts
```

Expected: PASS.

## Task 4: Refactor User Progress UI

**Files:**
- Modify: `src/components/jobs/job-progress.tsx`
- Modify: `src/components/jobs/job-progress.test.tsx`

- [ ] **Step 1: Write failing component tests**

Update `src/components/jobs/job-progress.test.tsx` to assert:

```ts
expect(screen.getByText("正在生成视频镜头")).toBeInTheDocument();
expect(screen.getByText(/正在生成第 2 个镜头，共 3 个/)).toBeInTheDocument();
expect(screen.getByText("已冻结 130 点")).toBeInTheDocument();
expect(screen.queryByText("Segment")).not.toBeInTheDocument();
expect(screen.queryByText("Stitch")).not.toBeInTheDocument();
expect(screen.queryByText("Post-QA")).not.toBeInTheDocument();
```

Add a failed-job assertion:

```ts
expect(screen.getByRole("link", { name: "返回工作台重新创建" })).toHaveAttribute(
  "href",
  "/workspace?sourceJobId=job_1",
);
```

- [ ] **Step 2: Run component test to verify failure**

Run:

```bash
npx vitest run src/components/jobs/job-progress.test.tsx
```

Expected: FAIL because old UI still renders raw technical labels.

- [ ] **Step 3: Update `JobProgressData`**

In `src/components/jobs/job-progress.tsx`, add:

```ts
updatedAt?: string | Date | null;
```

- [ ] **Step 4: Use display model in `JobProgress`**

Import:

```ts
import Link from "next/link";
import { buildJobProgressDisplay } from "@/lib/jobs/progress-display";
```

Remove local helpers that duplicate display-model responsibilities:

- `phaseLabel`
- `statusLabel`
- `creditTitle`
- `creditHint`
- `timelineSteps`

Inside component:

```ts
const display = buildJobProgressDisplay(progress);
```

Render:

```tsx
<section className="rounded-lg border border-[var(--line)] bg-white p-5">
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-2xl">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        任务进度
      </p>
      <h3 className="mt-2 text-xl font-semibold">{display.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {display.description}
      </p>
      {!progress.downloadReady && progress.phase !== "failed" ? (
        <p className="mt-2 text-sm text-[var(--muted)]">
          你可以离开此页面，任务会继续处理。完成后可在任务历史中下载。
        </p>
      ) : null}
    </div>
    <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm font-medium">
      {display.statusPill}
    </span>
  </div>

  <div className="mt-5 grid gap-2 md:grid-cols-6">
    {display.steps.map((step) => (
      <div
        className={`rounded-md border px-3 py-2 text-xs ${
          step.state === "done"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : step.state === "active"
              ? "border-[var(--ink)] bg-white text-[var(--ink)]"
              : step.state === "failed"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]"
        }`}
        key={step.key}
      >
        {step.label}
      </div>
    ))}
  </div>

  <div className="mt-5 rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3">
    <p className="text-sm font-medium">{display.creditTitle}</p>
    <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
      {display.creditDescription}
    </p>
  </div>

  {display.delayNotice ? (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
      {display.delayNotice}
    </div>
  ) : null}

  {progress.downloadReady ? (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
      任务已完成，可以下载成片。
    </div>
  ) : null}

  {display.failureMessage ? (
    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
      <p className="font-medium">处理建议</p>
      <p className="mt-1">{display.failureMessage}</p>
      {display.recoveryHref ? (
        <Link
          className="mt-3 inline-flex h-10 items-center rounded-md bg-[var(--ink)] px-4 text-sm font-medium text-white"
          href={display.recoveryHref}
        >
          返回工作台重新创建
        </Link>
      ) : null}
    </div>
  ) : null}
</section>
```

- [ ] **Step 5: Run component tests**

Run:

```bash
npx vitest run src/components/jobs/job-progress.test.tsx
```

Expected: PASS.

## Task 5: Update Pending Preview Placeholder

**Files:**
- Modify: `src/components/jobs/job-live-panels.tsx`
- Modify: `src/components/jobs/job-live-panels.test.tsx`

- [ ] **Step 1: Write failing test**

Update the pending-state test in `src/components/jobs/job-live-panels.test.tsx`:

```ts
expect(screen.getByText("成片预览将在这里显示")).toBeInTheDocument();
expect(screen.getByText(/任务会继续处理，你可以稍后回来查看/)).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx vitest run src/components/jobs/job-live-panels.test.tsx
```

Expected: FAIL if old placeholder copy is still used.

- [ ] **Step 3: Use shared placeholder copy**

In `src/components/jobs/job-live-panels.tsx`, import:

```ts
import { placeholderCopyForProgress } from "@/lib/jobs/progress-display";
```

Remove local `placeholderCopy()` and replace:

```ts
const pendingPreview = placeholderCopyForProgress(progress);
```

- [ ] **Step 4: Run test**

Run:

```bash
npx vitest run src/components/jobs/job-live-panels.test.tsx
```

Expected: PASS.

## Task 6: Replace User Storyboard JSON With Readable Summary

**Files:**
- Modify: `src/app/(dashboard)/jobs/[id]/page.tsx`
- Modify: `src/app/(dashboard)/jobs/[id]/page.test.ts`

- [ ] **Step 1: Write failing page test**

Update `src/app/(dashboard)/jobs/[id]/page.test.ts` to assert:

```ts
expect(screen.getByText("分镜摘要")).toBeInTheDocument();
expect(screen.queryByText(/"segments"/)).not.toBeInTheDocument();
```

If this page test renders with mocked data, include storyboard JSON with at least one segment:

```ts
storyboardJson: {
  duration_seconds: 16,
  segments: [
    {
      index: 1,
      duration_seconds: 8,
      template_id: "front_push_in",
      prompt: "Front push in shot.",
    },
  ],
}
```

- [ ] **Step 2: Run page test to verify failure**

Run:

```bash
npx vitest run 'src/app/(dashboard)/jobs/[id]/page.test.ts'
```

Expected: FAIL because raw JSON is visible.

- [ ] **Step 3: Add summary helper inside page file**

In `src/app/(dashboard)/jobs/[id]/page.tsx`, add a small local helper near the top:

```ts
function storyboardSegments(storyboardJson: unknown) {
  if (
    !storyboardJson ||
    typeof storyboardJson !== "object" ||
    !("segments" in storyboardJson) ||
    !Array.isArray((storyboardJson as { segments?: unknown }).segments)
  ) {
    return [];
  }

  return (storyboardJson as {
    segments: Array<{
      index?: number;
      duration_seconds?: number;
      template_id?: string;
      prompt?: string;
    }>;
  }).segments;
}
```

- [ ] **Step 4: Replace raw JSON section**

Replace the current "最新分镜" section body with:

```tsx
<section className="rounded-lg border border-[var(--line)] bg-white p-5">
  <h2 className="text-base font-medium">分镜摘要</h2>
  {detail.latestStoryboard ? (
    <div className="mt-4 space-y-3">
      {storyboardSegments(detail.latestStoryboard.storyboardJson).map((segment, index) => (
        <div
          className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-4 py-3"
          key={`${segment.template_id ?? "segment"}-${index}`}
        >
          <p className="text-sm font-medium">
            镜头 {segment.index ?? index + 1}
            {segment.duration_seconds ? ` · ${segment.duration_seconds} 秒` : ""}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            模板：{segment.template_id ?? "系统推荐模板"}
          </p>
        </div>
      ))}
      {storyboardSegments(detail.latestStoryboard.storyboardJson).length === 0 ? (
        <p className="text-sm text-[var(--muted)]">分镜已生成，暂无可展示摘要。</p>
      ) : null}
    </div>
  ) : (
    <p className="mt-4 text-sm text-[var(--muted)]">尚未生成分镜。</p>
  )}
</section>
```

- [ ] **Step 5: Run page test**

Run:

```bash
npx vitest run 'src/app/(dashboard)/jobs/[id]/page.test.ts'
```

Expected: PASS.

## Task 7: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npx vitest run src/lib/jobs/progress-display.test.ts src/server/jobs/progress.test.ts src/lib/jobs/user-facing-message.test.ts src/components/jobs/job-progress.test.tsx src/components/jobs/job-live-panels.test.tsx 'src/app/(dashboard)/jobs/[id]/page.test.ts'
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run full test suite**

Run:

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

## Self-Review

- Spec coverage:
  - User-readable status: covered by Tasks 1, 4, 5.
  - Soft 2-4 minute expectation: covered by Task 1 phase copy.
  - 3/15 minute delayed notices: covered by Tasks 1 and 2.
  - Storyboard JSON hidden from default user view: covered by Task 6.
  - Failed flow with workspace recreate link and `sourceJobId`: covered by Tasks 1 and 4.
  - Professional/reassuring tone: covered by copy in Tasks 1, 3, 4, 5.
- Placeholder scan:
  - No TBD/TODO/later placeholders.
  - All test and implementation steps include concrete code or exact expected behavior.
- Type consistency:
  - `DisplayableJobProgress.updatedAt` is optional and accepts `string | Date | null`.
  - `JobProgressData.updatedAt` must mirror the server payload.
  - `recoveryHref` is generated only for failed jobs with a `jobId`.
