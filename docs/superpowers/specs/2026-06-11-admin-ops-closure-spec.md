# Admin Ops Closure SPEC

**日期：** 2026-06-11

**目标：** 把现有管理员后台从“开发者可看 JSON 的工程排障页”推进到“管理员能在 30 秒内定位任务卡点、执行安全补偿、留下审计记录”的 MVP 运维闭环。

**背景：** `docs/superpowers/plans/2026-06-09-mvp-closure-next-steps.md` 中的管理员后台任务已经部分过期。当前代码已经存在 `/admin`、`/admin/jobs`、`/admin/jobs/[id]`、`/admin/providers`、`/admin/templates`、`/admin/billing` 以及多组 admin API。下一步不要重复创建后台骨架，而是补齐排障视图、异常队列、操作安全和真实验收记录。

---

## 1. 核心判断

先做后台是合理的，但这里的“后台”必须定义为 **Admin Ops Closure**：

- 任务卡住时，管理员能判断卡在哪个阶段。
- 任务失败时，管理员能看到 provider、segment、stitch、Post-QA、账本、状态事件。
- 管理员执行重试、重开 Post-QA、释放冻结点数、补点、暂停模板或 provider key 时，必须填写原因并写审计。
- 后台只展示排障必需信息，不做花哨 Dashboard。

不要做：

- 不要先做经营大屏、复杂图表、GMV 指标。
- 不要做批量 SKU、模板市场、复杂用户管理。
- 不要新增绕过 Post-QA 或绕过 Creem Moderation 的管理员捷径。
- 不要让后台暴露完整 API Key、R2 secret、provider secret。

---

## 2. 当前代码基线

新 session 开始前先确认这些文件存在，并基于现有实现增量改：

- `src/app/admin/page.tsx`
- `src/app/admin/jobs/page.tsx`
- `src/app/admin/jobs/[id]/page.tsx`
- `src/app/admin/providers/page.tsx`
- `src/app/admin/templates/page.tsx`
- `src/app/admin/billing/page.tsx`
- `src/components/admin/admin-shell.tsx`
- `src/components/admin/job-detail-panel.tsx`
- `src/components/admin/action-form.tsx`
- `src/server/admin/list-jobs.ts`
- `src/server/admin/jobs.ts`
- `src/server/admin/job-actions.ts`
- `src/server/admin/providers.ts`
- `src/server/admin/billing.ts`
- `src/server/admin/audit.ts`
- `src/app/api/admin/jobs/[id]/route.ts`
- `src/app/api/admin/jobs/[id]/reopen-post-qa/route.ts`
- `src/app/api/admin/jobs/[id]/release-credits/route.ts`
- `src/app/api/admin/segments/[id]/retry/route.ts`
- `src/app/api/admin/credits/adjust/route.ts`
- `src/app/api/admin/templates/status/route.ts`
- `src/app/api/admin/provider-keys/[id]/status/route.ts`
- `src/app/api/admin/model-routes/[id]/route.ts`

如果发现某个文件不存在，先用 `rg --files src | rg admin` 重新确认路径，不要盲目新建重复模块。

---

## 3. 交付范围

### 3.1 真实验收记录

更新 `docs/API_TEST_STATUS.md`，记录这次后台闭环前后的真实状态。

必须补充：

- 当前日期。
- 本次用于验收的 job id。
- 当前 `/api/health` 结果摘要。
- 是否跑过 `npm run smoke:stitch`。
- 是否跑过 `npm run smoke:backend`。
- final video R2 key。
- QA frame R2 keys。
- final `video_jobs.status`。
- `credit_ledger` 是否有 `reserve`、`capture`、`release` 或 `refund`。
- 如果 smoke 没法跑，写清楚缺失环境变量或外部 provider 阻塞点。

### 3.2 Admin Jobs 异常队列

扩展现有 `/admin/jobs`，不要单独做复杂大屏。

必须支持：

- 默认按 `createdAt desc` 展示任务。
- 支持筛选 `attention` 任务。
- 支持筛选 `isTest=true/false`。
- 支持按 `jobId` 或 `userId` 搜索。
- 支持按状态筛选。
- 每行展示：job id、user id、status、userVisibleStatus、duration、aspect ratio、credit cost、isTest、failureReason、createdAt、进入详情链接。

`attention` 定义至少包含：

- `segment_failed`
- `stitching_failed`
- `post_qa_failed`
- `failed_released`
- `failed_refunded`
- `prompt_moderation_blocked`
- `asset_analysis_failed`
- `post_qa_queued` 且更新时间超过 10 分钟
- `post_qa_running` 且更新时间超过 10 分钟
- `stitching_queued` 且更新时间超过 10 分钟
- `stitching_running` 且更新时间超过 10 分钟
- `segment_generating` 且更新时间超过 10 分钟

如果当前 schema 没有 `updatedAt` 暴露到 admin list，需要在 `src/server/admin/list-jobs.ts` 中补上。

### 3.3 Admin Job Detail 可读化

扩展 `/admin/jobs/[id]` 和 `src/components/admin/job-detail-panel.tsx`。

不要只堆 JSON。JSON 可以保留，但必须作为次级折叠或小块展示。首屏必须先给管理员结论。

必须展示：

- 任务总览：status、userVisibleStatus、failureReason、lastError、isTest、duration、aspectRatio、creditCost、createdAt、updatedAt。
- 诊断摘要：当前卡点、下一步建议、是否需要人工处理。
- 素材区：上传素材、角色、原始 key、检测角色、素材分析 mode 和结果。
- 分镜区：storyboard status、selectedTemplateIds、每段 template id、prompt 摘要、finalPromptSnapshot。
- Segment 表：index、status、templateId、provider、model、providerTaskId、videoKey、lastError、attemptCount。
- Stitch 区：stitch job status、segmentKeys、finalVideoKey、coverKey、frameKeys、lastError。
- Post-QA 区：status、mode、failureCategory、frameKeys、result JSON、createdAt。
- Provider logs：purpose、provider、model、status、durationMs、costEstimate、fallbackReason、responseSummary。
- Moderation results：source、decision、provider、errorCode、errorMessage、createdAt。
- Credit ledger：type、amount、balanceBefore、balanceAfter、reason、idempotencyKey、createdAt。
- State events timeline：createdAt、fromStatus、toStatus、reason、actorType、actorId。

诊断摘要建议规则：

- 如果任务 `deliverable` 且有 `finalVideoKey`：显示“可交付，检查下载与 Post-QA 记录”。
- 如果处于 `post_qa_queued/running` 超过 10 分钟：显示“Post-QA 可能卡住，检查 frame keys 和 provider logs，可考虑重开 Post-QA”。
- 如果 segment 有 failed：显示“片段失败，优先重试失败 segment，不要整单重跑”。
- 如果 stitch failed 或缺 finalVideoKey：显示“拼接失败，检查 Cloud Run 和 stitch job”。
- 如果 moderation blocked：显示“合规拦截，不允许重试生成，除非用户修改 prompt”。
- 如果 ledger 有 reserve 但没有 capture/release/refund，且任务已失败：显示“点数冻结可能需要释放或退款”。

### 3.4 Admin Actions 安全复核

复核并必要时修正以下 action：

- `POST /api/admin/segments/[id]/retry`
- `POST /api/admin/jobs/[id]/reopen-post-qa`
- `POST /api/admin/jobs/[id]/release-credits`
- `POST /api/admin/credits/adjust`
- `POST /api/admin/templates/status`
- `POST /api/admin/provider-keys/[id]/status`
- `POST /api/admin/model-routes/[id]`

统一要求：

- 必须登录管理员。
- 必须校验角色权限。
- 必须要求 `reason`，空字符串、纯空格、少于 6 个字符都拒绝。
- 必须写 `admin_audit_logs`。
- 操作响应必须返回明确结果，不要只返回 `{ ok: true }`。
- operator 允许执行任务排障类操作，但不能修改 provider key、model route、价格或完整 key。

危险约束：

- 普通用户永远不能调用这些 API。
- 管理员不能把 Post-QA 直接改成 passed。
- 管理员不能把未通过 Post-QA 的任务直接改成 deliverable。
- 管理员不能在后台看到完整 provider key。

### 3.5 Provider / Template / Billing 页面闭环

现有页面保留，做最小可用增强。

Provider 页面必须展示：

- provider key label。
- provider。
- status。
- daily limit / concurrency limit 如果 schema 已有则展示。
- masked key 或不展示 key。
- 暂停/恢复操作入口。

Template 页面必须展示：

- template id。
- name。
- status。
- risk level。
- trial eligibility。
- 暂停/恢复操作入口。

Billing 页面必须展示：

- wallet。
- orders。
- credit ledger。
- admin adjustment 入口。
- 任何补点必须写 reason。

### 3.6 文档与验收

更新：

- `docs/API_TEST_STATUS.md`

可选更新：

- 如果新增后台页面或操作流程明显改变，更新 `docs/API_FLOW.md`。

---

## 4. 建议文件改动

优先修改：

- `src/server/admin/list-jobs.ts`
- `src/server/admin/list-jobs.test.ts`
- `src/server/admin/jobs.ts`
- `src/server/admin/jobs.test.ts`
- `src/components/admin/job-detail-panel.tsx`
- `src/app/admin/jobs/page.tsx`
- `src/app/admin/jobs/[id]/page.tsx`
- `src/components/admin/action-form.tsx`
- `src/app/api/admin/*/*.test.ts`
- `src/server/admin/job-actions.ts`
- `src/server/admin/job-actions.test.ts`
- `src/server/admin/providers.ts`
- `src/server/admin/providers.test.ts`
- `src/server/admin/billing.ts`
- `src/server/admin/billing.test.ts`
- `docs/API_TEST_STATUS.md`

如果需要新增小组件，优先放在：

- `src/components/admin/job-status-badge.tsx`
- `src/components/admin/job-diagnosis-panel.tsx`
- `src/components/admin/job-timeline.tsx`
- `src/components/admin/admin-data-table.tsx`

不要为了这次任务引入大型 table 库。当前用简单 HTML table + Tailwind 即可。

---

## 5. 测试要求

必须新增或更新测试：

### 5.1 Admin list 服务测试

文件：`src/server/admin/list-jobs.test.ts`

覆盖：

- 默认按创建时间倒序。
- `attention` 筛选能包含失败和卡住任务。
- `isTest` 筛选正确。
- `status` 筛选正确。
- `jobId/userId` 搜索正确。

### 5.2 Admin job detail 服务测试

文件：`src/server/admin/jobs.test.ts`

覆盖：

- 返回任务全链路信息。
- 包含 assets、analyses、storyboard、segments、providerLogs、moderationResults、stitchJobs、postQaResults、ledger、stateEvents。
- 能生成诊断摘要。
- ledger reserve 未释放时能给出补偿提示。

### 5.3 Admin action 测试

文件：

- `src/server/admin/job-actions.test.ts`
- `src/server/admin/providers.test.ts`
- `src/server/admin/billing.test.ts`
- `src/app/api/admin/**/*.test.ts`

覆盖：

- 缺 reason 拒绝。
- reason 只有空格拒绝。
- reason 少于 6 个字符拒绝。
- 成功操作写 audit log。
- operator 权限限制正确。
- admin 权限正确。

### 5.4 UI 组件测试

如果项目现有测试方式支持 React component test，则补：

- `src/components/admin/job-detail-panel.test.tsx`
- `src/components/admin/job-timeline.test.tsx`

覆盖：

- 诊断摘要可见。
- Segment 表可见。
- Provider logs 表可见。
- State events timeline 可见。
- JSON 只作为辅助展示，不是唯一信息。

如果新 session 判断现有项目不适合补 UI 测试，必须在最终说明里解释原因，并用服务层测试覆盖主要逻辑。

---

## 6. 手工验收清单

用至少一个真实任务验收，优先使用最近成功生成过的视频任务。

必须验证：

- `/admin/jobs` 能看到任务。
- `/admin/jobs?attention=1` 能看到异常或卡住任务。
- `/admin/jobs?isTest=true` 只显示测试任务。
- `/admin/jobs/[id]` 首屏能看出当前状态和下一步建议。
- 任务详情里能看到 segment、provider task id、stitch job、Post-QA、credit ledger、state events。
- 重开 Post-QA 需要 reason。
- 重试 segment 需要 reason。
- 释放冻结点数需要 reason。
- 手动补点需要 reason。
- 操作后能查到 `admin_audit_logs`。
- operator 不能改 provider key 和 model route。
- admin 可以改 provider key 和 model route。

真实 smoke：

```bash
npm run typecheck
npm test
npm run build
```

如果环境变量齐全，继续跑：

```bash
npm run smoke:stitch
npm run smoke:backend
```

如果 smoke 无法运行，必须把阻塞原因写进 `docs/API_TEST_STATUS.md`，不能口头说“应该可以”。

---

## 7. 验收标准

本任务完成的定义：

- 管理员能通过后台找到任务失败或卡住的阶段。
- 管理员能看到完整生成链路：素材、分析、分镜、segment、provider、stitch、Post-QA、账本、状态事件。
- 管理员敏感操作全部要求 reason，并写 audit log。
- 异常任务能被筛出来，而不是在全量任务列表里靠肉眼翻。
- `npm run typecheck`、`npm test`、`npm run build` 通过。
- `docs/API_TEST_STATUS.md` 记录真实验收状态。

本任务未完成的标志：

- 任务详情还是主要靠 JSON dump 阅读。
- 无法筛出卡住任务。
- 管理员 action 可以不填 reason。
- 操作没有审计记录。
- Post-QA 未通过的任务可以被后台直接改成 deliverable。
- provider key 明文出现在页面或 API 响应里。

---

## 8. 给新 session 的执行建议

建议按这个顺序做：

1. 先跑 `npm run typecheck` 和 `npm test`，确认起点干净。
2. 先补 `src/server/admin/list-jobs.ts` 的筛选和 `attention` 分类。
3. 再补 `src/server/admin/jobs.ts` 的诊断摘要和必要字段。
4. 再把 `/admin/jobs` 和 `/admin/jobs/[id]` 改成可读视图。
5. 再统一 action reason 校验和 audit log。
6. 最后更新 `docs/API_TEST_STATUS.md`，运行全量验证。

如果做到一半发现真实状态机字段不足，先补服务层字段，不要在 UI 里硬猜。

如果做到一半想做漂亮 Dashboard，停。那是后续任务，现在不是。
