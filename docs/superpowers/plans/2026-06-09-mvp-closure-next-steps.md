# MVP Closure Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前“后端/API 基本齐全”的项目推进到可真实验收的 MVP 闭环：真实生成、真实 Post-QA、真实扣点/释放、用户可操作前台、管理员可排障后台。

**Architecture:** 继续遵守 PRD 和技术架构：Next.js/Vercel 只负责页面、API 和短任务推进；Cloud Run `stitch-worker` 负责 ffmpeg 拼接与抽帧；Neon/Drizzle 作为任务状态机、账本和审计的唯一真实来源。所有进入生成链路的用户 prompt 和最终视频 prompt 必须经过 Creem Moderation，Post-QA 通过后才允许 `capture` 点数和下载。

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Radix UI, Drizzle, Neon Postgres, better-auth, Resend, Creem, Cloudflare R2, Cloud Run, ffmpeg, DeepSeek, vision provider, APIMart PixVerse V6, EvoLink fast backup, Vitest.

---

## 当前判断

当前项目已经越过“初始化”阶段，后端 API 与内部 worker 链路覆盖很广，但不能按文件数量判断完成度。

优先级必须按真实风险排序：

1. 先恢复测试绿色基线。
2. 先实现 Creem checkout/webhook 的功能边界，但 Creem 支付真实测试等账号/申请通过后再做。
3. Creem Moderation 必须现在接入生成链路，不能和支付测试一起后置。
4. 再证明不依赖 Creem 支付成功 mock 的真实后端 smoke 能跑到 `deliverable` 或明确失败路径。
5. 然后做用户前台工作台，让用户能完成上传、选模板、确认分镜、看进度、下载。
6. 再做管理员 UI，让运营能排障、补偿、暂停模板/Key。
7. 最后做 staging 部署验收和真实用例清单。

不要先做新模板、批量 SKU、花哨 Landing、复杂运营看板。这些会稀释 MVP 风险验证。

---

## Task 1: 恢复工程基线

**Files:**
- Modify: `src/lib/providers/vision/client.ts`
- Modify: `src/lib/providers/vision/client.test.ts`
- Check: `package.json`
- Check: `.env.example`

- [ ] **Step 1: 固定当前测试红灯**

运行：

```bash
npm test -- src/lib/providers/vision/client.test.ts
```

预期：当前 responses endpoint 测试失败，失败点是 `body.stream` 期望值与实现不一致。

- [ ] **Step 2: 明确 responses API 请求体契约**

根据项目当前实现选择一种契约，并让测试与实现一致：

```ts
const body = responsesApi
  ? {
      model: config.model,
      stream: false,
      input: responsesInput(input.imageUrls),
    }
  : {
      model: config.model,
      stream: false,
      response_format: { type: "json_object" },
      messages: chatMessages(input.imageUrls),
    };
```

如果目标 provider 的 responses API 不接受 `stream`，就改测试，不要为了测试硬塞无效字段。

- [ ] **Step 3: 跑基础验证**

运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

预期：

- `lint` 通过。
- `typecheck` 通过。
- `test` 全部通过。
- `build` 通过。

- [ ] **Step 4: 清理工作区基线**

运行：

```bash
git status --short
git diff --stat
```

预期：只保留本任务相关改动，`test-assets/` 如果是 smoke 产物，要决定是否纳入 fixture 或加入忽略策略。

---

## Task 2: 后端真实闭环 Smoke

**Files:**
- Check: `scripts/stitch-smoke.mjs`
- Check: `scripts/backend-smoke.mjs`
- Check: `scripts/lib/backend-smoke-utils.mjs`
- Check: `docs/API_TEST_STATUS.md`
- Check: `docs/API_FLOW.md`

- [ ] **Step 1: 检查运行时配置就绪度**

运行：

```bash
npm run build
```

启动应用后访问：

```text
GET /api/health
```

预期：`ready = true`，或明确列出缺失环境变量。缺失项必须按模块归类：database、auth、storage、internalSecurity、stitchWorker、billing、aiProviders。

注意：Creem checkout/webhook 如果账号申请尚未通过，可以在 health 中显示为 payment pending，但不能让 Creem Moderation pending。生成链路的 moderation key 缺失时必须阻止生成。

- [ ] **Step 2: 跑 stitch smoke**

运行：

```bash
npm run smoke:stitch
```

预期：

- Cloud Run health 通过。
- stitch job 创建成功。
- R2 存在 `stitched/final.mp4`。
- R2 存在 `qa/frames/*.jpg`。
- 主应用 callback 后 `video_jobs.status = post_qa_queued`。

- [ ] **Step 3: 跑完整 backend smoke**

运行：

```bash
npm run smoke:backend
```

预期优先目标：

- 使用预置测试钱包、后台补点或数据库测试种子提供点数，不通过 Creem mock 支付制造余额。
- Post-QA 使用真实视觉 provider 跑到 `post_qa_passed`。
- `video_jobs.status = deliverable`。
- `credit_ledger` 写入 `capture`。
- 用户下载 URL 只对任务 owner 可生成。

可接受失败目标：

- 如果 provider 失败，必须进入可解释状态。
- 如果 Post-QA 失败，必须进入 `failed_released` 或明确的待人工处理状态。
- 不允许卡在无锁、无错误、无下一步的中间状态。

- [ ] **Step 4: 更新真实验收记录**

更新 `docs/API_TEST_STATUS.md`，记录：

- smoke 执行日期。
- job id。
- stitch job id。
- final video R2 key。
- QA frame R2 keys。
- final `video_jobs.status`。
- `credit_ledger` 结果。
- 失败原因和下一步。

---

## Task 3: Creem 支付功能实现与 Moderation 强制接入

**Files:**
- Check: `src/lib/providers/creem/client.ts`
- Check: `src/lib/providers/creem/webhook.ts`
- Check: `src/lib/providers/creem/moderation.ts`
- Check: `src/app/api/billing/checkout/route.ts`
- Check: `src/app/api/webhooks/creem/route.ts`
- Check: `src/server/moderation/check-prompt.ts`
- Check: `src/server/moderation/results.ts`
- Check: `src/lib/credits/ledger.ts`
- Check: `src/server/post-qa/resolve.ts`
- Check: `src/app/api/jobs/[id]/confirm/route.ts`
- Test: related `*.test.ts`

- [ ] **Step 1: 实现 Creem checkout 功能边界**

实现或复核：

- `POST /api/billing/checkout` 只创建真实 Creem checkout 请求。
- 未配置 `CREEM_API_KEY` 时返回 provider unavailable，不伪造 checkout URL。
- 请求体使用站内点数包配置，不让前端传任意金额。
- 创建 checkout 前写入或准备订单记录，保存 external checkout/order id 时必须可幂等关联。

现阶段不做：

- 不做 Creem mock checkout 成功测试。
- 不做假支付成功路径。
- 不写“测试通过”结论，等 Creem 申请通过后再做真实测试。

- [ ] **Step 2: 实现 Creem webhook 功能边界**

实现或复核：

- `POST /api/webhooks/creem` 校验真实 Creem 签名。
- 签名缺失或错误时拒绝。
- webhook 事件按 external event/order id 幂等处理。
- 支付成功后写 `orders` 和 `credit_ledger.purchase`。
- 重放 webhook 不重复充值。

现阶段不做：

- 不做 Creem mock webhook 成功测试。
- 不手写假 webhook 绕过签名来证明充值成功。
- 真实 webhook 验收等 Creem 账号/产品申请通过后补做。

- [ ] **Step 3: 接入 Creem Moderation allow 路径**

创建一个测试任务，使用安全 prompt。

预期：

- 用户输入 moderation 记录为 `allow`。
- 最终视频 prompt moderation 记录为 `allow`。
- moderation 通过后才允许进入余额检查与 `reserve`。
- 不允许因为 Creem 支付尚未通过申请而跳过 moderation。

- [ ] **Step 4: 接入 Creem Moderation flag/deny 路径**

使用 Creem Moderation 真实测试能力或官方测试用例触发 `flag` 和 `deny`。

预期：

- `flag` 按 `deny` 处理。
- 不冻结点数。
- 不创建或不提交视频 segment。
- `prompt_moderation_results` 保存 decision 和错误摘要。

- [ ] **Step 5: 接入 moderation provider failure fail closed**

实现超时、5xx、网络错误处理。这里可以通过代码路径和真实失败环境验证，但不能引入“失败时假 allow”的 mock。

预期：

- fail closed。
- 不冻结点数。
- 用户得到可理解错误。
- 后台能看到 moderation 失败原因。

- [ ] **Step 6: 演练供应商失败释放点数**

让 segment 生成或 Post-QA 走失败路径。

预期：

- 失败时不 `capture`。
- 未交付任务释放冻结点数。
- `credit_ledger.release` 或对应失败流水存在。
- `job_state_events` 记录状态变化。

- [ ] **Step 7: 标记 Creem 支付真实测试为待申请通过**

更新 `docs/API_TEST_STATUS.md`：

- Creem checkout：功能已实现，真实测试 pending Creem approval。
- Creem webhook：功能已实现，真实测试 pending Creem approval。
- Creem mock 支付测试：明确不做。
- Creem Moderation：必须列为当前生成链路必测项，不得 pending 到支付申请之后。

---

## Task 4: 用户前台工作台 MVP

**Files:**
- Create: `src/app/(dashboard)/workspace/page.tsx`
- Create: `src/app/(dashboard)/jobs/page.tsx`
- Create: `src/app/(dashboard)/jobs/[id]/page.tsx`
- Create: `src/app/(dashboard)/billing/page.tsx`
- Create: `src/components/workspace/upload-panel.tsx`
- Create: `src/components/workspace/spec-selector.tsx`
- Create: `src/components/workspace/template-picker.tsx`
- Create: `src/components/workspace/storyboard-confirmation.tsx`
- Create: `src/components/jobs/job-progress.tsx`
- Create: `src/components/jobs/job-list.tsx`
- Create: `src/components/billing/credit-ledger.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 定义前台页面边界**

页面必须覆盖：

- `/workspace`：生成工作台。
- `/jobs`：任务历史，只显示完整视频任务。
- `/jobs/[id]`：任务详情和下载。
- `/billing`：点数余额和流水。

登录后主入口应是 `/workspace`，不要继续让用户落在开发状态页。

- [ ] **Step 2: 实现上传到任务创建**

工作台调用：

- `POST /api/uploads/presign`
- `POST /api/jobs`

预期：

- 用户上传正面图后创建 job。
- UI 显示上传状态、文件名、错误原因。
- 不暴露 R2 key、provider key、内部 secret。

- [ ] **Step 3: 实现素材分析与模板选择**

工作台调用：

- `POST /api/jobs/[id]/analyze`
- `GET /api/jobs/[id]`

UI 必须展示：

- 推荐模板。
- 可选模板。
- 不可用模板。
- 不可用原因。
- 素材缺口建议。

硬约束：

- 无背面图时 `back_display` 和 `front_to_back_cut` 不能选。
- 无细节图时细节模板不能选。
- 免费试用只能选低风险模板。

- [ ] **Step 4: 实现分镜生成与确认**

工作台调用：

- `POST /api/jobs/[id]/storyboard`
- `POST /api/jobs/[id]/confirm`

UI 必须展示：

- 8/16/24 秒规格。
- 9:16 / 1:1 / 16:9 比例。
- 每个 8 秒片段摘要。
- 点数消耗。
- 风险提示。
- 确认后冻结点数说明。
- 如果 Creem 支付尚未通过申请，购买点数入口可显示“支付即将开放/待开通”，但已拥有点数、试用点数或后台补点用户仍可走生成链路。
- 生成确认必须经过 Creem Moderation，不能因为支付待开通而跳过。

- [ ] **Step 5: 实现进度与下载**

任务详情调用：

- `GET /api/jobs/[id]/progress`
- `GET /api/jobs/[id]`
- `GET /api/files/signed-url`

UI 必须展示：

- “片段 2/3 生成中”这类用户可理解进度。
- 质检中状态。
- 可下载状态。
- 失败和退款/释放状态。

用户侧不要默认展示每个 8 秒片段下载。

- [ ] **Step 6: 前台验收**

运行：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

人工验收：

- 上传一组正面图。
- 看到背面模板不可用。
- 生成分镜草稿。
- 确认分镜。
- 查看进度。
- 任务完成后下载完整视频。

---

## Task 5: 管理员后台 MVP

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/app/admin/jobs/page.tsx`
- Create: `src/app/admin/jobs/[id]/page.tsx`
- Create: `src/app/admin/providers/page.tsx`
- Create: `src/app/admin/billing/page.tsx`
- Create: `src/app/admin/templates/page.tsx`
- Create: `src/components/admin/admin-shell.tsx`
- Create: `src/components/admin/job-detail-panel.tsx`
- Create: `src/components/admin/provider-table.tsx`
- Create: `src/components/admin/billing-table.tsx`
- Create: `src/components/admin/template-status-table.tsx`

- [ ] **Step 1: 建立后台导航**

后台首批只做排障必需模块：

- 任务管理。
- 异常任务。
- Provider/Key。
- 模型路由。
- 模板状态。
- 点数与订单。

不要先做花哨 Dashboard。后台第一价值是定位失败步骤。

- [ ] **Step 2: 任务详情页**

调用：

- `GET /api/admin/jobs/[id]`

必须展示：

- 上传素材。
- 素材识别 JSON。
- 推荐/可选/禁用模板。
- 用户选择模板。
- DeepSeek 分镜 JSON。
- 每个 segment 状态。
- 每段 prompt。
- 供应商 task ID。
- stitch 结果。
- Post-QA 结果。
- provider call logs。
- credit ledger。
- state events。

- [ ] **Step 3: 后台补偿操作**

接入：

- `POST /api/admin/segments/[id]/retry`
- `POST /api/admin/jobs/[id]/release-credits`
- `POST /api/admin/credits/adjust`
- `POST /api/admin/templates/status`
- `POST /api/admin/provider-keys/[id]/status`
- `POST /api/admin/model-routes/[id]`

预期：

- 每个敏感操作必须要求填写原因。
- 操作后能在 `admin_audit_logs` 查到。
- operator 不能改价格、完整 key 或高风险路由。

- [ ] **Step 4: 后台验收**

人工验收：

- 找到一个成功任务，确认能看到完整链路。
- 找到一个失败任务，确认能定位失败步骤。
- 重试一个失败 segment。
- 标记一个任务不可交付并释放点数。
- 暂停一个模板。
- 暂停一个 provider key。

---

## Task 6: Staging 部署验收

**Files:**
- Check: `docs/deployment/cloud-run-stitch.md`
- Check: `cloudbuild.stitch-worker.yaml`
- Check: `docs/API_TEST_STATUS.md`
- Check: `docs/API_FLOW.md`
- Check: `.env.example`

- [ ] **Step 1: Staging 环境变量验收**

确认 staging 配置：

- Neon staging database。
- R2 staging bucket。
- Creem checkout/webhook key：如果账号申请尚未通过，标记为 pending，不作为当前非支付生成链路阻断项。
- Creem moderation key：必须配置，生成链路不可 pending。
- DeepSeek key。
- Vision provider key。
- EvoLink key。
- Cloud Run stitch URL 和 secret。
- cron secret。

- [ ] **Step 2: 数据库 migration 验收**

运行：

```bash
npm run db:migrate
```

预期：空 staging 库可以成功迁移，核心表存在。

- [ ] **Step 3: Cloud Run 验收**

按 `docs/deployment/cloud-run-stitch.md` 部署。

预期：

- `GET {CLOUD_RUN_STITCH_URL}/health` 成功。
- 主应用能触发 stitch job。
- Cloud Run 能 callback 主应用。

- [ ] **Step 4: 端到端用例验收**

真实跑通：

- 免费试用 8 秒低风险模板。
- 使用已存在点数、后台补点或测试钱包跑通 8 秒。
- 使用已存在点数、后台补点或测试钱包跑通 16 秒。
- 使用已存在点数、后台补点或测试钱包跑通 24 秒。
- 无背面图时背面模板不可用。
- 有背面图时背面展示可选。
- 无细节图时细节模板不可用。
- Creem moderation 拦截。
- 供应商失败释放点数。
- Post-QA 失败进入释放或退款路径。
- 管理员可查看完整审计链路。

- [ ] **Step 5: 上线阻断项复核**

任何一项存在都不能进入生产：

- Creem 支付申请通过并进入正式收款前，checkout/webhook 真实测试未完成。
- 支付 webhook 实现不具备幂等设计。
- 点数可重复扣除。
- 视频模型调用没有日志。
- Creem Moderation 可绕过。
- 供应商失败不释放点数。
- Post-QA 通过前用户可下载。
- 生成结果没有转存 R2。
- API Key 明文暴露。
- 普通用户可以关闭 Post-QA。
- Cloud Run 拼接失败无法追踪。

---

## 计划自检

覆盖到的 PRD/SPEC 核心要求：

- 用户上传素材、素材分析、模板推荐、禁用原因。
- DeepSeek 分镜和确认。
- Creem Moderation 强制门禁。
- Creem checkout/webhook 功能实现，真实支付测试等待 Creem 申请通过。
- 不做 Creem mock 支付成功测试。
- 点数 reserve/capture/release。
- EvoLink segment 生成。
- Cloud Run 拼接与抽帧。
- Post-QA 通过后才交付。
- 用户任务历史和下载。
- 管理员排障和审计。
- staging 真实验收。

暂不纳入下一步：

- 批量 SKU。
- 公开 4K。
- 复杂真人走秀。
- 月订阅。
- 团队协作。
- 复杂营销首页。

这些不做不是偷懒，是保护 MVP 验证不要被范围膨胀拖死。
