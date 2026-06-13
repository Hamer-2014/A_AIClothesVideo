# MVP 风险收敛 SPEC

日期：2026-06-13

## 目标

把当前服装短视频工具站从“后端闭环已跑通”推进到“更接近可公开 MVP”的上线前风险收敛状态。本 SPEC 只覆盖三个明确子项目：

1. `model_routes` 运行时收敛：公开视频生成不再主要依赖环境变量选模型，而是受数据库 route 管控。
2. Cloud Run 封面生成：`stitch-worker` 从最终视频抽取 `cover.webp` 并上传 R2。
3. 免费试用防滥用加强：免费试用从单一 userId 判断升级为 user/email/oauth/ip/device 多信号判断。

这三个子项目可以分阶段独立交付。推荐执行顺序：

1. 免费试用防滥用加强。
2. `model_routes` 运行时收敛。
3. Cloud Run 封面生成。

不要把三块混在一个巨大 diff 里。每块必须有自己的测试、验证命令和交付说明。

## 当前基线

截至 2026-06-13：

- `npm run typecheck` 通过。
- `npm run test` 通过，`121` 个 test files、`469` 个 tests。
- `npm run build` 通过。
- `npm run verify:blockers -- --json` 通过。
- paid delivery 样本已证明：
  - `credit_cost > 0`
  - `reserve`
  - `capture`
  - final video
  - QA frames
  - `video_segments.provider/model = apimart / pixverse-v6`
- paid failure compensation 样本已证明：
  - `failed_released`
  - `reserve`
  - `release`
  - 状态事件存在。
- 开发者本地已生成 10+ 个视频，APIMart PixVerse V6 当前技术链路稳定。

当前仍需收敛：

- `model_routes` 表和后台存在，但公开视频生成运行时仍主要读环境变量。
- Cloud Run `coverKey` 链路存在，但封面图未作为完整产物稳定生成。
- 免费试用已有 `free_trial_usages` 和 `user_access_events`，但缺 email / OAuth account / device fingerprint 等多维防滥用判断。

## 总体非目标

- 不做批量 SKU。
- 不做 30 秒以上视频。
- 不做 4K 或普通用户更高分辨率售卖。
- 不做复杂风控大屏。
- 不做 AI 生成封面。
- 不允许绕过 Creem Prompt Moderation。
- 不允许在 Vercel Function 中跑 ffmpeg。
- 不允许把 mock 成功当作真实验收。

---

# 子项目 A：免费试用防滥用加强

## A1. 目标

把免费试用资格判断从“userId 最近 24 小时是否使用过”升级为多信号防滥用：

- userId
- email hash
- OAuth provider/account hash
- IP hash
- device fingerprint hash
- user agent hash

目标不是绝对防刷，而是降低免费试用被批量薅用量的成本暴露面。

## A2. 产品规则

免费试用：

- 只适用于 8 秒任务。
- 只允许低风险、`isTrialAllowed = true` 的模板。
- 输出低分辨率、带水印、无音频。
- 消耗 0 点。
- 使用 `lite` Post-QA。
- 必须登录。
- 若 auth 层可稳定提供邮箱验证状态，应要求邮箱已验证。

试用限制：

- 同 userId：永久最多 1 次免费试用。不要继续使用 rolling 24h 作为上线策略。
- 同 emailHash：永久最多 1 次免费试用。
- 同 OAuth provider + oauthAccountIdHash：永久最多 1 次免费试用。
- 同 deviceFingerprintHash：7 天内最多 1 次免费试用。
- 同 ipHash：24 小时最多 3 次免费试用。
- 同 ipHash + userAgentHash：24 小时最多 2 次免费试用。
- disposable email domain：拒绝或进入 review；MVP 中 review 按 deny 处理。

拒绝文案：

```text
当前环境暂时无法使用免费试用，可购买点数继续生成。
```

不要把内部风控原因暴露给普通用户。

## A3. 数据模型

优先复用现有 `abuse_events`，如果现有字段不足，新增标准化表 `trial_abuse_signals`。

推荐新增表：

```ts
trial_abuse_signals
```

字段：

- `id`
- `user_id`
- `video_job_id`，可空；拒绝时通常为空
- `email_hash`
- `oauth_provider`
- `oauth_account_id_hash`
- `ip_hash`
- `device_fingerprint_hash`
- `user_agent_hash`
- `event_type`：`trial_check` / `trial_granted` / `trial_denied`
- `decision`：`allow` / `deny` / `review`
- `risk_score`
- `reason_codes`：JSON array
- `metadata`：JSON
- `created_at`

要求：

- 不存明文 device fingerprint。
- 不存明文 OAuth account id。
- IP 可继续在 `user_access_events.ip_address` 中按既有 admin-only 规则保存；`trial_abuse_signals` 中只存 hash。
- hash 使用服务端 secret，例如 `ABUSE_HASH_SECRET`。没有 secret 时生产 fail closed；开发环境可使用明显的 dev fallback，但测试必须覆盖缺 secret 行为。

## A4. 服务层设计

新增：

```text
src/server/abuse/hash.ts
src/server/abuse/trial-eligibility.ts
src/server/abuse/trial-eligibility.test.ts
```

`hash.ts`：

- `hashAbuseSignal(value, secret)`
- 空值返回 `null`
- 使用 HMAC-SHA256
- 输出 hex

`trial-eligibility.ts` 输入：

```ts
{
  userId: string;
  email?: string | null;
  emailVerified?: boolean | null;
  oauthAccounts?: Array<{
    provider: string;
    providerAccountId: string;
  }>;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  now?: Date;
}
```

输出：

```ts
{
  decision: "allow" | "deny" | "review";
  riskScore: number;
  reasonCodes: string[];
  signalSnapshot: JsonValue;
}
```

Store 接口至少包含：

- `countTrialUsagesByUserId(userId)`
- `countTrialUsagesByEmailHash(emailHash)`
- `countTrialUsagesByOauthAccount(provider, oauthAccountIdHash)`
- `countRecentTrialSignalsByDevice(deviceFingerprintHash, since)`
- `countRecentTrialSignalsByIp(ipHash, since)`
- `countRecentTrialSignalsByIpAndUserAgent(ipHash, userAgentHash, since)`
- `createTrialAbuseSignal(input)`

决策规则：

- userId 已试用：deny，reason `user_trial_used`
- emailHash 已试用：deny，reason `email_trial_used`
- OAuth account 已试用：deny，reason `oauth_trial_used`
- device 7 天内已试用：deny，reason `device_trial_recent`
- IP 24h 超过 3 次：deny，reason `ip_trial_limit`
- IP + UA 24h 超过 2 次：deny，reason `ip_ua_trial_limit`
- disposable email：deny，reason `disposable_email`
- email 未验证：deny，reason `email_unverified`
- device fingerprint 缺失：增加 risk，不直接 deny，reason `missing_device_fingerprint`
- user agent 缺失：增加 risk，不直接 deny，reason `missing_user_agent`

MVP risk score：

- hard deny reason 直接 `decision = deny`
- 否则 `riskScore >= 70` deny
- `riskScore >= 40` review；MVP 中 review 按 deny 处理
- 其余 allow

## A5. API 与前端输入

修改：

```text
src/app/api/jobs/route.ts
src/server/jobs/create-job.ts
src/components/workspace/workspace-app.tsx
```

前端创建任务时增加：

```ts
deviceFingerprint: string
```

device fingerprint MVP 生成方式：

- 首次访问在 localStorage 生成 UUID。
- 搭配 user agent、language、timezone、screen size 作为 metadata。
- 请求只传稳定 device id 和基本环境信息。

新增可选工具：

```text
src/lib/abuse/device-fingerprint.ts
```

注意：

- 不要让客户端决定是否免费。
- 不要发送 `isTrial`。
- 客户端只发送 `useFreeTrialIfAvailable` 和 device fingerprint。

`create-job.ts` 流程：

1. 判断是否请求免费试用。
2. 若请求免费试用，调用 `evaluateTrialEligibility`。
3. `allow` 才创建 `free_trial` job 和 `free_trial_usages`。
4. `deny/review` 不创建 free trial job，返回试用不可用错误。
5. 如果用户明确创建 paid job，不受 trial 风控阻断。

重要：风控拒绝不能悄悄把任务转成付费，除非用户明确点击付费生成。

## A6. 后台展示

最小展示即可：

- 管理员任务详情展示 trial eligibility snapshot。
- 管理员用户/任务相关区域可看到 abuse reason codes。
- operator 不看明文 IP，不看完整 fingerprint。

可修改：

```text
src/server/admin/jobs.ts
src/components/admin/job-detail-panel.tsx
```

不要本阶段做复杂风控 dashboard。

## A7. 测试要求

必须覆盖：

- 同 userId 二次试用 deny。
- 同 emailHash 二次试用 deny。
- 同 OAuth account 二次试用 deny。
- 同 deviceFingerprint 7 天内二次试用 deny。
- 同 IP 24 小时超过阈值 deny。
- 同 IP + UA 24 小时超过阈值 deny。
- 缺 device fingerprint 增加 riskScore，但不直接 deny。
- disposable email deny。
- email 未验证 deny。
- 风控拒绝不创建 `video_jobs`。
- 风控拒绝写 `trial_abuse_signals` 或 `abuse_events`。
- paid job 不受 trial 风控影响。
- 普通用户 API 不返回内部 reason codes。

## A8. 验收标准

- 免费试用不再只按 userId 判断。
- 重复注册邮箱/OAuth/设备/IP 高频请求无法轻易多次试用。
- 拒绝原因可被管理员审计。
- paid job 不被误杀。
- `npm run typecheck`
- `npm run test`
- `npm run build`

---

# 子项目 B：`model_routes` 运行时收敛

## B1. 目标

让公开视频生成运行时由数据库 `model_routes` 决定 provider/model/key，而不是主要依赖环境变量。

第一阶段只收敛 `video_generation`。不要一次性迁移 storyboard、vision、post_qa、moderation，避免风险过大。

## B2. 当前问题

当前代码：

```text
src/lib/providers/video-generation/router.ts
```

通过环境变量选择 provider：

- `VIDEO_GENERATION_PROVIDER`
- `VIDEO_GENERATION_MODEL`
- `APIMART_PIXVERSE_MODEL`

这会造成：

- 后台暂停 route 不一定影响真实运行。
- 环境变量误配可导致公开视频走错模型。
- provider key 状态、每日成本、并发限制没有被运行时强约束。

## B3. 路由规则

公开视频任务：

- 只允许 `purpose = video_generation`。
- 只允许 `status = active` 的 route。
- 只允许 `status = active` 的 provider。
- 只允许 `status = active` 的 provider key。
- 不允许 `purpose = experimental_video`。
- 默认不允许 fallback。
- fallback 只有 `allow_public_fallback = "true"` 才允许。
- fallback 前必须检查 `min_margin_percent >= 45` 和预计毛利。

生产环境：

- 找不到 active route：fail closed。
- 找不到 active key：fail closed。
- provider paused / exhausted / error：fail closed。

开发环境：

- 可以允许 env fallback，但必须在 provider call log 中明确标记 `routeSource = "env_fallback"`。
- 测试必须覆盖生产不允许静默 env fallback。

## B4. 数据模型增强

建议增强 `provider_call_logs`：

- `model_route_id`
- `route_snapshot`

如果不想立刻迁移字段，第一阶段可以把 route snapshot 放进 `request_snapshot.route`，但最终验收必须能从 provider log 中明确看到：

- route id
- purpose
- environment
- primary provider
- primary model
- fallback policy
- route source

推荐新增迁移：

```text
drizzle/0007_provider_call_route_snapshot.sql
```

字段：

```sql
alter table provider_call_logs
  add column model_route_id uuid,
  add column route_snapshot jsonb;
```

## B5. 服务层设计

新增：

```text
src/server/providers/model-route-resolver.ts
src/server/providers/model-route-resolver.test.ts
```

接口：

```ts
resolveModelRoute({
  purpose: "video_generation",
  environment: process.env.APP_ENV ?? process.env.NODE_ENV ?? "development",
  isPublicJob: true,
  estimatedRevenueCredits,
  estimatedCostUsd,
})
```

返回：

```ts
{
  routeId: string;
  provider: "apimart" | "evolink";
  model: string;
  providerKeyId: string;
  routeSnapshot: JsonValue;
  source: "database";
}
```

Store 方法：

- `findActiveRoute(purpose, environment)`
- `findProvider(providerId)`
- `findActiveKey(providerId, environment)`
- `findFallbackProvider(...)`
- `findFallbackKey(...)`

Key 选择规则：

- status active
- environment 匹配
- `currentConcurrency < concurrentLimit`
- `currentDailyCost < dailyCostLimit`，如果 limit 为空则不限制
- failureCount 未超过暂停阈值；阈值可先写死 5，后续再配置化

## B6. 视频生成接入

修改：

```text
src/server/video/segments.ts
src/lib/providers/video-generation/router.ts
src/lib/providers/video-generation/router.test.ts
```

目标结构：

- `segments.ts` 调 `resolveModelRoute`。
- `router.ts` 不再自行根据 env 决定 provider；改为接收 provider 参数。
- `createVideoGenerationForProvider(provider, input, deps)`。
- `pollVideoGenerationTaskForProvider(provider, taskId, deps)` 已存在，可复用。

保留：

- `getVideoGenerationConfig(env)` 可作为 health/dev 辅助。

运行时流程：

1. Segment 进入提交。
2. 解析 route。
3. 调用对应 adapter。
4. 保存 `video_segments.provider/model/providerCallLogId/providerTaskId`。
5. 写 provider call log，包含 route snapshot。

## B7. 后台约束

已有：

```text
src/server/admin/providers.ts
src/app/api/admin/model-routes/[id]/route.ts
```

需要复核：

- 修改 route 必须 reason。
- 修改 route 写 `admin_audit_logs`。
- operator 不能改 model route。
- route status 改为 paused 后，新公开视频任务不能继续使用该 route。

## B8. verify 脚本增强

现有 `verify:blockers` 已检查 paid delivery 的 `apimart / pixverse-v6`。

建议继续增强：

- paid delivery provider call log 必须包含 route snapshot。
- 如果新增 `model_route_id` 字段，则要求至少一个 video_generation call log 有 `model_route_id`。

修改：

```text
scripts/verify-blockers.mjs
scripts/lib/blocker-verification-utils.mjs
scripts/lib/blocker-verification-utils.test.ts
```

## B9. 测试要求

必须覆盖：

- active video_generation route 返回 APIMart PixVerse。
- route paused 时生产 fail closed。
- provider paused 时 fail closed。
- key paused/exhausted/error 时 fail closed。
- key concurrency 满时 fail closed 或选择下一个 active key。
- daily cost limit 超过时不选该 key。
- public job 不允许 experimental_video。
- fallback 未开启时不 fallback。
- fallback 开启但毛利低于 45% 时不 fallback。
- provider call log 包含 route snapshot。
- 修改 model route 写 audit。
- route paused 后 segment submit 不再调用 provider。

## B10. 验收标准

- 公开视频 `video_generation` 运行时以 DB route 为准。
- 生产环境缺 active route 时不会静默走 env。
- 后台暂停 route 后，新 segment submit fail closed。
- provider call log 可审计 route。
- `verify:blockers -- --json` 通过，并能证明 paid delivery 是 APIMart PixVerse。
- `npm run typecheck`
- `npm run test`
- `npm run build`

---

# 子项目 C：Cloud Run 封面生成

## C1. 目标

Cloud Run `stitch-worker` 在拼接最终视频后抽取封面图，并上传到 R2：

```text
jobs/{jobId}/covers/cover.webp
```

封面用于任务列表、任务详情和后台排障展示。

## C2. 产品规则

- 封面从最终视频抽帧生成。
- 不使用 AI 生成封面。
- 封面生成失败不应导致最终视频交付失败。
- 如果封面失败，记录 warning，`coverKey` 可为空。
- final video 和 QA frames 是核心交付，封面是体验增强。

## C3. Cloud Run worker 修改

修改：

```text
workers/stitch-worker/src/ffmpeg.ts
workers/stitch-worker/src/ffmpeg.test.ts
workers/stitch-worker/src/stitch.ts
workers/stitch-worker/src/stitch.test.ts
workers/stitch-worker/src/payload.ts
workers/stitch-worker/src/payload.test.ts
```

新增函数：

```ts
export async function extractCoverFrame({
  videoPath,
  coverPath,
  timestamp = "00:00:04",
  runCommand = defaultRunCommand,
}: {
  videoPath: string;
  coverPath: string;
  timestamp?: string;
  runCommand?: RunCommand;
})
```

ffmpeg 参数：

```bash
ffmpeg -y -ss 00:00:04 -i final.mp4 -frames:v 1 -vf scale=720:-1 cover.webp
```

第一版 timestamp：

- 默认固定 `00:00:04`。
- 后续可根据 duration 取中点，本 SPEC 不要求探测 duration。

`runStitchJob` 流程：

1. 下载 segments。
2. 拼接 final mp4。
3. 根据 `coverKey` 决定是否生成 cover。
4. 生成 cover 失败时捕获错误，继续后续流程。
5. 抽 QA frames。
6. 上传 final video。
7. 如果 cover 成功，上传 cover。
8. 上传 QA frames。
9. callback 带 `coverKey`；如果 cover 失败，带 `coverKey = null` 或不带。

## C4. 主应用处理

现有：

```text
src/server/stitch/jobs.ts
src/app/api/internal/stitch/callback/route.ts
```

要求：

- callback 成功时保存 `stitch_jobs.cover_key`。
- callback 成功时保存 `video_jobs.cover_key`。
- cover 为空不阻断 `post_qa_queued`。
- 后台 job detail 展示 cover key。

## C5. 前台展示

修改或确认：

```text
src/components/jobs/job-list.tsx
src/components/jobs/job-deliverable-panel.tsx
src/app/(dashboard)/jobs/page.tsx
src/app/(dashboard)/jobs/[id]/page.tsx
```

展示优先级：

1. 有 `coverKey`：使用 signed URL 展示封面。
2. 无 `coverKey` 但有 final video：展示 video preview。
3. 都没有：展示状态占位。

不要为封面引入重型图片处理服务。

## C6. Smoke 脚本增强

可选但推荐修改：

```text
scripts/backend-smoke.mjs
scripts/stitch-smoke.mjs
```

检查：

- deliverable job 如果有 `cover_key`，R2 object 存在。
- 不要求所有历史任务都有 cover，避免旧样本导致 smoke 失败。

## C7. 测试要求

必须覆盖：

- `extractCoverFrame` 生成正确 ffmpeg 参数。
- `runStitchJob` 有 coverKey 时调用 cover 生成并上传 webp。
- cover 生成失败不会导致 stitch job failed。
- cover 上传失败是否阻断：MVP 建议不阻断，但必须记录 callback warning；如果实现暂不支持 warning，至少不上传并继续成功。
- callback 保存 coverKey。
- job list/detail 能使用 cover URL。

## C8. 验收标准

- 新生成任务 R2 中出现：

```text
jobs/{jobId}/covers/cover.webp
```

- `video_jobs.cover_key` 有值。
- `stitch_jobs.cover_key` 有值。
- 用户任务列表能看到封面。
- 后台任务详情能看到 cover key。
- 封面失败不影响 final video 交付。
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `workers/stitch-worker` 目录下 `npm run build`

---

# 总体验收命令

每个子项目完成后都必须运行：

```bash
npm run typecheck
npm run test
npm run build
```

涉及 Cloud Run worker 时额外运行：

```bash
npm run build
```

工作目录：

```text
workers/stitch-worker
```

涉及商业闭环或 model route 时额外运行：

```bash
npm run verify:blockers -- --json
```

如环境完整，最终再运行：

```bash
npm run smoke:stitch
npm run smoke:backend -- --job-id <new-paid-job-id>
```

## 文档更新要求

每个子项目完成后更新：

```text
docs/IMPLEMENTATION_PLAN.md
docs/API_TEST_STATUS.md
```

如果改变部署参数，更新：

```text
docs/deployment/cloud-run-stitch.md
```

如果改变产品规则，更新：

```text
docs/PRD.md
```

## 给新 session 的执行建议

新 session 不要一上来就改代码。先做：

1. `git status --short`
2. `npm run typecheck`
3. `npm run test`
4. 阅读本 SPEC 和相关文件。

然后按子项目分支/提交：

1. 免费试用防滥用加强。
2. `model_routes` 运行时收敛。
3. Cloud Run 封面生成。

每个子项目必须 TDD：

- 先写失败测试。
- 确认测试因目标行为缺失而失败。
- 再写最小实现。
- 再跑定点测试和全量验证。

## 验收关注点

我后续验收时会重点看：

- 有没有把 paid job 误伤为 trial 风控拒绝。
- 有没有把 route paused 后仍继续跑公开视频生成。
- provider call log 是否能追溯 route。
- 是否因为封面生成失败导致已生成视频失败。
- 是否把明文设备指纹、OAuth account id、完整 IP 暴露给普通用户或 operator。
- 是否降低了 `verify:blockers` 的断言标准。

不要为了绿灯降低断言。那种“改测试适配 bug”的事非常蠢，尤其在这个项目里等于拿自己的模型成本开玩笑。
