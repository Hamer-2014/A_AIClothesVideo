# Env-only 验收口径收敛 SPEC

## 背景

当前 MVP 已经完成一轮风险收敛：

- 公开视频生成运行时改为 env-only：`VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL`、当前 provider 的 API key。
- APIMart PixVerse V6 是默认公开视频生成模型。
- 免费试用/付费生成档位已经进入代码：试用 `540p`、无音频、带水印；付费默认 `720p + audio`。
- Cloud Run stitch-worker 已支持封面生成和分级 Post-QA 抽帧。

但验收脚本和部分文档仍残留旧 DB route 口径，尤其是 `verify:blockers` 仍要求 `provider_call_logs.model_route_id` 与 `route_snapshot`。这与 env-only 方案冲突，会导致正确的 env-only paid delivery 被误判为失败。

## 目标

本 SPEC 的目标是把 MVP 上线前验收口径收敛到当前真实架构：

1. `verify:blockers` 不再要求 DB route snapshot。
2. paid delivery 仍必须证明真实付费闭环：`reserve`、`capture`、final video、QA frames、APIMart/PixVerse provider/model 证据。
3. 文档中旧的“route snapshot 必需”“不默认生成音频”等冲突口径要清理。
4. 清理容易误导新 session 的代码噪音。
5. 给出新的真实 smoke 验收清单，要求新 session 产出 job id 和命令结果，供后续验收。

## 非目标

- 不重新引入 DB `model_routes` 作为公开视频运行时配置。
- 不恢复 provider key 后台热切换。
- 不改点数价格。
- 不开放 `1080p + audio` 给普通用户。
- 不实现新的反滥用策略。
- 不把 Creem 真实支付 review 当成已经完成。

## 必须修改

### 1. `verify:blockers` 改成 env-only 证据

修改：

- `scripts/verify-blockers.mjs`
- `scripts/lib/blocker-verification-utils.mjs`
- `scripts/lib/blocker-verification-utils.test.ts`
- 如有类型声明：`scripts/mjs-modules.d.ts`

要求：

- paid delivery 候选任务仍限定：
  - `video_jobs.credit_cost > 0`
  - `video_jobs.status = deliverable`
  - `video_jobs.deleted_at is null`
- 仍要求账本：
  - `credit_ledger` 包含 `reserve`
  - `credit_ledger` 包含 `capture`
- 仍要求交付物：
  - `final_video_key` 存在
  - `post_qa_results.frame_keys` 数量大于 0
- 新 env-only 证据要求：
  - `video_segments.provider` 包含 `apimart`
  - `video_segments.model` 包含 `pixverse-v6`
  - `provider_call_logs.purpose = video_generation`
  - `provider_call_logs.provider` 包含 `apimart`
  - `provider_call_logs.model` 包含 `pixverse-v6`
- 不再要求：
  - `provider_call_logs.model_route_id is not null`
  - `provider_call_logs.route_snapshot is not null`
  - `videoRouteLogCount > 0`

建议输出字段：

- `videoProviders`
- `videoModels`
- `providerLogProviders`
- `providerLogModels`
- `videoProviderLogCount`

通过原因文案应类似：

```text
Paid deliverable job has reserve, capture, final video, QA frames, and env-only apimart/pixverse-v6 provider/model evidence.
```

失败 next steps 不再提 route snapshot。

### 2. 文档口径收敛

修改：

- `docs/API_TEST_STATUS.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DEVELOPMENT_SPEC.md`
- `docs/TECHNICAL_ARCHITECTURE.md`
- `docs/verification/backend-api-blockers.md`
- `docs/verification/model-route-audit-2026-06-12.md`
- 必要时更新 `docs/API_FLOW.md`

要求：

- 明确 env-only 视频生成配置为当前 MVP 运行时口径。
- 删除或标记历史化以下说法：
  - paid delivery 必须有 `model_route_id`
  - paid delivery 必须有 `route_snapshot`
  - 公开视频生成由 DB `model_routes/provider_keys` 决定
- 清理与当前产品策略冲突的“禁止默认生成音频”口径。
- 付费默认应描述为“高分辨率 + audio”，不在用户侧暴露供应商具体分辨率。
- 免费试用应描述为“低分辨率、无音频、带水印”。
- Creem 真实 checkout/webhook review 仍保留为待生产验收，不得写成已完成。
- Cloud Run cover 真实部署 smoke 仍保留为待验收，除非新 session 实际跑出新 job 证据。

### 3. 清理代码噪音

修改：

- `src/lib/providers/apimart/video.ts`

要求：

- 删除残留注释 `//resolution: "360p"`。
- 不改变 APIMart request 行为。

### 4. 处理 `next-env.d.ts`

当前工作区存在自动生成差异：

```diff
-import "./.next/dev/types/routes.d.ts";
+import "./.next/types/routes.d.ts";
```

新 session 必须判断该差异是否属于当前任务：

- 如果只是本地 build/dev 自动生成噪音，恢复该文件，避免混入提交。
- 如果当前 Next.js 16 正式 build/typecheck 要求提交 `.next/types/routes.d.ts`，则必须在提交说明中明确原因，并确保 `npm run typecheck` 与 `npm run build` 都通过。

不能在不说明原因的情况下把该文件混入提交。

## 验收命令

必须运行：

```bash
npm run typecheck
npm test
npm run build
npm run verify:blockers -- --json
```

如果 `verify:blockers` 因真实数据库缺少新 env-only paid delivery 样本而失败，新 session不能降低断言或伪造通过。必须在反馈中明确：

- 失败原因。
- 已确认脚本不再要求 route snapshot。
- 下一步需要创建新的 paid job 并跑 smoke。

## 真实 smoke 验收清单

如果环境具备真实数据库、R2、APIMart、Cloud Run 和 worker 凭证，新 session 应补跑：

```bash
npm run smoke:backend -- --job-id <new-paid-env-only-job-id>
npm run verify:blockers -- --json
```

验收样本必须记录：

- paid delivery job id
- `credit_cost`
- `credit_ledger` 是否包含 `reserve` / `capture`
- `video_segments.provider/model`
- `provider_call_logs.provider/model`
- final video R2 key
- cover R2 key 是否存在
- QA frame count

失败补偿样本如可执行，也应记录：

- failure compensation job id
- 失败触发方式
- `credit_ledger` 是否包含 `release` 或 `refund`
- `job_state_events` 中的关键状态迁移

## 风险与提醒

- 当前最大风险不是功能缺失，而是验收标准互相打架。
- 不要把历史 DB route 计划文档当成当前运行时方案。
- 不要因为 `verify:blockers` 一时失败就删除付费闭环断言；只能修正错误的 route snapshot 断言。
- 不要把本地 10+ 视频稳定当成公开 MVP 用户验证。
- Creem 真实收款、税务和平台 review 仍是独立上线风险。

## 完成定义

本 SPEC 完成时应满足：

- `verify:blockers` 代码层面只检查 env-only provider/model 证据，不再检查 route snapshot。
- 相关测试覆盖“缺 provider call provider/model 会失败”和“不需要 route snapshot 也可通过”。
- 文档不再把 DB route snapshot 写成当前 paid delivery 必需证据。
- `src/lib/providers/apimart/video.ts` 不再有 360p 硬编码残留注释。
- `next-env.d.ts` 被明确处理。
- 新 session 提供完整命令结果；如无法完成真实 smoke，必须明确阻塞条件。
