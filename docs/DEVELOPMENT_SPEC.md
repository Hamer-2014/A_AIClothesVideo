# MVP 开发 SPEC：从文档分支到部署验收前

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this spec task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按可验收阶段实现服装商品图生成宣传短视频 MVP，直到部署验收前。

**Architecture:** Next.js/Vercel 负责主站、后台、API 和短任务推进；Neon Postgres + Drizzle 保存状态机、点数账本、模型路由和审计；Cloudflare R2 保存图片和视频；Cloud Run `stitch-worker` 负责 ffmpeg 拼接与抽帧；Creem、DeepSeek、视觉模型、EvoLink 均真实接入，不做 mock 成功链路。

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Radix UI, Drizzle, Neon Postgres, better-auth, Resend, Creem, Cloudflare R2, cron-job.org, Cloud Run, ffmpeg, DeepSeek, GPT vision model, EvoLink Veo 3.1 Pro Beta, APIMart PixVerse V6 admin-only.

---

## 0. 执行总原则

### 0.1 分支策略

当前分支 `docs/mvp-prd` 是文档分支，必须保持无产品代码。

开发前创建实现分支：

```bash
git checkout docs/mvp-prd
git pull
git checkout -b main
git push -u origin main
```

后续功能开发从 `main` 切分支：

```bash
git checkout main
git pull
git checkout -b feat/foundation
```

规则：

- `docs/mvp-prd`：只记录 PRD、技术架构、实现计划和 SPEC。
- `main`：生产主分支。
- `feat/*`：功能开发分支。
- `fix/*`：缺陷修复分支。
- `ops/*`：部署、环境、运维配置分支。

### 0.2 禁止事项

- 不在 `docs/mvp-prd` 写产品代码。
- 不用 mock 伪造 Creem、大模型或视频生成的成功链路。
- 不在 Vercel Function 内跑 ffmpeg。
- 不绕过 Creem Prompt Moderation。
- 不直接扣点而不写 `credit_ledger`。
- 不让普通用户选择具体模型。
- 不把镜头模板写死成前端常量。
- 不把 8 秒片段默认暴露成用户侧下载项。
- 不公开售卖 4K。
- 不默认生成音频。

### 0.3 必须事项

- Drizzle 作为数据库访问/ORM。
- R2 signed URL 直传。
- Creem、大模型、EvoLink 真实接入。
- 未配置 API Key 时功能显示不可用，不伪造成功结果。
- 所有内部测试任务标记 `is_test = true`。
- 所有状态变化写 `job_state_events`。
- 所有模型调用写 `provider_call_logs`。
- 所有点数变化写 `credit_ledger`。
- 所有管理员敏感操作写 `admin_audit_logs`。
- Creem Prompt Moderation 必须在冻结点数和提交视频模型之前完成。
- Post-QA 质检通过后才 `capture` 点数并允许下载。

### 0.4 通用验收命令

每个阶段至少运行：

```bash
npm run lint
npm run typecheck
npm run build
```

建议补充：

```bash
npm test
```

如果某阶段没有测试命令，必须在阶段说明里写清楚原因，并提供人工验收步骤。

### 0.5 Worktree 本地开发约束

当前项目默认采用“继续共用上层依赖”的 worktree 模式。

要求：

- worktree 目录内不额外维护独立 `node_modules`。
- 所有本地开发默认复用主仓库根目录的依赖。
- `next.config.ts` 必须配置 `turbopack.root` 指向主仓库根目录。
- `tsconfig.json` 必须排除 `.next/dev/**`，避免开发态 route types 污染正式 `typecheck` 与 `build`。
- 若切换为“worktree 独立依赖”模式，必须单独开变更并更新文档，不允许临时混用。

当前路径约定：

- 主仓库根：`D:\\SelfProjects\\a_runwaytools`
- worktree 示例：`D:\\SelfProjects\\a_runwaytools\\.worktree\\mvp-closure-next-steps`

常用校验：

```bash
npm run typecheck
npm run build
```

如果出现 `.next/dev/types/routes.d.ts` 相关错误，优先检查：

1. `tsconfig.json` 是否重新把 `.next/dev/**` 纳入正式检查。
2. `next.config.ts` 的 `turbopack.root` 是否仍指向主仓库根。
3. 当前 worktree 是否误装了另一套不一致的依赖。

## 1. 环境变量与密钥 SPEC

### 1.1 `.env.example`

创建 `.env.example`，不要提交真实密钥。

必须包含：

```env
APP_URL=http://localhost:3000
NODE_ENV=development

DATABASE_URL=

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

RESEND_API_KEY=
EMAIL_FROM=

CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
CREEM_MODERATION_API_KEY=

CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=
CLOUDFLARE_R2_PUBLIC_BASE_URL=

INTERNAL_WORKER_SECRET=
CRON_JOB_SECRET=

CLOUD_RUN_STITCH_URL=
CLOUD_RUN_STITCH_SECRET=

DEEPSEEK_API_KEY=
VISION_PROVIDER=
VISION_API_KEY=
VISION_BASE_URL=
VISION_MODEL_LITE=
VISION_MODEL_STANDARD=
VISION_MODEL_STRICT=
OPENAI_MODERATION_MODEL=omni-moderation-latest

EVOLINK_API_KEY=
EVOLINK_BASE_URL=
EVOLINK_VIDEO_MODEL=veo3.1-pro-beta

APIMART_API_KEY=
APIMART_BASE_URL=
APIMART_PIXVERSE_MODEL=pixverse-v6
```

### 1.2 环境隔离

必须支持：

- `development`
- `staging`
- `production`

要求：

- 每个环境使用不同 provider key。
- staging 允许真实调用，但任务必须标记 `is_test = true`。
- production 内部测试任务仍需标记 `is_test = true`。
- provider/key 需要每日成本上限、并发上限、失败暂停策略。

### 1.3 验收

- [ ] `.env.example` 包含所有必需变量。
- [ ] 文档说明真实密钥不得提交。
- [ ] 未配置关键密钥时，对应功能显示不可用。
- [ ] 不存在“假成功”兜底。

## 2. 项目初始化 SPEC

### 2.1 目标

建立可部署 Next.js 应用骨架，同时保留已有 docs 和项目指令文件。

### 2.2 文件边界

创建或维护：

- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `postcss.config.mjs`
- `tailwind.config.ts`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/api/health/route.ts`
- `src/components/ui`
- `src/lib`
- `src/server`

### 2.3 任务

- [ ] 在实现分支初始化 Next.js + TypeScript。
- [ ] 配置 Tailwind CSS。
- [ ] 配置 Radix UI 基础依赖。
- [ ] 配置 ESLint。
- [ ] 新增 `npm run typecheck`。
- [ ] 新增健康检查 API：`GET /api/health`。
- [ ] 首页显示最小可用产品名称和开发状态。
- [ ] 不接入支付、模型或数据库业务逻辑。

### 2.4 验收

- [ ] `npm run lint` 通过。
- [ ] `npm run typecheck` 通过。
- [ ] `npm run build` 通过。
- [ ] `GET /api/health` 返回 `200`。
- [ ] Vercel 能部署基础应用。

## 3. 数据库与 Drizzle SPEC

### 3.1 目标

用 Drizzle 建立 Neon Postgres 数据访问层和 MVP 表结构。

### 3.2 文件边界

建议创建：

- `src/lib/db/client.ts`
- `src/lib/db/schema/index.ts`
- `src/lib/db/schema/auth.ts`
- `src/lib/db/schema/users.ts`
- `src/lib/db/schema/assets.ts`
- `src/lib/db/schema/templates.ts`
- `src/lib/db/schema/jobs.ts`
- `src/lib/db/schema/credits.ts`
- `src/lib/db/schema/providers.ts`
- `src/lib/db/schema/audit.ts`
- `src/lib/db/migrate.ts`
- `drizzle.config.ts`

### 3.3 表结构分组

认证：

- better-auth 默认表。
- `user_profiles`
- `admin_roles`

素材：

- `assets`
- `asset_analyses`

模板：

- `shot_templates`
- `shot_template_metrics`

任务：

- `video_jobs`
- `video_job_assets`
- `storyboards`
- `video_segments`
- `stitch_jobs`
- `post_qa_results`
- `job_state_events`

账务：

- `credit_wallets`
- `credit_ledger`
- `orders`

模型：

- `model_providers`
- `provider_keys`
- `model_routes`
- `provider_call_logs`
- `prompt_moderation_results`

审计：

- `admin_audit_logs`
- `abuse_events`

### 3.4 关键字段要求

所有业务表建议包含：

- `id`
- `created_at`
- `updated_at`

涉及软删除的表包含：

- `deleted_at`

任务表必须包含：

- `status`
- `is_test`
- `locked_by`
- `locked_until`
- `attempt_count`
- `last_error`
- `next_retry_at`

模型调用必须记录：

- `provider`
- `model`
- `purpose`
- `request_snapshot`
- `response_summary`
- `cost_estimate`
- `duration_ms`
- `status`
- `fallback_reason`

点数流水必须记录：

- `user_id`
- `type`
- `amount`
- `balance_before`
- `balance_after`
- `related_job_id`
- `reason`
- `idempotency_key`

### 3.5 验收

- [ ] Drizzle migration 能在空 Neon 库执行。
- [ ] 所有核心表存在。
- [ ] 任务、片段、点数、模型调用、审计都不是 JSON 大杂烩。
- [ ] `video_segments` 独立成表。
- [ ] `credit_ledger` 独立成表。
- [ ] `provider_call_logs` 独立成表。

## 4. 认证与权限 SPEC

### 4.1 目标

使用 better-auth 支持 Google OAuth 与 Resend Email OTP/Magic Link，不做密码登录。

### 4.2 文件边界

建议创建：

- `src/lib/auth/config.ts`
- `src/lib/auth/server.ts`
- `src/app/api/auth/[...all]/route.ts`
- `src/server/auth/onboarding.ts`
- `src/server/auth/admin-access.ts`
- `src/app/(auth)/login/page.tsx`

### 4.3 任务

- [ ] 配置 better-auth。
- [ ] 配置 Google OAuth。
- [ ] 配置 Resend Email OTP/Magic Link。
- [ ] 禁用密码登录。
- [ ] 首次登录创建 `user_profiles`。
- [ ] 邮箱验证完成后才可发放免费试用。
- [ ] 管理员后台使用 Google OAuth + 白名单邮箱。
- [ ] 支持 `admin` 和 `operator`。
- [ ] 所有后台 API 校验角色。

### 4.4 验收

- [ ] Google 登录成功。
- [ ] Email OTP/Magic Link 登录成功。
- [ ] 密码登录入口不存在。
- [ ] 非白名单用户不能进入后台。
- [ ] `admin` 可以访问全部后台功能。
- [ ] `operator` 不能修改价格、API Key 或模型路由。

## 5. 点数与 Creem 支付 SPEC

### 5.1 目标

真实接入 Creem，建立点数包、订单和点数账本。

### 5.2 文件边界

建议创建：

- `src/lib/credits/wallet.ts`
- `src/lib/credits/ledger.ts`
- `src/lib/credits/reserve.ts`
- `src/lib/credits/capture.ts`
- `src/lib/providers/creem/client.ts`
- `src/lib/providers/creem/webhook.ts`
- `src/app/api/webhooks/creem/route.ts`
- `src/app/(dashboard)/billing/page.tsx`
- `src/app/admin/orders/page.tsx`

### 5.3 点数包

默认点数包：

- Starter：9.99 USD / 100 点。
- Creator：29.99 USD / 360 点。
- Studio：79.99 USD / 1100 点。

视频消耗：

- 8 秒：70 点。
- 16 秒：130 点。
- 24 秒：190 点。
- Strict 质检：每 8 秒 +20 点。

### 5.4 任务

- [ ] 真实接入 Creem checkout。
- [ ] 真实接入 Creem webhook。
- [ ] 校验 webhook 签名。
- [ ] webhook 幂等处理。
- [ ] 支付成功写 `orders`。
- [ ] 支付成功写 `credit_ledger.purchase`。
- [ ] 实现 `reserve`。
- [ ] 实现 `capture`。
- [ ] 实现 `release`。
- [ ] 实现 `refund`。
- [ ] 实现 `admin_adjust`。
- [ ] 免费试用发放写账本流水。
- [ ] 后台可查看订单、钱包、流水。

### 5.5 验收

- [ ] 支付成功只充值一次。
- [ ] 重放 webhook 不重复充值。
- [ ] 用户确认分镜后冻结点数。
- [ ] Post-QA 通过后才正式扣点。
- [ ] 供应商失败释放冻结点数。
- [ ] 系统不可交付可退款。
- [ ] 所有点数变化能从 `credit_ledger` 查到。

## 6. Creem Prompt Moderation SPEC

### 6.1 目标

接入 Creem `POST /v1/moderation/prompt`，作为图片/视频生成前的强制合规门禁。

### 6.2 文件边界

建议创建：

- `src/lib/providers/creem/moderation.ts`
- `src/server/moderation/check-prompt.ts`
- `src/server/moderation/prompt-sources.ts`
- `src/app/admin/moderation/page.tsx`

### 6.3 审核对象

必须审核：

- 用户卖点文本。
- 用户场景描述。
- 用户风格偏好。
- 用户自由文本补充。
- DeepSeek 生成的最终视频 prompt。

### 6.4 决策规则

- `allow`：继续。
- `flag`：按 `deny` 处理。
- `deny`：阻止生成。
- 超时、网络错误、5xx：fail closed，阻止生成。

### 6.5 验收

- [ ] 未通过 moderation 的任务不会冻结点数。
- [ ] 未通过 moderation 的 prompt 不会进入 DeepSeek 或视频模型。
- [ ] moderation 失败时不会绕过继续生成。
- [ ] 后台可查看 moderation 结果。
- [ ] 所有结果写入 `prompt_moderation_results`。

## 7. R2 素材上传与文件访问 SPEC

### 7.1 目标

使用 Cloudflare R2 保存用户原图、缩略图、片段、最终视频、抽帧图。

### 7.2 文件边界

建议创建：

- `src/lib/storage/r2-client.ts`
- `src/lib/storage/keys.ts`
- `src/lib/storage/presign.ts`
- `src/lib/storage/delete.ts`
- `src/app/api/uploads/presign/route.ts`
- `src/app/api/files/signed-url/route.ts`

### 7.3 路径规则

```text
/users/{userId}/assets/{assetId}/original.{ext}
/users/{userId}/assets/{assetId}/thumb.webp
/jobs/{jobId}/segments/{segmentId}/video.mp4
/jobs/{jobId}/stitched/final.mp4
/jobs/{jobId}/qa/frames/{frameIndex}.jpg
/jobs/{jobId}/covers/cover.webp
```

### 7.4 任务

- [ ] 实现 signed URL 直传。
- [ ] 校验文件类型。
- [ ] 校验文件大小。
- [ ] 创建 `assets` 记录。
- [ ] 保存 R2 key，不保存永久公开 URL。
- [ ] 生成用户下载 signed URL。
- [ ] 生成模型访问 signed URL。
- [ ] 用户只能访问自己的文件。
- [ ] 管理员访问文件也要权限校验。

### 7.5 验收

- [ ] R2 bucket 不公开。
- [ ] 用户不能下载别人的文件。
- [ ] signed URL 有效期可配置。
- [ ] 删除采用 `deleted_at` + 异步清理。

## 8. 镜头模板与规则引擎 SPEC

### 8.1 目标

实现 12 个 MVP 镜头模板，并根据素材完整度输出推荐/可选/不可用模板。

### 8.2 文件边界

建议创建：

- `src/lib/templates/catalog.ts`
- `src/lib/templates/rules.ts`
- `src/lib/templates/recommend.ts`
- `src/lib/templates/seed.ts`
- `src/app/admin/templates/page.tsx`

### 8.3 MVP 模板

必须实现：

- `front_push_in`
- `front_pan`
- `product_float`
- `model_front_pose`
- `front_crop_detail`
- `fabric_macro`
- `neckline_closeup`
- `cuff_closeup`
- `print_closeup`
- `back_display`
- `front_to_back_cut`
- `minimal_studio`

### 8.4 规则

- 无背面图时禁用 `back_display` 和 `front_to_back_cut`。
- 无细节图时禁用所有细节特写。
- 免费试用只允许低风险模板。
- 中高风险模板必须展示风险提示。
- DeepSeek 只能引用当前任务可用模板 ID。

### 8.5 验收

- [ ] 只有正面图时不会推荐背面展示。
- [ ] 无细节图时不能选择细节模板。
- [ ] 不可用模板显示原因。
- [ ] 模板有状态和版本。
- [ ] 后台可暂停模板。

## 9. 视觉识别与素材分析 SPEC

### 9.1 目标

真实接入低成本 GPT 视觉模型，输出素材分析 JSON。

### 9.2 文件边界

建议创建：

- `src/lib/providers/vision/client.ts`
- `src/server/assets/analyze.ts`
- `src/server/assets/classify-role.ts`
- `src/server/assets/quality.ts`

### 9.3 输出 JSON

必须包含：

- `asset_role`
- `garment_category`
- `view_angle`
- `human_present`
- `visible_details`
- `not_visible_details`
- `quality`
- `confidence`
- `risk_flags`

### 9.4 任务

- [ ] Lite 预检判断是否服装图、是否清晰、是否违规。
- [ ] Standard 分析识别正面/背面/侧面/细节/场景。
- [ ] Strict 用于真人、正背切换、高风险任务、申诉。
- [ ] 保存 `asset_analysis_json`。
- [ ] 视觉模型只输出观察结果，不直接决定模板权限。
- [ ] 规则引擎根据分析结果决定模板可用性。

### 9.5 验收

- [ ] 图片作为 image input 传入，不是普通文本 URL。
- [ ] 分析结果可复现。
- [ ] 模型调用写 `provider_call_logs`。
- [ ] 素材不合格时不会继续生成。

## 10. 模型路由与 Provider Key SPEC

### 10.1 目标

建立可配置 provider router，支持真实模型调用、成本上限、fallback 和调用日志。

### 10.2 文件边界

建议创建：

- `src/lib/providers/router.ts`
- `src/lib/providers/keys.ts`
- `src/lib/providers/log-call.ts`
- `src/lib/providers/deepseek/client.ts`
- `src/lib/providers/evolink/client.ts`
- `src/lib/providers/apimart/client.ts`
- `src/app/admin/providers/page.tsx`
- `src/app/admin/model-routes/page.tsx`

### 10.3 purpose

必须支持：

- `content_safety`
- `creem_prompt_moderation`
- `lite_asset_check`
- `standard_asset_analysis`
- `strict_asset_review`
- `storyboard`
- `video_generation`
- `post_qa`
- `experimental_video`

### 10.4 任务

- [ ] Key 加密存储。
- [ ] 后台不显示完整 Key。
- [ ] provider/key 状态：active / paused / exhausted / error。
- [ ] route 支持 primary/fallback。
- [ ] fallback 前计算毛利阈值。
- [ ] 低于 45% 毛利不能自动 fallback。
- [ ] 实验模型不进入公开自动 fallback。
- [ ] 每次调用写日志。
- [ ] 每个 key 配置每日成本上限。
- [ ] 每个 key 配置并发上限。
- [ ] 失败率过高时自动暂停或进入 error。

### 10.5 验收

- [ ] DeepSeek 真实调用。
- [ ] 视觉模型真实调用。
- [ ] EvoLink 真实调用。
- [ ] PixVerse 仅管理员内测。
- [ ] 未配置 key 时显示不可用。
- [ ] 不存在假成功返回。

## 11. DeepSeek 分镜与 Prompt SPEC

### 11.1 目标

使用 DeepSeek `deepseek-v4-flash` 根据素材分析和用户模板选择生成 storyboard JSON。

### 11.2 文件边界

建议创建：

- `src/server/storyboard/generate.ts`
- `src/server/storyboard/schema.ts`
- `src/server/storyboard/constraints.ts`
- `src/server/storyboard/final-prompt.ts`

### 11.3 规则

- DeepSeek 只能引用已启用、当前任务可用的 `shot_template_id`。
- DeepSeek 不能判断图片内容。
- DeepSeek 不能创造新镜头模板。
- 最终 prompt 必须追加系统硬约束。
- 最终 prompt 必须过 Creem Moderation。

### 11.4 验收

- [ ] 8 秒 storyboard 只包含 1 段。
- [ ] 16 秒 storyboard 只包含 2 段。
- [ ] 24 秒 storyboard 只包含 3 段。
- [ ] JSON schema 校验失败时不进入生成。
- [ ] storyboards 可在后台查看。

## 12. 任务状态机与 Worker Tick SPEC

### 12.1 目标

实现可恢复、可重试、可审计的异步状态机。

### 12.2 文件边界

建议创建：

- `src/server/jobs/state-machine.ts`
- `src/server/jobs/events.ts`
- `src/server/jobs/locks.ts`
- `src/server/workers/tick.ts`
- `src/app/api/internal/worker/tick/route.ts`

### 12.3 状态要求

必须覆盖：

- `draft_uploaded`
- `lite_check_queued`
- `lite_check_running`
- `lite_check_passed`
- `asset_analysis_queued`
- `asset_analysis_running`
- `asset_analysis_passed`
- `storyboard_draft_ready`
- `storyboard_confirmed`
- `prompt_moderation_running`
- `prompt_moderation_passed`
- `prompt_moderation_blocked`
- `credits_reserved`
- `segments_queued`
- `segment_generating`
- `segment_succeeded`
- `segment_failed`
- `stitching_queued`
- `stitching_running`
- `stitched`
- `post_qa_queued`
- `post_qa_running`
- `post_qa_passed`
- `post_qa_failed`
- `deliverable`
- `failed_released`
- `failed_refunded`

### 12.4 worker tick

规则：

- cron-job.org 每 1 分钟请求 `/api/internal/worker/tick`。
- 请求必须校验 `CRON_JOB_SECRET`。
- 单次 tick 处理有限数量任务。
- 任务领取必须用锁。
- 锁过期任务可恢复。
- 重复 tick 不会重复扣点或重复提交模型。

### 12.5 验收

- [ ] 状态流转可审计。
- [ ] 卡死任务可恢复。
- [ ] 重复 tick 幂等。
- [ ] 任务失败不会无限重试。

## 13. 视频生成 Segment SPEC

### 13.1 目标

真实调用 EvoLink `veo3.1-pro-beta` 生成 8 秒片段。

### 13.2 文件边界

建议创建：

- `src/lib/providers/evolink/video.ts`
- `src/server/video/create-segments.ts`
- `src/server/video/submit-segment.ts`
- `src/server/video/poll-segment.ts`
- `src/server/video/store-segment.ts`

### 13.3 规则

- 8 秒任务生成 1 个 segment。
- 16 秒任务生成 2 个 segment。
- 24 秒任务生成 3 个 segment。
- 某个 segment 失败只重试该 segment。
- 供应商输出链接必须及时转存 R2。
- segment 保存 prompt、模板 ID、输入素材快照、provider task ID、成本、重试次数。

### 13.4 验收

- [ ] EvoLink 真实提交成功。
- [ ] provider task ID 保存。
- [ ] 轮询状态可恢复。
- [ ] 供应商链接转存 R2。
- [ ] 单段失败不会整单重跑。

## 14. Cloud Run Stitch Worker SPEC

### 14.1 目标

Cloud Run 独立执行视频拼接、封面生成和抽帧。

入口：

- Worker 源码：`workers/stitch-worker/`。
- Worker 部署文档：`docs/deployment/cloud-run-stitch.md`。
- 主应用触发模块：`src/server/stitch/trigger-cloud-run.ts`。
- 主应用创建 job API：`POST /api/internal/stitch/jobs`。
- 主应用 callback API：`POST /api/internal/stitch/callback`。
- Cloud Run 构建上下文必须使用 `workers/stitch-worker`。

### 14.2 文件边界

建议单独目录：

- `workers/stitch-worker/package.json`
- `workers/stitch-worker/src/index.ts`
- `workers/stitch-worker/src/ffmpeg.ts`
- `workers/stitch-worker/src/r2.ts`
- `workers/stitch-worker/src/callback.ts`
- `workers/stitch-worker/Dockerfile`

主应用：

- `src/server/stitch/create-job.ts`
- `src/server/stitch/trigger-cloud-run.ts`
- `src/app/api/internal/stitch/callback/route.ts`

### 14.3 触发方式

- Next.js/worker tick 创建 `stitch_job`。
- 主应用通过内部受保护请求触发 Cloud Run。
- Cloud Run 执行具体 stitch job。
- Cloud Run 回调主应用更新状态。

### 14.4 任务

- [ ] 下载 R2 segment 视频。
- [ ] ffmpeg 拼接/转码。
- [ ] 生成封面。
- [ ] 根据 `post_qa_mode` 抽帧。
- [ ] 上传最终视频、封面、抽帧图到 R2。
- [ ] 清理临时文件。
- [ ] 回写 stitch job 状态。

### 14.5 验收

- [ ] Vercel 不执行 ffmpeg。
- [ ] 16/24 秒任务输出一个完整视频。
- [ ] 抽帧图上传 R2。
- [ ] 拼接失败可重试。
- [ ] Cloud Run 日志可排查。

## 15. Post-QA SPEC

### 15.1 目标

对最终成片抽帧做质量检查，质检通过后才扣点并开放下载。

### 15.2 文件边界

建议创建：

- `src/server/post-qa/mode.ts`
- `src/server/post-qa/check.ts`
- `src/server/post-qa/result.ts`
- `src/server/post-qa/resolve-failure.ts`

### 15.3 模式

- `off`：仅管理员/内测。
- `lite`：8 秒抽 2-3 帧，低成本视觉模型。
- `standard`：每 8 秒抽 4-5 帧，默认视觉模型。
- `strict`：每 8 秒抽 6-8 帧 + 转场帧，强视觉模型。

### 15.4 规则

- 普通用户不能关闭 Post-QA。
- 免费试用和低风险 8 秒默认 lite。
- 16/24 秒付费默认 standard。
- 真人、背面、正背切换、中高风险模板强制 strict。
- 质检通过后执行 `credit_ledger.capture`。
- 质检失败后进入重试、人工审核、释放或退款。
- 前台不能承诺 100% 无异常。

### 15.5 验收

- [ ] 质检通过前用户不能下载。
- [ ] 质检通过前不能正式扣点。
- [ ] `off` 只能管理员使用。
- [ ] Post-QA 结果后台可见。

## 16. 用户前台 SPEC

### 16.1 目标

实现用户自助生成完整流程。

### 16.2 页面

- Landing。
- 登录页。
- 生成工作台。
- 模板选择。
- 分镜确认。
- 生成进度。
- 任务历史。
- 任务详情。
- 点数账单。

### 16.3 体验规则

- 登录后主 CTA 是“创建视频”。
- 用户自己选模板，系统给推荐。
- 不可用模板置灰并显示原因。
- 任务列表只显示完整视频任务。
- 进度可显示“片段 2/3 生成中”。
- 最终只下载完整视频。
- 失败原因必须用户可理解。
- 点数冻结、扣除、退款要透明。

### 16.4 验收

- [ ] 用户可完成上传到分镜确认。
- [ ] 用户可看到模板推荐和禁用原因。
- [ ] 用户可看到生成进度。
- [ ] 用户可下载完整视频。
- [ ] 用户看不到 provider key、prompt 内部细节、供应商错误码。

## 17. 管理员后台 SPEC

### 17.1 目标

实现运营审计、成本控制和异常处理。

### 17.2 页面

- Dashboard。
- 用户管理。
- 任务管理。
- 任务详情。
- 异常任务队列。
- 模型调用日志。
- Prompt Moderation 结果。
- Provider/Key 管理。
- Model Route 管理。
- 镜头模板管理。
- 点数与订单管理。
- 管理员审计日志。

### 17.3 必须操作

- 手动重试片段。
- 标记不可交付并退款。
- 调整模板状态。
- 调整 provider/key 状态。
- 查看 `is_test` 任务。
- 筛选测试任务和正式任务。
- 查看成本、耗时、fallback 原因。

### 17.4 验收

- [ ] 管理员能定位任务失败步骤。
- [ ] 管理员能看到每段 8 秒片段。
- [ ] 管理员能看到模型调用链路。
- [ ] 管理员能看到点数流水。
- [ ] 敏感操作写 `admin_audit_logs`。

## 18. 部署验收前 SPEC

### 18.1 Vercel

- [ ] Vercel 项目创建。
- [ ] production 环境变量配置。
- [ ] staging 环境变量配置。
- [ ] build 成功。
- [ ] `/api/health` 可访问。
- [ ] better-auth URL 配置正确。

### 18.2 Neon

- [ ] production 数据库创建。
- [ ] staging 数据库创建。
- [ ] migration 执行成功。
- [ ] 数据库连接池配置合理。

### 18.3 R2

- [ ] bucket 创建。
- [ ] access key 配置。
- [ ] signed URL 可上传。
- [ ] signed URL 可下载。
- [ ] bucket 非公开。

### 18.4 Creem

- [ ] checkout 测试成功。
- [ ] webhook 测试成功。
- [ ] webhook 重放不会重复充值。
- [ ] moderation `allow` 用例通过。
- [ ] moderation `flag` 用例阻止生成。
- [ ] moderation `deny` 用例阻止生成。
- [ ] moderation 失败时 fail closed。

### 18.5 Resend

- [ ] 邮件域名配置。
- [ ] Email OTP/Magic Link 到达。
- [ ] 登录邮件限频生效。

### 18.6 Google OAuth

- [ ] OAuth callback URL 正确。
- [ ] Google 登录可用。
- [ ] 管理员白名单可用。

### 18.7 模型

- [ ] DeepSeek 真实调用成功。
- [ ] 视觉模型 Lite 调用成功。
- [ ] 视觉模型 Standard 调用成功。
- [ ] EvoLink `veo3.1-pro-beta` 提交任务成功。
- [ ] EvoLink 轮询成功。
- [ ] EvoLink 输出转存 R2 成功。
- [ ] APIMart PixVerse 仅管理员内测可见。

### 18.8 Cloud Run

- [ ] stitch-worker 部署成功。
- [ ] 主应用能触发 Cloud Run job。
- [ ] Cloud Run 能下载 R2 片段。
- [ ] Cloud Run 能拼接视频。
- [ ] Cloud Run 能抽帧。
- [ ] Cloud Run 能上传最终视频和抽帧图。
- [ ] Cloud Run 能回写状态。

### 18.9 cron-job.org

- [ ] 每 1 分钟触发 worker tick。
- [ ] secret 校验生效。
- [ ] 重复触发幂等。

### 18.10 端到端验收

必须真实跑通：

- [ ] 免费试用 8 秒低风险模板。
- [ ] 付费 8 秒。
- [ ] 付费 16 秒。
- [ ] 付费 24 秒。
- [ ] 无背面图时背面模板不可用。
- [ ] 有背面图时背面展示可选。
- [ ] 无细节图时细节模板不可用。
- [ ] Creem moderation 拦截用例。
- [ ] 供应商失败释放点数。
- [ ] Post-QA 失败进入重试或退款。
- [ ] 管理员可查看完整审计链路。

### 18.11 不允许上线的阻断项

任何一项存在都不能进入部署验收：

- [ ] 支付 webhook 不能幂等。
- [ ] 点数可被重复扣除。
- [ ] 视频模型调用没有日志。
- [ ] Creem Moderation 可被绕过。
- [ ] 供应商失败不释放点数。
- [ ] Post-QA 通过前用户可下载。
- [ ] 生成结果没有转存 R2。
- [ ] API Key 明文暴露到前端或后台。
- [ ] 普通用户可以关闭 Post-QA。
- [ ] Cloud Run 拼接失败无法追踪。

## 19. 推荐开发顺序

1. 基础工程与部署骨架。
2. Drizzle + Neon 数据模型。
3. better-auth + Google + Resend。
4. R2 上传和 signed URL。
5. Creem 支付 + 点数账本。
6. Creem Prompt Moderation。
7. provider router + key 管理。
8. 模板库和规则引擎。
9. 视觉素材分析。
10. DeepSeek 分镜。
11. 任务状态机和 worker tick。
12. EvoLink 片段生成。
13. Cloud Run 拼接与抽帧。
14. Post-QA。
15. 用户前台工作台。
16. 管理员后台。
17. staging 端到端验收。
18. production 部署验收前检查。

不要打乱顺序去先写视频生成。先写视频生成看起来快，实际上会把账本、状态机、审计和失败恢复全部拖成烂尾。
