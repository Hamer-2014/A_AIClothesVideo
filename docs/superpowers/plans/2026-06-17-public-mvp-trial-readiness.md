# Public MVP Trial Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成试用漏斗产品化、公开页面信任建设、漏斗事件追踪、后台异常处理补强，让项目具备交给 20-50 个真实服装卖家小规模试用的公开 MVP 条件。

**Architecture:** 在现有 Next.js App Router、Drizzle、better-auth、R2、Creem、Style Preset 和 admin 架构上增量实现。前台只展示用户能理解的试用、生成和升级路径；服务端记录漏斗事件；后台提供 MVP 级漏斗统计、失败任务定位和基础运营处理。所有新功能保持现有硬约束：不绕过 Creem Moderation、不绕过模板规则、不暴露 provider/prompt 内部细节、不破坏点数幂等。

**Tech Stack:** Next.js, TypeScript, React, Tailwind CSS, Drizzle, Vitest, Testing Library, better-auth, Creem, existing job/billing/admin services.

---

## 0. 执行规则

本计划基于设计文档：

```text
docs/superpowers/specs/2026-06-17-public-mvp-trial-readiness-design.md
```

执行前必须阅读：

```text
AGENTS.md
docs/PRD.md
docs/IMPLEMENTATION_PLAN.md
docs/DEVELOPMENT_SPEC.md
docs/STYLE_PRESET_DESIGN.md
```

重要要求：

- 不要把 P1-P4 合成一个巨大提交。
- 每个 Task 完成后单独提交。
- 每个 Phase 完成后跑相关测试。
- Phase 4 完成后跑 `pnpm run typecheck`、`pnpm test`、`pnpm run build`。
- 准备给真实用户试用前再跑 `pnpm run verify:blockers`，本计划不强制在每个 phase 跑 blocker。
- 当前工作区可能已有 `next-env.d.ts` 自动生成改动；不要把无关生成改动混入本计划提交。

## 1. 文件边界

### 新增或修改：Trial Funnel

```text
src/server/trial/status.ts
src/app/api/trial/status/route.ts
src/components/workspace/trial-status-panel.tsx
src/components/workspace/workspace-app.tsx
src/components/jobs/job-upgrade-panel.tsx
src/components/jobs/*
src/app/(dashboard)/workspace/page.test.tsx
src/components/workspace/workspace-app.test.tsx
src/components/jobs/job-upgrade-panel.test.tsx
```

### 新增或修改：Public Site

```text
src/app/page.tsx
src/app/pricing/page.tsx
src/app/privacy/page.tsx
src/app/terms/page.tsx
src/app/faq/page.tsx
src/components/public/public-header.tsx
src/components/public/public-footer.tsx
src/components/public/cta-link.tsx
src/components/public/sample-gallery.tsx
src/components/public/public-pages.test.tsx
```

### 新增或修改：Funnel Analytics

```text
drizzle/0012_funnel_events.sql
drizzle/meta/_journal.json
src/lib/db/schema/analytics.ts
src/lib/db/schema/index.ts
src/server/analytics/funnel-events.ts
src/app/api/funnel/events/route.ts
src/server/admin/funnel.ts
src/app/api/admin/funnel/summary/route.ts
src/app/admin/funnel/page.tsx
src/components/admin/funnel-dashboard.tsx
src/server/analytics/funnel-events.test.ts
src/app/api/funnel/events/route.test.ts
src/server/admin/funnel.test.ts
```

### 新增或修改：Admin Ops

```text
drizzle/0013_admin_job_notes.sql
drizzle/meta/_journal.json
src/lib/db/schema/admin.ts
src/server/admin/jobs.ts
src/server/admin/job-notes.ts
src/app/api/admin/jobs/[id]/notes/route.ts
src/app/api/admin/jobs/[id]/release-credits/route.ts
src/app/admin/jobs/page.tsx
src/components/admin/job-failure-summary.tsx
src/components/admin/job-detail-panel.tsx
src/server/admin/jobs.test.ts
src/server/admin/job-notes.test.ts
src/components/admin/job-detail-panel.test.tsx
```

具体文件名可根据现有代码结构微调，但不得跨越上面责任边界。

---

## Phase 1：Trial Funnel

### Task 1.1：实现用户可见试用状态服务

**目标：** Workspace 能知道当前用户是否可试用，但不暴露内部风控细节。

**Files:**

- Create: `src/server/trial/status.ts`
- Create: `src/server/trial/status.test.ts`
- Create: `src/app/api/trial/status/route.ts`
- Create: `src/app/api/trial/status/route.test.ts`

- [ ] Step 1：写试用状态服务测试

覆盖：

- 没有历史试用，返回 `available`。
- 已有历史试用，返回 `used`。
- 风控拒绝或 eligibility deny，返回 `unavailable`。
- 返回值不包含 `riskScore`、hash、内部 reason codes。

建议返回类型：

```ts
export type TrialStatus =
  | {
      state: "available";
      message: string;
      limits: {
        durationSeconds: 8;
        qualityLabel: "低分辨率";
        audioLabel: "无音频";
        watermarkEnabled: true;
      };
    }
  | {
      state: "used" | "unavailable";
      message: string;
      limits: null;
    };
```

- [ ] Step 2：运行定点测试并确认失败

```bash
pnpm exec vitest run src/server/trial/status.test.ts src/app/api/trial/status/route.test.ts
```

Expected：测试因文件或函数不存在失败。

- [ ] Step 3：实现最小服务和 API route

服务端复用现有免费试用判断相关 store，不新增第二套风控规则。API route 必须要求登录。

用户文案：

```text
你有 1 次免费试用，可生成 8 秒带水印视频。
你的免费试用已使用。可以购买点数生成高清无水印视频。
当前账号暂时无法使用免费试用，可以购买点数继续生成。
```

- [ ] Step 4：运行测试

```bash
pnpm exec vitest run src/server/trial/status.test.ts src/app/api/trial/status/route.test.ts
```

Expected：通过。

- [ ] Step 5：提交

```bash
git add src/server/trial/status.ts src/server/trial/status.test.ts src/app/api/trial/status/route.ts src/app/api/trial/status/route.test.ts
git commit -m "feat: expose user trial status"
```

### Task 1.2：Workspace 显示试用状态并区分 CTA

**目标：** 用户进入 `/workspace?mode=trial&preset=minimal_studio` 后能看清试用状态和试用限制。

**Files:**

- Create: `src/components/workspace/trial-status-panel.tsx`
- Create: `src/components/workspace/trial-status-panel.test.tsx`
- Modify: `src/components/workspace/workspace-app.tsx`
- Modify: `src/components/workspace/workspace-app.test.tsx`

- [ ] Step 1：写组件测试

覆盖：

- `available` 显示 8 秒、低分辨率、无音频、带水印。
- `used` 显示购买点数入口文案。
- `unavailable` 显示统一不可用文案。
- 不显示内部 reason codes。

- [ ] Step 2：写 Workspace 测试

覆盖：

- trial mode 默认请求 `/api/trial/status`。
- 8 秒显示免费试用按钮。
- 16/24 秒不显示免费试用按钮或显示 disabled 说明。
- 付费生成按钮仍然存在。

- [ ] Step 3：运行定点测试并确认失败

```bash
pnpm exec vitest run src/components/workspace/trial-status-panel.test.tsx src/components/workspace/workspace-app.test.tsx
```

- [ ] Step 4：实现组件和 Workspace 接入

注意：

- 不要改变现有 `oneClickGenerate(true)` 试用创建逻辑。
- 不要让前端决定 trial eligibility；前端只展示服务端状态。
- 试用不可用时不要展示内部风控细节。

- [ ] Step 5：运行测试

```bash
pnpm exec vitest run src/components/workspace/trial-status-panel.test.tsx src/components/workspace/workspace-app.test.tsx
```

- [ ] Step 6：提交

```bash
git add src/components/workspace/trial-status-panel.tsx src/components/workspace/trial-status-panel.test.tsx src/components/workspace/workspace-app.tsx src/components/workspace/workspace-app.test.tsx
git commit -m "feat: show trial status in workspace"
```

### Task 1.3：任务详情增加试用升级入口

**目标：** 试用成片后，用户能自然进入购买点数或高清无水印生成路径。

**Files:**

- Create: `src/components/jobs/job-upgrade-panel.tsx`
- Create: `src/components/jobs/job-upgrade-panel.test.tsx`
- Modify existing job detail component/page after inspecting current structure.

- [ ] Step 1：定位任务详情组件

Run：

```bash
rg -n "billingMode|free_trial|download|JobDetail|job detail|watermark" src/components src/app
```

记录实际要修改的文件。

- [ ] Step 2：写升级面板测试

覆盖：

- `billingMode = free_trial` 且 `deliverable` 时显示“生成高清无水印版本”。
- `billingMode = paid` 不显示试用升级面板。
- 失败任务显示购买点数入口但不承诺成功。

- [ ] Step 3：运行定点测试并确认失败

```bash
pnpm exec vitest run src/components/jobs/job-upgrade-panel.test.tsx
```

- [ ] Step 4：实现升级面板并接入任务详情

MVP 行为：

- CTA 可先指向 `/pricing` 或 `/billing`。
- 不实现“一键复制旧任务重生成高清版”，避免扩大范围。

- [ ] Step 5：运行相关测试

```bash
pnpm exec vitest run src/components/jobs/job-upgrade-panel.test.tsx
```

如任务详情已有测试，同步运行对应测试。

- [ ] Step 6：提交

```bash
git add src/components/jobs/job-upgrade-panel.tsx src/components/jobs/job-upgrade-panel.test.tsx
git add <实际修改的任务详情文件>
git commit -m "feat: add trial upgrade panel"
```

### Phase 1 验收

Run：

```bash
pnpm exec vitest run src/server/trial/status.test.ts src/app/api/trial/status/route.test.ts src/components/workspace/trial-status-panel.test.tsx src/components/workspace/workspace-app.test.tsx src/components/jobs/job-upgrade-panel.test.tsx
pnpm run typecheck
```

---

## Phase 2：Public Site

### Task 2.1：重写 Landing 为试用转化页

**目标：** Landing 首屏清楚传达产品、试用和素材规则。

**Files:**

- Modify: `src/app/page.tsx`
- Create: `src/components/public/sample-gallery.tsx`
- Create: `src/components/public/sample-gallery.test.tsx`
- Modify: `src/components/public/cta-link.test.ts`

- [ ] Step 1：写 Public CTA 和 sample gallery 测试

覆盖：

- Trial CTA href 仍是 `/login?next=%2Fworkspace%3Fmode%3Dtrial%26preset%3Dminimal_studio`。
- sample gallery 有样例时展示样例。
- sample gallery 无样例时展示真实空状态，不伪造案例。

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/components/public/cta-link.test.ts src/components/public/sample-gallery.test.tsx
```

- [ ] Step 3：实现 Landing 文案和样例组件

首屏必须包含：

```text
把服装商品图变成可发布的短视频
免费生成 1 条试用视频
```

规则说明必须包含：

```text
无背面图不生成背面
无细节图不生成细节特写
免费试用：8 秒、低分辨率、无音频、带水印
```

- [ ] Step 4：运行测试

```bash
pnpm exec vitest run src/components/public/cta-link.test.ts src/components/public/sample-gallery.test.tsx
```

- [ ] Step 5：提交

```bash
git add src/app/page.tsx src/components/public/sample-gallery.tsx src/components/public/sample-gallery.test.tsx src/components/public/cta-link.test.ts
git commit -m "feat: improve public landing trial page"
```

### Task 2.2：完善 Pricing

**目标：** Pricing 能解释点数、试用、失败退款和规格差异。

**Files:**

- Modify: `src/app/pricing/page.tsx`
- Create or modify relevant pricing tests.

- [ ] Step 1：检查现有 pricing 页面

```bash
Get-Content -Path src/app/pricing/page.tsx
```

- [ ] Step 2：写测试

覆盖页面包含：

```text
Starter
Creator
Studio
8 秒
16 秒
24 秒
免费试用
失败会释放或退回点数
```

- [ ] Step 3：运行测试并确认失败

```bash
pnpm exec vitest run <pricing test path>
```

- [ ] Step 4：实现 Pricing 页面

保持中文 MVP，不做复杂 toggle。

- [ ] Step 5：运行测试并提交

```bash
pnpm exec vitest run <pricing test path>
git add src/app/pricing/page.tsx <pricing test path>
git commit -m "feat: clarify pricing and trial rules"
```

### Task 2.3：补齐 Privacy、Terms、FAQ

**目标：** 公开试用前，用户能看到基础隐私、条款和常见问题。

**Files:**

- Modify: `src/app/privacy/page.tsx`
- Modify: `src/app/terms/page.tsx`
- Create: `src/app/faq/page.tsx`
- Modify: `src/components/public/public-header.tsx`
- Modify: `src/components/public/public-footer.tsx`
- Create or modify public page tests.

- [ ] Step 1：写页面内容测试

Privacy 必须包含：

```text
上传图片
模型调用
Cloudflare R2
保存周期
删除
```

Terms 必须包含：

```text
禁止内容
试用限制
生成失败
退款
用户上传素材
```

FAQ 必须包含：

```text
需要上传什么图片
为什么不能生成背面
多久生成
试用和付费有什么区别
```

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run <public page test path>
```

- [ ] Step 3：实现页面与导航

注意：

- 不承诺 100% 无异常。
- Terms/Privacy 标明 MVP 文案不是最终法律意见。
- Header/Footer 加 FAQ 链接。

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run <public page test path>
git add src/app/privacy/page.tsx src/app/terms/page.tsx src/app/faq/page.tsx src/components/public/public-header.tsx src/components/public/public-footer.tsx <public page test path>
git commit -m "feat: add public trust pages"
```

### Phase 2 验收

Run：

```bash
pnpm exec vitest run src/components/public/cta-link.test.ts src/components/public/sample-gallery.test.tsx <public page tests>
pnpm run typecheck
```

---

## Phase 3：Funnel Analytics

### Task 3.1：新增 funnel_events schema 和迁移

**目标：** 建立产品漏斗事件表。

**Files:**

- Create: `drizzle/0012_funnel_events.sql`
- Modify: `drizzle/meta/_journal.json`
- Create/Modify: `src/lib/db/schema/analytics.ts`
- Modify: `src/lib/db/schema/index.ts`
- Modify: `src/lib/db/migrations.test.ts`

- [ ] Step 1：写迁移测试

断言 journal 包含 `0012_funnel_events`，SQL 包含 `funnel_events`、`event_name`、`metadata`、`created_at`。

- [ ] Step 2：运行迁移测试并确认失败

```bash
pnpm exec vitest run src/lib/db/migrations.test.ts
```

- [ ] Step 3：新增 SQL 和 schema

SQL：

```sql
CREATE TABLE IF NOT EXISTS "funnel_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text,
  "anonymous_id" text,
  "session_id" text,
  "event_name" text NOT NULL,
  "source" text NOT NULL,
  "path" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "funnel_events_created_at_idx"
ON "funnel_events" ("created_at");

CREATE INDEX IF NOT EXISTS "funnel_events_event_name_idx"
ON "funnel_events" ("event_name");

CREATE INDEX IF NOT EXISTS "funnel_events_user_id_idx"
ON "funnel_events" ("user_id");

CREATE INDEX IF NOT EXISTS "funnel_events_anonymous_id_idx"
ON "funnel_events" ("anonymous_id");
```

- [ ] Step 4：运行迁移测试

```bash
pnpm exec vitest run src/lib/db/migrations.test.ts
```

- [ ] Step 5：提交

```bash
git add drizzle/0012_funnel_events.sql drizzle/meta/_journal.json src/lib/db/schema/analytics.ts src/lib/db/schema/index.ts src/lib/db/migrations.test.ts
git commit -m "feat: add funnel event schema"
```

### Task 3.2：实现 funnel event 记录服务和 API

**目标：** 支持白名单事件写入，过滤敏感 metadata。

**Files:**

- Create: `src/server/analytics/funnel-events.ts`
- Create: `src/server/analytics/funnel-events.test.ts`
- Create: `src/app/api/funnel/events/route.ts`
- Create: `src/app/api/funnel/events/route.test.ts`

- [ ] Step 1：写服务测试

覆盖：

- 允许白名单事件。
- 拒绝未知事件。
- metadata 只保留安全 key。
- 删除 `prompt`、`signedUrl`、`apiKey`、`providerResponse`、`riskScore`。

建议安全 metadata key：

```ts
const allowedMetadataKeys = [
  "presetId",
  "durationSeconds",
  "aspectRatio",
  "billingMode",
  "jobId",
  "sourcePage",
  "status",
  "reasonCategory",
] as const;
```

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/server/analytics/funnel-events.test.ts src/app/api/funnel/events/route.test.ts
```

- [ ] Step 3：实现服务和 API

API route 支持未登录用户传 `anonymousId`。登录用户从 session 写 `userId`。

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run src/server/analytics/funnel-events.test.ts src/app/api/funnel/events/route.test.ts
git add src/server/analytics/funnel-events.ts src/server/analytics/funnel-events.test.ts src/app/api/funnel/events/route.ts src/app/api/funnel/events/route.test.ts
git commit -m "feat: record funnel events"
```

### Task 3.3：接入关键服务端事件

**目标：** 关键业务动作由服务端记录，不只依赖前端点击。

**Files:**

- Modify job creation route/service.
- Modify storyboard generation/confirmation service.
- Modify billing checkout/webhook service.
- Modify download route if available.
- Modify relevant tests.

- [ ] Step 1：定位现有业务入口

Run：

```bash
rg -n "createVideoJobWithAssets|confirmStoryboard|checkout|payment|download|deliverable|capture" src/server src/app
```

- [ ] Step 2：为每个入口补测试

至少覆盖：

- job created 写 `job_created`。
- trial job 写 `trial_generation_started`。
- paid job 写 `paid_generation_started`。
- storyboard confirm 写 `storyboard_confirmed`。
- payment success 写 `payment_succeeded`。
- download 写 `video_downloaded`。

- [ ] Step 3：运行相关测试并确认失败

```bash
pnpm exec vitest run <affected tests>
```

- [ ] Step 4：实现事件写入

注意：

- 事件写入失败不能阻断主业务，但必须记录 server log 或可观察错误。
- 不要把完整 prompt 写入 metadata。

- [ ] Step 5：运行相关测试并提交

```bash
pnpm exec vitest run <affected tests>
git add <affected files>
git commit -m "feat: track core funnel events"
```

### Task 3.4：后台 Funnel Summary

**目标：** 管理员能看到 MVP 漏斗统计。

**Files:**

- Create: `src/server/admin/funnel.ts`
- Create: `src/server/admin/funnel.test.ts`
- Create: `src/app/api/admin/funnel/summary/route.ts`
- Create: `src/app/admin/funnel/page.tsx`
- Create: `src/components/admin/funnel-dashboard.tsx`
- Create: `src/components/admin/funnel-dashboard.test.tsx`

- [ ] Step 1：写统计服务测试

输入一组事件，输出：

- event counts。
- workspace to upload conversion。
- job created to deliverable conversion。
- trial to checkout conversion。
- preset summary。

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/server/admin/funnel.test.ts src/components/admin/funnel-dashboard.test.tsx
```

- [ ] Step 3：实现服务、API 和页面

页面可简单展示卡片和表格，不做复杂图表。

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run src/server/admin/funnel.test.ts src/components/admin/funnel-dashboard.test.tsx
git add src/server/admin/funnel.ts src/server/admin/funnel.test.ts src/app/api/admin/funnel/summary/route.ts src/app/admin/funnel/page.tsx src/components/admin/funnel-dashboard.tsx src/components/admin/funnel-dashboard.test.tsx
git commit -m "feat: add admin funnel summary"
```

### Phase 3 验收

Run：

```bash
pnpm exec vitest run src/lib/db/migrations.test.ts src/server/analytics/funnel-events.test.ts src/app/api/funnel/events/route.test.ts src/server/admin/funnel.test.ts src/components/admin/funnel-dashboard.test.tsx
pnpm run typecheck
```

---

## Phase 4：Admin Ops

### Task 4.1：增强 admin job 筛选和失败队列

**目标：** 管理员能按 status、billing mode、preset、is_test 找到失败任务。

**Files:**

- Modify: `src/server/admin/jobs.ts`
- Modify: `src/server/admin/jobs.test.ts`
- Modify: `src/app/admin/jobs/page.tsx`
- Modify related admin jobs components.

- [ ] Step 1：写服务测试

覆盖：

- 按 status 筛选。
- 按 billingMode 筛选。
- 按 presetId 筛选。
- 按 isTest 筛选。
- 失败队列返回 failed、blocked、post_qa_failed、segment_failed 等需要处理的任务。

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/server/admin/jobs.test.ts
```

- [ ] Step 3：实现筛选参数和页面控件

注意：

- 不要破坏现有 admin jobs 列表。
- 查询参数要可复制分享。

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run src/server/admin/jobs.test.ts
git add src/server/admin/jobs.ts src/server/admin/jobs.test.ts src/app/admin/jobs/page.tsx <affected admin components>
git commit -m "feat: improve admin job filters"
```

### Task 4.2：任务详情失败摘要

**目标：** 管理员打开任务能快速看到失败在哪里和账务是否需要处理。

**Files:**

- Create: `src/components/admin/job-failure-summary.tsx`
- Create: `src/components/admin/job-failure-summary.test.tsx`
- Modify: `src/components/admin/job-detail-panel.tsx`
- Modify: `src/components/admin/job-detail-panel.test.tsx`
- Modify: `src/server/admin/jobs.ts` if detail payload lacks fields.

- [ ] Step 1：写组件测试

覆盖：

- 显示 job status、user visible status、failure reason、last error。
- 显示 billing mode、credit cost、reserved ledger id。
- 显示 segment/stitch/post-qa 最新状态摘要。
- 没有失败时显示“暂无失败摘要”或不渲染。

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/components/admin/job-failure-summary.test.tsx src/components/admin/job-detail-panel.test.tsx
```

- [ ] Step 3：实现组件和详情接入

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run src/components/admin/job-failure-summary.test.tsx src/components/admin/job-detail-panel.test.tsx
git add src/components/admin/job-failure-summary.tsx src/components/admin/job-failure-summary.test.tsx src/components/admin/job-detail-panel.tsx src/components/admin/job-detail-panel.test.tsx src/server/admin/jobs.ts src/server/admin/jobs.test.ts
git commit -m "feat: show admin job failure summary"
```

### Task 4.3：管理员备注

**目标：** 管理员能给任务写内部备注，备注可审计。

**Files:**

- Create: `drizzle/0013_admin_job_notes.sql`
- Modify: `drizzle/meta/_journal.json`
- Modify/Create schema file for admin notes.
- Create: `src/server/admin/job-notes.ts`
- Create: `src/server/admin/job-notes.test.ts`
- Create: `src/app/api/admin/jobs/[id]/notes/route.ts`
- Create route test.
- Modify job detail panel to show notes.

- [ ] Step 1：写迁移和服务测试

覆盖：

- 创建 note。
- list notes。
- 创建 note 同时写 admin audit log。
- 非 admin/operator 不能写。

- [ ] Step 2：运行测试并确认失败

```bash
pnpm exec vitest run src/lib/db/migrations.test.ts src/server/admin/job-notes.test.ts <notes route test>
```

- [ ] Step 3：实现 SQL、schema、service、route 和 UI

SQL：

```sql
CREATE TABLE IF NOT EXISTS "admin_job_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "admin_user_id" text NOT NULL,
  "note" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "admin_job_notes_job_id_idx"
ON "admin_job_notes" ("job_id");
```

- [ ] Step 4：运行测试并提交

```bash
pnpm exec vitest run src/lib/db/migrations.test.ts src/server/admin/job-notes.test.ts <notes route test>
git add drizzle/0013_admin_job_notes.sql drizzle/meta/_journal.json <affected schema/service/route/ui/test files>
git commit -m "feat: add admin job notes"
```

### Task 4.4：点数释放操作入口

**目标：** 管理员能对卡住或失败任务执行幂等释放冻结点数，并写审计。

**Files:**

- Create or modify: `src/app/api/admin/jobs/[id]/release-credits/route.ts`
- Modify existing credit release service if needed.
- Modify: `src/components/admin/job-detail-panel.tsx`
- Modify tests.

- [ ] Step 1：定位现有 release/refund 服务

Run：

```bash
rg -n "release|refund|reservedLedgerId|credit_ledger|admin_audit" src/server src/app
```

- [ ] Step 2：写 route/service 测试

覆盖：

- 有 reserved ledger 的 failed job 可以 release。
- 重复 release 幂等，不重复写点数。
- 成功写 admin audit log。
- deliverable 或已 capture 的任务不能 release。
- 非 admin/operator 拒绝。

- [ ] Step 3：运行测试并确认失败

```bash
pnpm exec vitest run <release route/service tests>
```

- [ ] Step 4：实现 route 和 UI 按钮

注意：

- 如果现有账务服务已支持 release，复用现有服务。
- 不要直接改余额。
- 不要跳过 ledger。

- [ ] Step 5：运行测试并提交

```bash
pnpm exec vitest run <release route/service tests> src/components/admin/job-detail-panel.test.tsx
git add <affected files>
git commit -m "feat: add admin credit release action"
```

### Phase 4 验收

Run：

```bash
pnpm exec vitest run src/server/admin/jobs.test.ts src/components/admin/job-failure-summary.test.tsx src/components/admin/job-detail-panel.test.tsx src/server/admin/job-notes.test.ts <notes route test> <release route/service tests>
pnpm run typecheck
```

---

## Final Verification

完成所有 Phase 后运行：

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

如果准备把功能交给真实用户试用，再运行：

```bash
pnpm run verify:blockers
```

如果 `verify:blockers` 依赖真实环境数据而本地不可跑，必须在验收报告里说明缺少的环境和替代验证证据。

## 提交与推送建议

每个 Task 一个提交，提交信息建议：

```text
feat: expose user trial status
feat: show trial status in workspace
feat: add trial upgrade panel
feat: improve public landing trial page
feat: clarify pricing and trial rules
feat: add public trust pages
feat: add funnel event schema
feat: record funnel events
feat: track core funnel events
feat: add admin funnel summary
feat: improve admin job filters
feat: show admin job failure summary
feat: add admin job notes
feat: add admin credit release action
```

不要把 `next-env.d.ts` 自动生成变化混进功能提交。若它持续变更，单独开 `fix: restore next env routes reference` 处理。

## 验收清单

- [ ] Landing CTA 到 login next 到 workspace trial 参数完整保留。
- [ ] Workspace 显示试用状态。
- [ ] 免费试用和付费生成入口区分清楚。
- [ ] 试用任务详情显示升级入口。
- [ ] Landing、Pricing、Privacy、Terms、FAQ 可访问。
- [ ] Public 页面不伪造案例、不承诺 100% 无异常。
- [ ] Funnel events 不记录敏感 prompt、signed URL、API Key 或内部风控细节。
- [ ] Admin funnel summary 能看核心事件统计。
- [ ] Admin jobs 支持 status、billing mode、preset、is_test 筛选。
- [ ] 失败任务能在后台快速定位。
- [ ] 管理员备注写入审计。
- [ ] 点数释放操作幂等且写 ledger/audit。
- [ ] `pnpm run typecheck` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm run build` 通过。

