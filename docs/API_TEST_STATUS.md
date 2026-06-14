# API 测试状态清单

> 目的：把这次真实跑过什么、哪里成功、哪里失败、失败卡在哪，写成可复核记录，避免把“代码写了”误当成“闭环验收完成”。

更新时间：2026-06-14

## 结论先说

- 2026-06-13 MVP 风险收敛子项目 A 已完成本地自动化验证：免费试用防滥用从 userId rolling 24h 升级为 user/email/device/IP/user-agent 多信号判断，新增 `trial_abuse_signals` 审计表，生产缺 `ABUSE_HASH_SECRET` fail closed，普通用户 API 不返回内部 reason codes。
- 2026-06-13 Env-only Video Generation Config 已开始替换子项目 B 的 DB route 口径：公开视频 `video_generation` 的 provider/model/key 以环境变量为准，`model_routes/provider_keys` 不再决定视频生成运行时配置。
- 2026-06-13 MVP 风险收敛子项目 C 已完成本地自动化验证：Cloud Run worker 从 final mp4 抽取 `cover.webp` 并上传 R2，封面失败不阻断 final video / QA frames；前台任务详情优先显示封面，任务列表通过内部 cover API 的 R2 signed URL 显示封面缩略图。
- 2026-06-13 SPEC Acceptance Follow-up 代码修复已完成本地定点验证：免费试用 grant hash 复用同一 dev fallback secret、Cloud Run cover 上传失败降级为 warning。旧 `model_routes` public fallback 验收口径已被 env-only 视频生成配置取代。
- 2026-06-14 Env-only blocker verifier alignment 已把 `verify:blockers` paid delivery 证据改为 `video_segments.provider/model` 与 `provider_call_logs.provider/model`；不再要求 `provider_call_logs.model_route_id` / `route_snapshot`。
- Admin Ops Closure 的代码改动已完成，`/admin/jobs`、`/admin/jobs/[id]`、Provider / Template / Billing 页面和敏感动作 reason / audit 约束都已落地。
- 本轮本地验证已通过：
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## 2026-06-14 Env-only blocker verifier alignment

本轮完成：

- `verify:blockers` paid delivery 证据改为检查 `video_segments.provider/model` 与 `provider_call_logs.provider/model`。
- 不再要求 `provider_call_logs.model_route_id` / `route_snapshot`。
- 付费闭环断言未降低：仍要求 `credit_cost > 0`、`reserve`、`capture`、final video 和 QA frames。
- 免费试用/付费生成口径收敛：免费试用为低分辨率、无音频、带水印；付费默认为高分辨率、无水印、包含音频；普通用户侧不暴露供应商具体分辨率。

仍未完成：

- 本轮未跑新 paid env-only smoke；需要真实数据库、R2、APIMart、Cloud Run、worker 凭证和新的 paid job id。
- Cloud Run cover 真实部署 smoke 仍需新任务证据，不能用旧本地样本替代。
- Creem 真实 checkout/webhook review 仍是待生产验收项，不能写成已完成。

## 2026-06-13 SPEC Acceptance Follow-up

本轮完成：

- `trial_check` 与 `trial_granted` 在 development 且未显式配置 `ABUSE_HASH_SECRET` 时共用 `dev-abuse-hash-secret-do-not-use-in-production`，避免免费试用 grant 信号与 eligibility 信号 hash 不一致。
- `stitch-worker` 已覆盖封面抽帧失败和封面上传失败两种非核心交付失败；两者都会保留 final video / QA frames / success callback，并在 callback 中写 warning。
- 旧 `model_routes` public fallback 不再作为 MVP 视频生成运行时路径；公开视频 provider/model/key 由环境变量决定。

已跑定点验证：

```bash
npx vitest run src/server/abuse/hash.test.ts src/server/abuse/trial-eligibility.test.ts src/server/jobs/create-job.test.ts
npx vitest run workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/stitch.test.ts
npx vitest run src/server/providers/model-route-resolver.test.ts src/server/video/segments.test.ts src/lib/providers/log-call.test.ts
npm run db:migrate
npm run verify:blockers -- --json
```

结果：

- abuse/job 定点测试：`3` 个 test files、`27` 个 tests 通过。
- worker 定点测试：`2` 个 test files、`10` 个 tests 通过。
- route/segment/log 定点测试：`3` 个 test files、`27` 个 tests 通过。
- `npm run db:migrate`：迁移执行成功。
- 历史结果：`npm run verify:blockers -- --json` 曾按旧 DB-route 标准失败，`paid_delivery` 未通过；现有 paid deliverable 样本 `0d3540c0-6dda-4ba7-841a-c12a45632148`、`516ac34b-0a2f-49e0-b584-96800d6cb899`、`5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06` 当时缺少 route snapshot 证据。该旧失败项已被 2026-06-14 env-only provider/model 证据口径取代。

剩余必须补的真实验收：

- 使用当前 env-only 视频生成配置创建新的 `credit_cost > 0` paid job，跑到 `deliverable`。
- 运行 `npm run smoke:backend -- --job-id <new-paid-job-id>`。
- 再运行 `npm run verify:blockers -- --json`，要求 `passed = true` 且 paid delivery evidence 包含 `video_segments.provider/model` 与 `provider_call_logs.provider/model`。

## 2026-06-13 MVP Risk Closure - 子项目 A 免费试用防滥用

本轮完成：

- 新增 `src/server/abuse/hash.ts`：空值返回 `null`，非空值使用 `ABUSE_HASH_SECRET` 做 HMAC-SHA256。
- 新增 `src/server/abuse/trial-eligibility.ts`：覆盖 userId、emailHash、OAuth account hash、device fingerprint hash、ipHash、ipHash + userAgentHash、disposable email、email verified 与缺失信号风险分。
- 新增 `trial_abuse_signals` Drizzle schema 与 `drizzle/0007_trial_abuse_signals.sql`。
- `POST /api/jobs` 接收前端 `deviceFingerprint`，传入 email/emailVerified、IP、user agent；风控拒绝统一返回：`当前环境暂时无法使用免费试用，可购买点数继续生成。`
- `createVideoJobWithAssets` 仅在用户显式请求免费试用时调用风控；明确付费生成不受 trial 风控阻断。
- 管理员任务详情展示 `Trial Eligibility` snapshot，普通用户 API 不暴露 reason codes。

已跑定点验证：

```bash
npx vitest run src/server/abuse/hash.test.ts src/server/abuse/trial-eligibility.test.ts src/server/jobs/create-job.test.ts src/app/api/jobs/route.test.ts src/components/workspace/workspace-app.test.tsx src/server/admin/jobs.test.ts src/components/admin/job-detail-panel.test.tsx src/lib/db/migrations.test.ts src/lib/db/schema/index.test.ts
npm run typecheck
```

结果：

- 定点测试：`9` 个 test files、`54` 个 tests 通过。
- `typecheck` 通过。

剩余注意：

- OAuth account 信号服务层和 store 接口已支持；当前 `/api/jobs` route 仍未从 better-auth `accounts` 表读取 provider/account id，后续应补一个 auth/account lookup，而不是伪造 session 字段。

## 2026-06-13 MVP Risk Closure - 子项目 B 历史记录：model_routes 运行时收敛

以下为历史记录，已被 2026-06-13 Env-only Video Generation Config 取代；不要再按本节配置公开视频生成 provider/model/key。

本轮曾完成：

- 新增 `src/server/providers/model-route-resolver.ts`，只收敛 `video_generation`，公开视频任务禁止解析 `experimental_video`。
- `submitQueuedSegment` 提交前解析 DB route，route paused、provider paused、key paused/exhausted/error、并发满、日成本达到上限、failureCount >= 5 均 fail closed。
- `router.ts` 新增 `createVideoGenerationForProvider(provider, input, deps)`，提交阶段使用 DB route 返回的 provider，不再由公开视频 submit 自己按 env 选 provider。
- `provider_call_logs` 新增 `model_route_id`、`route_snapshot`，segment 提交成功/失败日志都写 route 证据。
- `verify:blockers` paid delivery 检查新增 route snapshot 证据要求。

已跑定点验证：

```bash
npx vitest run scripts/lib/blocker-verification-utils.test.ts src/lib/providers/log-call.test.ts src/server/video/segments.test.ts src/server/providers/model-route-resolver.test.ts src/lib/providers/video-generation/router.test.ts
npm run typecheck
```

结果：

- 定点测试：`5` 个 test files、`44` 个 tests 通过。
- `typecheck` 通过。

剩余注意：

- 历史 paid delivery 样本若没有 `provider_call_logs.model_route_id/route_snapshot`，旧 DB-route 标准会失败；env-only 后该标准应改为检查 `video_segments.provider/model` 与 `provider_call_logs.provider/model`。

本轮验收命令状态：

- `npm run typecheck`：通过。
- `npm run test`：通过，`124` 个 test files、`497` 个 tests。
- `npm run build`：通过。
- `npm run verify:blockers -- --json`：未完成，隔离 worktree 未配置 `DATABASE_URL`，命令直接报 `DATABASE_URL is required.`；未降低断言或改成 mock 验收。
- 本轮真实环境验证结论已更新：
  - `npm run smoke:stitch` 成功
  - `npm run smoke:backend -- --job-id 5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4` 成功
- 之前 `smoke:backend` 失败不是 Cloud Run 或 Post-QA 问题，也不是该样本的 capture 漏扣；根因是该 job 的 `credit_cost = 0`，属于 8 秒免费试用链路，旧 smoke 对 0 成本任务也强制要求 `credit_ledger.capture`，造成误报。
- 已修复 smoke 断言：只有 full smoke 且 `credit_cost > 0` 的付费任务才必须存在 `capture`；同时 full smoke 缺少 `credit_cost` 字段会直接失败，避免付费任务被误当 0 成本而假绿。
- Backend/API Hardening 本轮补齐：audit logs 查询、provider key 新增/轮换、billing 点数包可见化、Creem checkout/webhook 边界测试、Post-QA resolve 重放幂等、health 中 payment pending 与 moderation readiness 分离。

## 2026-06-13 MVP Risk Closure - 子项目 C Cloud Run 封面生成

本轮完成：

- `workers/stitch-worker/src/ffmpeg.ts` 新增 `extractCoverFrame`，默认从 `00:00:04` 抽取一帧并输出 720 宽 webp：`ffmpeg -y -ss 00:00:04 -i final.mp4 -frames:v 1 -vf scale=720:-1 cover.webp`。
- `runStitchJob` 在有 `coverKey` 时生成并上传 `jobs/{jobId}/covers/cover.webp`；封面生成失败时 callback 带 warning 且 `coverKey = null`，不阻断 final video、QA frames 或成功 callback。
- 主应用 callback 已保存 `stitch_jobs.cover_key` 与 `video_jobs.cover_key`，cover 为空不阻断进入 `post_qa_queued`。
- 前台任务详情优先显示 cover image，无 cover 时回退 final video preview；任务列表在有 `coverKey` 时使用 `/api/jobs/{jobId}/cover` 获取 R2 signed URL 并显示封面缩略图。
- 后台任务详情已展示 `Cover Key`。

已跑 TDD 定点验证：

```bash
npx vitest run workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/stitch.test.ts
cd workers/stitch-worker && npm run build
npx vitest run src/components/jobs/job-deliverable-panel.test.tsx src/components/jobs/job-live-panels.test.tsx src/components/jobs/job-list.test.tsx
npx vitest run src/server/files/job-cover.test.ts src/app/api/jobs/[id]/cover/route.test.ts
```

结果：

- worker 定点测试：`2` 个 test files、`9` 个 tests 通过。
- worker build 通过。
- 前台封面定点测试：`3` 个 test files、`6` 个 tests 通过。
- signed cover API 定点测试：`2` 个 test files、`5` 个 tests 通过。

剩余注意：

- 当前隔离 worktree 尚未用新部署后的真实 job 跑 smoke，因此还不能声称新任务 R2 已实际出现新 cover object；需要在部署 worker 后用 `npm run smoke:stitch` / `npm run smoke:backend -- --job-id <new-paid-job-id>` 补真实样本。

本轮最终验收命令状态（2026-06-13 16:45 +08:00）：

- `npx vitest run workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/stitch.test.ts src/server/stitch/jobs.test.ts src/app/api/internal/stitch/callback/route.test.ts src/components/jobs/job-deliverable-panel.test.tsx src/components/jobs/job-live-panels.test.tsx src/components/jobs/job-list.test.tsx src/server/files/job-cover.test.ts src/app/api/jobs/[id]/cover/route.test.ts`：通过，`9` 个 test files、`25` 个 tests。
- `cd workers/stitch-worker && npm run build`：通过。
- `npm run typecheck`：通过。
- `npm run test`：通过，`127` 个 test files、`507` 个 tests。
- `npm run build`：通过。
- `npm run verify:blockers -- --json`：未完成，隔离 worktree 未注入 `.env` / `.env.local`，脚本加载 `0` 个 env 后报 `DATABASE_URL is required.`；env-only 后应检查 paid delivery provider/model 证据，不再坚持 route snapshot 断言。
- `npm run smoke:stitch`、`npm run smoke:backend -- --job-id <new-paid-job-id>`：未运行；当前会需要真实部署环境、R2 凭证、数据库连接和新 job id。

## 本轮真实验收样本

- 日期：2026-06-11
- 验收 job id：`5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4`
- `/api/health` 摘要：
  - `ready = true`
  - `database/auth/storage/internalSecurity/stitchWorker/billing/aiProviders` 全部 `configured = true`
- `video_jobs.status`：`deliverable`
- `post_qa_mode`：`lite`
- `credit_cost`：`0`
- `credit_ledger`：空，符合 0 成本试用单预期
- final video R2 key：
  - `jobs/5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4/stitched/final.mp4`
- cover R2 key：
  - `jobs/5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4/covers/cover.webp`
- QA frame R2 keys：
  - `jobs/5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4/qa/frames/0.jpg`
  - `jobs/5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4/qa/frames/1.jpg`
  - `jobs/5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4/qa/frames/2.jpg`
- stitch job：
  - `stitchJobId = 61197807-d969-4495-b8bf-2d612573e7ed`
  - `status = succeeded`
- post-qa：
  - `postQaResultId = e4ab4c4f-7c88-403e-828c-99405558a067`
  - `status = passed`

## 本轮命令结果

### Backend/API Hardening 起点

- 日期：2026-06-11
- 基础验证：
  - `npm run typecheck`: pass
  - `npm test`: pass，`107` 个 test files、`350` 个 tests
  - `npm run build`: pass
- 当前已知缺口：
  - 付费任务 `credit_cost > 0` full smoke 未验收
  - 失败补偿路径已有自动化覆盖，但真实/半真实演练仍需留痕
  - Creem 真实支付验证：pending Creem approval

### 1. 核心构建验证

已通过：

```bash
npm run typecheck
npm test
npm run build
```

结果：

- `typecheck` 通过
- `test` 通过，`107` 个 test files、`350` 个 tests 全绿
- `build` 通过，admin 页面与 admin API 均进入 Next.js route 清单

### 2. 真实 smoke

#### `npm run smoke:stitch`

结果：成功

关键信息：

- Cloud Run `/health` 返回 `ok: true`
- 该任务复用了已有 stitch/post-qa 结果，没有重复触发 stitch
- `final.mp4` 存在
- QA frames 共 `3` 张，均存在
- smoke 结论：`stitch_completed`

#### `npm run smoke:backend -- --job-id 5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4`

结果：成功

关键信息：

- Cloud Run `/health` 返回 `ok: true`
- 该任务复用了已有 stitch/post-qa 结果，没有重复触发 stitch
- `video_jobs.status = deliverable`
- `post_qa_results.status = passed`
- `credit_cost = 0`
- `credit_ledger = []`
- smoke 结论：`deliverable`

## credit_ledger 真实状态

针对 job `5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4`：

- `reserve`：无
- `capture`：无
- `release`：无
- `refund`：无

解释：

- 该 job 的 `credit_cost = 0`，且状态事件中出现 `trial_segments_prepared` / `trial_segments_created`。
- 因此 ledger 为空是 0 成本试用单的合理结果。
- 这不能证明付费账务闭环已经通过；付费任务仍必须单独跑真实 smoke，要求 `credit_cost > 0` 且存在 `credit_ledger.capture`。

修复：

- `scripts/backend-smoke.mjs` 现在查询 `credit_cost`。
- `scripts/lib/backend-smoke-utils.mjs` 新增 `assertSmokeCreditLedger`。
- full smoke 下如果缺少 `credit_cost` 会失败。
- full smoke 下只有 `credit_cost > 0` 才要求 `reserve` 和 `capture`。

### Paid smoke 断言

- full smoke 下 `credit_cost > 0` 必须同时存在 `reserve` 和 `capture`。
- full smoke 下 `credit_cost = 0` 不要求账本流水。
- full smoke 缺少 `credit_cost` 直接失败。

### 失败补偿自动化覆盖

- Post-QA failed 不 capture。
- Post-QA failed 释放冻结点数。
- Post-QA resolve replay 不重复 capture。
- Admin undeliverable 已有 release 和 audit 自动化覆盖。

### Creem 代码审查状态

- checkout 不接受任意金额或 credits：已覆盖。
- checkout 未配置 key 不伪造 URL、不创建假订单：已覆盖。
- webhook 缺签名拒绝：已覆盖。
- webhook 错签名拒绝：已覆盖。
- webhook 重放不重复充值：已覆盖。
- 真实 Creem checkout/webhook 验证：pending Creem approval。

### Backend/API Hardening 本地验证

已通过：

```bash
npm test -- scripts/lib/backend-smoke-utils.test.ts src/server/admin/audit.test.ts src/app/api/admin/audit-logs/route.test.ts src/server/admin/provider-key-crypto.test.ts src/server/admin/providers.test.ts src/app/api/admin/provider-keys/route.test.ts src/app/api/admin/provider-keys/[id]/rotate/route.test.ts src/server/admin/billing.test.ts src/app/api/admin/billing/route.test.ts src/app/api/billing/checkout/route.test.ts src/app/api/webhooks/creem/route.test.ts src/lib/providers/creem/webhook.test.ts src/server/post-qa/resolve.test.ts src/app/api/jobs/[id]/download/route.test.ts src/server/ops/health.test.ts src/app/api/health/route.test.ts
npm run typecheck
```

结果：

- 加固相关测试：`16` 个 test files、`75` 个 tests 通过。
- `typecheck` 通过。
- `GET /api/health` 现在区分 `creemPayment` 与 `moderation`：
  - `creemPayment.status = pending` 可用于标记 Creem 真实支付验收后置。
  - `moderation.configured = false` 会导致 `ready = false`。
- `GET /api/health` 视频生成检查改为要求 `VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL` 和当前 provider 对应的 `APIMART_API_KEY` / `EVOLINK_API_KEY`；不再把 `PROVIDER_KEY_ENCRYPTION_SECRET` 作为视频生成必需项。

### Backend/API 阻断项硬验证

新增命令：

```bash
npm run verify:blockers
```

本轮结果：失败，符合当前真实库状态。

输出摘要：

- `paid_delivery`: BLOCKED
  - 原因：没有找到 `credit_cost > 0` 且 `deliverable` 的真实付费任务。
  - 下一步：创建或选择真实付费任务，跑 `npm run smoke:backend -- --job-id <paid-job-id>`，确认 `reserve` 和 `capture`。
- `failure_compensation`: BLOCKED
  - 原因：没有找到 `failed_released / failed_refunded` 且带 `release/refund` 证据的真实付费失败任务。
  - 下一步：演练 provider/stitch/Post-QA 失败路径，确认 `release/refund` 与 `job_state_events`。
- `audit_evidence`: PASS
  - 真实库存在 `job:reopen_post_qa` 审计证据。
  - 验收器已把 job 排障类敏感操作纳入审计证据范围。

这个命令会在任一阻断项缺失时退出非 0。后续验收不再接受“文档说应该可以”作为通过证据，必须跑该命令或给出对应真实 job/audit 记录。

详细补齐步骤见：

- `docs/verification/backend-api-blockers.md`

## Admin Ops Closure 本轮完成内容

### Jobs

- `/admin/jobs` 新增：
  - `attention=1` 异常队列
  - `isTest=true|false` 筛选
  - `status` 筛选
  - `q=jobId|userId` 搜索
- attention 规则已覆盖失败态和 10 分钟以上 stale 运行态

### Job Detail

- `/admin/jobs/[id]` 首屏先显示诊断摘要，不再以 JSON dump 作为唯一入口
- 已展示：
  - 任务总览
  - 素材区
  - 分镜区
  - Segment 表
  - Stitch 区
  - Post-QA 区
  - Provider logs
  - Moderation results
  - Credit ledger
  - State events timeline

### Admin Actions

- 以下动作已统一要求 `reason` 至少 `6` 个字符：
  - 重试 segment
  - 重开 Post-QA
  - 标记不可交付
  - 手动补点
  - 更新模板状态
  - 更新 provider key 状态
  - 更新 model route
- 服务层已统一复用 reason 校验
- route 层已把该类输入错误映射为 `400`
- operator 仍不能修改 provider key / model route
- 模板状态更新也已补上 admin audit

### Provider / Template / Billing 页面

- Provider 页面已显示：
  - provider key label
  - provider id
  - status
  - masked key preview
  - daily limit / current daily cost
  - concurrency
  - failure count
  - create key 表单
  - rotate key 表单
- Template 页面已显示：
  - template id
  - name
  - status
  - risk level
  - trial eligibility
- Billing 页面已显示：
  - wallet
  - orders
  - credit ledger
  - admin adjustment 入口
  - 当前代码配置的 credit packages
  - Creem 产品 ID / 真实 checkout pending 提示
- Audit Logs 页面已新增：
  - `/admin/audit-logs`
  - `GET /api/admin/audit-logs`
  - 支持 actor/action/targetType/targetId 查询
  - snapshot 中 key/prompt 字段做脱敏

## 当前仍未完成的真实验收项

下面这些不能假装已经过：

| 项目 | 当前状态 | 说明 |
| --- | --- | --- |
| 0 成本试用任务 deliverable 后 smoke | 已通过 | 样本 job `credit_cost = 0`，不要求 capture |
| 付费任务 deliverable 后 `credit_ledger.capture` | 未验收 | 需要新建或选择 `credit_cost > 0` 的真实任务跑 full smoke |
| `failed_released / failed_refunded` 真实补偿回路 smoke | 未补 | 仍需真实任务演练 |
| 运维动作后的 `admin_audit_logs` 真实库回查 | 已有最小留痕 | `npm run verify:blockers` 已检测到 `job:reopen_post_qa` 审计证据；后续仍建议补 provider key 或补点类审计样本 |

## 这次记录真正暴露的问题

最大的问题不是后台页面，而是验收口径之前错了：

- 当前真实任务已经 `deliverable`
- Post-QA 已 `passed`
- final video 与 QA frames 都在 R2
- 但该任务 `credit_cost = 0`，旧 smoke 没查 `credit_cost` 却强制要求 `capture`

这意味着如果只看一句 “ledger 没有 capture”，很容易把试用单误判成账务事故；反过来，如果 smoke 没有 `credit_cost` 保护，也可能把付费单误判成试用单而放过真正的漏扣。

下一步不要先去挑页面样式，优先补齐付费任务真实 smoke：必须拿一个 `credit_cost > 0` 的任务跑到 `deliverable`，并看到 `credit_ledger.reserve` 与 `credit_ledger.capture`。

## 2026-06-12 Paid Closure Verification

- Paid delivery job id: `5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06`
- Paid delivery smoke command: `npm run smoke:backend -- --job-id 5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06`
- Paid delivery result:
  - `video_jobs.status = deliverable`
  - `credit_cost = 70`
  - `credit_ledger` contains `reserve` and `capture`
  - final video exists in R2: `jobs/5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06/stitched/final.mp4`
  - QA frames exist in R2: 3 frames
- Failure compensation job id: `b207d897-04dd-41cc-b1a8-02b56a6cc3a1`
- Failure compensation trigger: controlled Post-QA failure drill after the paid job reached `post_qa_queued`; transition to `post_qa_running`, then `resolvePostQaResult(status = failed)`
- Failure compensation result:
  - `video_jobs.status = failed_released`
  - `credit_cost = 70`
  - `credit_ledger` contains `reserve` and `release`
  - `job_state_events` contains `post_qa_running -> post_qa_failed -> failed_released`
- Final blocker command: `npm run verify:blockers -- --json`
- Final blocker result: `passed = true`
- Verification commands passed:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run smoke:backend -- --job-id 5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06`
  - `npm run verify:blockers -- --json`
- Residual risks:
  - Creem real checkout/webhook approval remains separate if still pending.
  - This verification proves one paid success and one controlled paid failure compensation sample, not large-scale provider stability.
  - The initial direct `POST /api/internal/post-qa/resolve` attempt from `segment_generating` failed correctly because the state machine only allows Post-QA failure resolution from Post-QA states.
