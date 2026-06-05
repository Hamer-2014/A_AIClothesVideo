# 技术架构方案

版本：MVP 草案  
日期：2026-06-05  
关联文档：[PRD.md](PRD.md)

## 1. 目标

本技术方案用于把 PRD 中的产品需求落成可实现的系统架构。它不是代码实现计划，也不是详细数据库迁移文件，而是实现前必须遵守的技术边界、组件职责、数据流和风险控制方案。

核心目标：

- 保持用户侧体验简单：用户看到的是完整视频任务。
- 保持后台可审计：管理员可以追踪每个模型调用、片段、点数变化和状态变化。
- 避免长任务阻塞 Vercel 请求。
- 避免模型失败导致重复扣费、重复生成或状态丢失。
- 让 Post-QA 抽帧质检在成本可控的前提下降低交付风险。
- 真实接入 Creem 和大模型，不依赖 mock 成功链路掩盖供应商问题。
- 为后续新增模型、镜头模板、质量模式预留扩展能力。

## 2. 技术栈

| 模块 | 方案 |
|---|---|
| 主应用 | Next.js |
| 部署 | Vercel |
| UI | Tailwind CSS + Radix UI |
| 数据库 | Neon Postgres |
| ORM/数据库访问 | Drizzle |
| 认证 | better-auth |
| OAuth | Google OAuth |
| 邮件登录 | Resend + Email OTP/Magic Link |
| 支付 | Creem |
| Prompt 合规 | Creem Moderation |
| 对象存储 | Cloudflare R2 |
| 定时触发 | cron-job.org |
| 视频拼接 | Cloud Run `stitch-worker` + ffmpeg |
| Post-QA 抽帧 | Cloud Run `stitch-worker` + 视觉模型 |
| 提示词/分镜 | DeepSeek `deepseek-v4-flash` |
| 视觉识别/质检 | 低成本 GPT 视觉模型，风险任务升级强模型 |
| 内容安全 | `omni-moderation-latest` 或等价方案 |
| 视频生成 | EvoLink `veo3.1-pro-beta` |
| 实验视频模型 | APIMart `pixverse-v6` |

注意：技术栈清单不是架构本身。真正要控制的是状态机、账本、异步任务、模型路由和审计。

## 2.1 真实接入策略

MVP 开发阶段直接接入真实 Creem 和真实模型服务，不做 mock 成功链路。

真实接入范围：

- Creem checkout。
- Creem webhook。
- Creem Prompt Moderation。
- DeepSeek `deepseek-v4-flash`。
- 视觉识别/质检模型。
- EvoLink `veo3.1-pro-beta`。
- APIMart `pixverse-v6`，仅管理员内测。

约束：

- 未配置真实 API Key 时，对应功能显示不可用，不伪造成功结果。
- 本地开发可以跳过完整生成链路，但不能伪造已交付视频。
- 所有真实调用必须写调用日志和成本估算。
- 测试任务必须标记 `is_test = true`。
- 后台必须能筛选测试任务和正式任务。
- development、staging、production 使用不同 key、额度和任务标记。
- 每个 provider/key 需要配置每日成本上限、并发上限和失败暂停策略。
- 真实接入不等于无保护直连；所有外部调用仍必须经过 provider router。

## 3. 系统组件职责

### 3.1 Next.js on Vercel

负责：

- Landing 页面。
- 用户生成工作台。
- 任务历史和详情。
- 点数账单页。
- 管理员后台。
- 用户 API。
- 管理员 API。
- 内部 worker tick endpoint。
- Creem webhook endpoint。
- Creem moderation 调用封装。
- better-auth 认证 endpoint。

不负责：

- 长时间等待视频模型生成。
- ffmpeg 拼接。
- 长时间下载和上传大视频。
- 将本地文件系统作为持久存储。

### 3.2 Neon Postgres

负责：

- 存储业务数据。
- 作为任务状态机的唯一真实来源。
- 存储点数账本。
- 存储模型路由配置。
- 存储模型调用日志。
- 存储管理员审计日志。

原则：

- 任务状态以数据库为准，不以供应商回调或临时内存为准。
- 点数变化必须写流水。
- 每个 8 秒片段必须独立记录。
- 模型调用必须可追踪和可复现。

### 3.3 Cloudflare R2

负责存储：

- 用户上传原图。
- 缩略图。
- 视频模型生成的 8 秒片段。
- 拼接后的最终视频。
- 抽帧质检图片。
- 封面图。

原则：

- Bucket 默认不公开。
- 前台下载使用 signed URL。
- 模型读取图片也使用短期 signed URL。
- 供应商返回的视频链接必须及时转存到 R2。
- 删除采用异步清理，不在用户请求中同步删除大文件。

### 3.4 cron-job.org

负责：

- 定时请求内部 worker endpoint，例如 `/api/internal/worker/tick`。
- 唤醒系统推进待处理任务。

不负责：

- 直接执行长任务。
- 存储任务状态。
- 判断业务逻辑。

要求：

- 请求必须带 secret。
- 内部 endpoint 必须校验 secret。
- 单次 tick 只处理有限数量任务。
- tick 要幂等，重复调用不能导致重复扣费或重复提交生成。
- MVP 触发频率默认为每 1 分钟。

### 3.5 Cloud Run stitch-worker

负责：

- 领取 `stitching_queued` 的拼接任务，或由 Next.js 内部 API 触发具体拼接任务。
- 从 R2 下载片段视频。
- 使用 ffmpeg 拼接/转码。
- 拼接完成后按 `post_qa_mode` 抽帧。
- 生成封面或交给主应用生成封面任务。
- 上传最终视频、封面和抽帧图到 R2。
- 更新 `stitch_jobs` 和 `video_jobs` 状态。

要求：

- 每个拼接任务有唯一 job ID。
- 支持失败重试。
- 临时文件必须清理。
- 失败原因写入数据库。
- 不把最终视频长期存放在容器本地磁盘。

触发方式：

- Next.js/worker tick 创建 `stitch_job`。
- 主应用通过内部受保护请求触发 Cloud Run 执行具体 job。
- Cloud Run 执行完成后回写主应用内部 callback 或直接调用受保护状态更新 API。
- MVP 不要求 Cloud Run 主动轮询数据库。

## 4. 推荐应用目录结构

最终实现可以调整，但建议从一开始保持边界清晰。

```text
src/
  app/
    (marketing)/
    (auth)/
    (dashboard)/
    admin/
    api/
      auth/
      jobs/
      uploads/
      credits/
      webhooks/
        creem/
      internal/
        worker/
  components/
    ui/
    layout/
    jobs/
    templates/
    admin/
  lib/
    auth/
    db/
    credits/
    jobs/
    models/
    providers/
    storage/
    security/
    templates/
    video/
  server/
    workflows/
    workers/
    services/
```

建议边界：

- `lib/credits`：点数冻结、扣除、释放、退款。
- `lib/jobs`：任务状态机。
- `lib/models`：模型路由、模型调用封装。
- `lib/providers`：OpenAI-compatible、DeepSeek、EvoLink、APIMart、Creem、Resend 等 provider 客户端。
- `lib/storage`：R2 signed URL、上传、删除。
- `lib/templates`：镜头模板规则和可用性判断。
- `server/workflows`：高层业务流程编排，不直接写 UI。

不要把供应商 API 调用散落在页面组件或 route handler 里。

## 5. 主要数据流

### 5.1 登录

1. 用户使用 Google OAuth 或 Email OTP/Magic Link 登录。
2. better-auth 完成认证。
3. 首次登录创建 `user_profiles`。
4. 邮箱验证完成后，系统判断是否发放免费试用额度。
5. 免费试用发放写入 `credit_ledger`。

### 5.2 上传素材

1. 前端请求上传授权。
2. 服务端生成 R2 上传 URL 或代理上传策略。
3. 用户上传原图到 R2。
4. 服务端创建 `assets` 记录。
5. 生成缩略图任务可异步执行。
6. 创建或更新 `video_job` 状态为 `draft_uploaded`。

### 5.3 素材分析与模板推荐

1. worker 领取 `draft_uploaded` 或 `lite_check_queued` 任务。
2. 调用内容安全模型。
3. 调用 Lite/Standard 视觉模型。
4. 保存 `asset_analyses`。
5. 规则引擎根据素材识别结果和模板要求生成：
   - 推荐模板。
   - 可选模板。
   - 不可用模板及原因。
6. 用户进入模板选择步骤。

### 5.4 分镜生成

1. 用户选择时长、比例、模板。
2. 后端校验模板是否可用。
3. 对用户自由文本、卖点、场景描述调用 Creem Prompt Moderation。
4. 只有 `allow` 才调用 DeepSeek `deepseek-v4-flash`。
5. DeepSeek 输出结构化 JSON。
6. 后端校验 JSON schema。
7. 后端追加系统硬约束。
8. 保存 `storyboards`。
9. 用户确认分镜和点数消耗。

### 5.5 Prompt Moderation 与点数冻结

1. 用户确认分镜后进入生成前校验。
2. 对最终将提交给视频模型的 prompt 调用 Creem Prompt Moderation。
3. 保存 `prompt_moderation_results`。
4. `allow` 才继续检查余额。
5. `flag` 和 `deny` 都阻止生成，不冻结点数。
6. Creem Moderation 超时、网络错误或 5xx 时 fail closed，临时阻止生成。
7. 检查余额。
8. 写入 `credit_ledger` 的 `reserve` 记录。
9. 更新 `credit_wallets.available` 和 `credit_wallets.reserved`。
10. 更新 `video_jobs` 状态为 `credits_reserved`。

冻结点数后才能提交视频模型，防止生成成本已经发生但用户余额不足。
Creem Prompt Moderation 必须在冻结点数和提交视频模型之前完成，防止违规 prompt 进入生成链路。

### 5.6 视频生成

1. worker 根据 `storyboards` 创建 `video_segments`。
2. 每个 segment 对应一个 8 秒片段。
3. 提交 EvoLink `veo3.1-pro-beta` 异步生成任务。
4. 保存供应商 task ID、请求快照、prompt、模型版本、成本估算。
5. 状态进入 `segment_generating`。
6. cron tick 定时轮询供应商任务状态。
7. 生成成功后立即下载供应商输出并转存 R2。
8. 更新片段状态为 `segment_succeeded`。
9. 失败时按片段重试，不整单重跑。

### 5.7 拼接

1. 所有片段成功后，创建 `stitch_jobs`。
2. 状态进入 `stitching_queued`。
3. Cloud Run `stitch-worker` 领取任务。
4. 下载所有片段。
5. ffmpeg 拼接/转码。
6. 在同一 worker 内按 `post_qa_mode` 抽帧，生成 QA frame 文件。
7. 上传最终视频、封面和抽帧图到 R2。
8. 更新 `stitch_jobs` 和 `video_jobs`。
9. 状态进入 `post_qa_queued` 或 `post_qa_running`。

### 5.8 生成后质检

1. 读取 Cloud Run worker 生成的抽帧图。
2. 调用视觉模型做 post-QA。
3. 检查：
   - 服装主色是否明显漂移。
   - 是否出现不存在的背面/细节。
   - 是否有人体异常。
   - 是否内容违规。
   - 是否画面损坏。
4. 通过则状态进入 `deliverable`。
5. 捕获冻结点数，写 `capture` 流水。
6. 不通过则根据规则自动重试片段或退款。

质检必须发生在拼接完成后、点数正式扣除前、用户可下载前。

### 5.9 下载

1. 用户打开任务详情。
2. 服务端校验任务归属和状态。
3. 为最终视频生成 R2 signed URL。
4. 用户下载完整视频。

用户默认不下载单个 8 秒片段。

## 6. API 边界

### 6.1 用户 API

建议分组：

- `POST /api/uploads/presign`：创建上传授权。
- `POST /api/jobs`：创建生成任务。
- `GET /api/jobs`：任务列表。
- `GET /api/jobs/{id}`：任务详情。
- `POST /api/jobs/{id}/analyze`：触发素材分析，必要时可由 worker 自动触发。
- `POST /api/jobs/{id}/storyboard`：生成分镜草案。
- `POST /api/jobs/{id}/confirm`：确认分镜并冻结点数。
- `GET /api/jobs/{id}/download`：生成最终视频下载 URL。
- `GET /api/credits/wallet`：点数余额。
- `GET /api/credits/ledger`：点数流水。

### 6.2 管理员 API

建议分组：

- 用户管理。
- 任务管理。
- 异常队列。
- 模板管理。
- 模型 provider 管理。
- API Key 管理。
- 模型调用日志。
- 点数与订单管理。
- 管理员审计日志。

管理员 API 必须校验角色。

### 6.3 内部 API

建议：

- `POST /api/internal/worker/tick`
- `POST /api/internal/stitch/callback`
- `POST /api/internal/provider/callback`

要求：

- 必须校验 secret 或签名。
- 必须幂等。
- 不返回敏感信息。
- 不被普通用户访问。

### 6.4 Webhook

- `POST /api/webhooks/creem`
- `POST /api/internal/moderation/creem`：可选内部封装；也可以由服务端业务流程直接调用，不开放给前端。

要求：

- 校验 Creem 签名。
- 幂等处理。
- 支付成功后写订单和点数流水。
- 不能重复充值。
- 支付失败只更新订单状态，不发放点数。

## 7. 数据库实体

PRD 已列出核心实体。技术实现时建议按以下边界设计。

### 7.1 用户与认证

- better-auth 默认表。
- `user_profiles`
- `admin_roles`

### 7.2 素材与分析

- `assets`
- `asset_analyses`

### 7.3 模板

- `shot_templates`
- `shot_template_metrics`

模板必须版本化。历史任务引用的模板版本不能被静默改写。

### 7.4 任务

- `video_jobs`
- `video_job_assets`
- `storyboards`
- `video_segments`
- `stitch_jobs`
- `post_qa_results`
- `job_state_events`

`video_segments` 必须单独建表。不要把片段塞进 `video_jobs.segment_json` 里糊弄。

### 7.5 点数

- `credit_wallets`
- `credit_ledger`
- `orders`
- `prompt_moderation_results`

`credit_ledger` 是账务审计核心。所有余额变动必须有流水。

### 7.6 模型与供应商

- `model_providers`
- `provider_keys`
- `model_routes`
- `provider_call_logs`
- `prompt_moderation_results`

API Key 必须加密存储。后台不显示完整 Key。

### 7.7 审计与风控

- `admin_audit_logs`
- `abuse_events`

涉及退款、手动重试、点数调整、Key 调整、模板状态变化，都必须写审计日志。

## 8. 任务状态机

### 8.1 用户可见状态

- `uploaded`
- `checking_assets`
- `selecting_templates`
- `confirming_storyboard`
- `generating`
- `quality_checking`
- `ready`
- `failed`
- `refunded`

### 8.2 后台状态

- `draft_uploaded`
- `lite_check_queued`
- `lite_check_running`
- `lite_check_passed`
- `lite_check_failed`
- `asset_analysis_queued`
- `asset_analysis_running`
- `asset_analysis_passed`
- `asset_analysis_failed`
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
- `retrying`
- `failed_released`
- `failed_refunded`

### 8.3 状态流转原则

- 状态变化必须写 `job_state_events`。
- 状态推进必须校验当前状态，避免乱序更新。
- worker 获取任务时设置 `locked_until`。
- worker 执行结束释放锁或更新锁。
- 卡死任务由 cron tick 检测并恢复。
- 失败重试必须有上限。

## 9. 异步任务与锁

### 9.1 任务锁

每个可异步推进的任务建议有：

- `locked_by`
- `locked_until`
- `attempt_count`
- `last_error`
- `next_retry_at`

领取任务时：

1. 只领取未锁定或锁已过期的任务。
2. 设置新的 `locked_until`。
3. 使用事务或原子条件更新。
4. 未拿到锁则跳过。

### 9.2 幂等

必须幂等的动作：

- Creem webhook 入账。
- Creem Prompt Moderation 结果保存。
- 点数 reserve/capture/release/refund。
- 提交视频模型任务。
- 轮询供应商任务。
- 下载并转存供应商视频。
- 创建 stitch job。
- Cloud Run 拼接回写。

建议保存：

- `idempotency_key`
- `provider_request_id`
- `provider_task_id`
- `external_event_id`

### 9.3 重试

建议策略：

- 视觉模型失败：可短重试 1-2 次。
- DeepSeek JSON 不合法：重试 1 次，仍失败则让用户重新生成分镜。
- 视频片段失败：按片段重试，不整单重跑。
- 拼接失败：重试 Cloud Run 拼接任务。
- 质检失败：根据异常类型决定重试片段或退款。

不要无限重试。

## 10. 模型路由

### 10.1 purpose 分类

- `content_safety`
- `creem_prompt_moderation`
- `lite_asset_check`
- `standard_asset_analysis`
- `strict_asset_review`
- `storyboard`
- `video_generation`
- `post_qa`

### 10.2 默认配置

| purpose | 默认模型 | 备注 |
|---|---|---|
| `storyboard` | DeepSeek `deepseek-v4-flash` | 输出结构化分镜和 prompt 草稿 |
| `creem_prompt_moderation` | Creem `POST /v1/moderation/prompt` | 所有用户 prompt 和最终视频 prompt 生成前过审 |
| `lite_asset_check` | 低成本 GPT 视觉模型 | 可使用 nano/mini 等低成本模型 |
| `standard_asset_analysis` | `gpt-5.4-mini` 或等价 GPT 视觉模型 | 输出素材分析 JSON |
| `strict_asset_review` | `gpt-5.5` 或等价强模型 | 高风险任务、申诉、抽样复核 |
| `content_safety` | `omni-moderation-latest` 或等价方案 | 内容安全 |
| `video_generation` | EvoLink `veo3.1-pro-beta` | MVP 主视频模型 |
| `experimental_video` | APIMart `pixverse-v6` | 仅内测 |

### 10.3 fallback 原则

触发 fallback：

- 429。
- 5xx。
- 超时。
- Key 余额不足。
- 供应商不可用。

不触发 fallback：

- 素材不合格。
- 内容安全拦截。
- 规则引擎禁用模板。
- 用户余额不足。
- 低毛利模型路线。

fallback 前必须评估预计毛利。低于 45% 的路线不能自动 fallback。

Creem Prompt Moderation 不是普通模型 fallback。接入 Creem 后，它是公开视频生成链路的强制合规门禁：

- `allow`：继续。
- `flag`：阻止生成，按 `deny` 处理。
- `deny`：阻止生成。
- API 失败、超时、5xx：fail closed，阻止生成并提示稍后重试。
- 审核必须发生在排队、冻结点数和视频模型调用之前。

### 10.4 调用日志

每次模型调用记录：

- provider。
- model。
- purpose。
- request snapshot。
- response summary。
- prompt version。
- model version。
- provider task ID。
- tokens 或计费单位。
- 估算成本。
- 耗时。
- 成功/失败。
- fallback 原因。

不要在日志记录完整敏感 API Key。

### 10.5 Creem Prompt Moderation 结果

建议单独保存到 `prompt_moderation_results`：

- user ID。
- job ID。
- segment ID，可为空。
- source：user_input / storyboard_prompt / final_video_prompt。
- prompt hash。
- prompt 摘要。
- external_id。
- Creem moderation id。
- decision：allow / flag / deny。
- error code。
- latency。
- created_at。

不要在日志中长期保存完整敏感 prompt；如需排查，可保存受控摘要或加密快照。

## 11. 点数与支付

### 11.1 Creem webhook

流程：

1. Creem 发送支付事件。
2. 服务端校验签名。
3. 根据外部订单 ID 做幂等检查。
4. 创建/更新 `orders`。
5. 支付成功时写入 `credit_ledger.purchase`。
6. 更新 `credit_wallets`。

### 11.2 任务扣费

点数生命周期：

1. 用户确认分镜。
2. `reserve` 冻结点数。
3. 生成与质检通过。
4. `capture` 扣除冻结点数。

失败处理：

- 供应商失败且未交付：`release`。
- 系统质检失败且无法交付：`refund` 或释放冻结。
- 管理员调整：`admin_adjust`，必须写原因。

### 11.3 账本原则

- 不允许直接改余额而不写流水。
- 钱包余额可冗余存储，但必须能和流水对账。
- 订单金额和任务成本分开记录。
- 手续费、模型成本、存储成本用于后台毛利分析，不直接暴露给用户。

## 12. R2 存储方案

### 12.1 路径

```text
/users/{userId}/assets/{assetId}/original.{ext}
/users/{userId}/assets/{assetId}/thumb.webp
/jobs/{jobId}/segments/{segmentId}/video.mp4
/jobs/{jobId}/stitched/final.mp4
/jobs/{jobId}/qa/frames/{frameIndex}.jpg
/jobs/{jobId}/covers/cover.webp
```

### 12.2 访问

- 用户只能访问自己的文件。
- 管理员访问文件也必须经过后台权限校验。
- signed URL 有效期建议 10-30 分钟。
- 模型调用使用短期 signed URL。
- 不把永久公开 URL 存到前端可见数据里。

### 12.3 生命周期

| 文件类型 | 保存时间 |
|---|---:|
| 原图 | 180 天 |
| 缩略图 | 跟随原图 |
| 8 秒片段 | 30 天 |
| 异常任务片段 | 90 天 |
| 最终视频 | 180 天 |
| 抽帧质检图 | 30 天 |
| 异常任务质检图 | 90 天 |

清理任务由 worker/cron 异步执行。

## 13. Post-QA 抽帧质检

### 13.1 位置

Post-QA 抽帧质检位于完整生成链路的末端：

```text
video_segments 全部成功 -> Cloud Run 拼接 -> 抽帧 -> 视觉质检 -> capture 点数 -> 用户下载
```

它检查用户最终会下载的完整视频，不替代素材上传前的视觉识别，也不替代 Creem Prompt Moderation。

### 13.2 配置

建议在 `video_jobs` 或关联配置中记录：

- `post_qa_mode`: off / lite / standard / strict
- `post_qa_required`: boolean
- `post_qa_reason`: trial / paid_default / human_present / back_view / risky_template / admin_override

模式：

| 模式 | 抽帧 | 模型 | 权限 |
|---|---|---|---|
| `off` | 0 | 无 | 仅管理员/内测 |
| `lite` | 8 秒 2-3 帧 | 低成本视觉模型 | 免费试用、低风险 8 秒 |
| `standard` | 每 8 秒 4-5 帧 | 默认视觉模型 | 付费默认 |
| `strict` | 每 8 秒 6-8 帧 + 转场帧 | 强视觉模型 | 真人、背面、正背切换、中高风险模板 |

普通用户不能关闭 Post-QA。后台可以为管理员内测任务关闭。

### 13.3 执行

Cloud Run `stitch-worker` 在拼接成功后直接抽帧：

1. 拼接片段为最终视频。
2. 根据 `post_qa_mode` 计算抽帧时间点。
3. 使用 ffmpeg 输出 jpg/webp。
4. 上传抽帧图到 R2。
5. 写入 `post_qa_results` 的待检测记录。
6. 后续 worker 调用视觉模型分析抽帧图。

这样可以避免最终视频上传 R2 后再下载回来抽帧。

### 13.4 成本

抽帧质检成本包括：

- Cloud Run 计算。
- R2 抽帧图存储。
- 视觉模型调用。
- 质检失败后的片段重试、重新拼接、再次抽帧和再次质检。
- 用户等待时间。

主要毛利风险来自视觉模型调用和失败重试，不是 ffmpeg 抽帧本身。

### 13.5 交付规则

- 质检通过后才执行 `credit_ledger.capture`。
- 质检通过后任务进入 `deliverable`。
- 质检失败后根据异常类型进入自动重试、人工审核、释放冻结点数或退款。
- 前台不能承诺“100% 无异常”，只能说明“包含质量检查”。

## 14. 安全与风控

### 14.1 用户侧

- 登录后才能创建任务。
- 邮箱验证后才发放免费试用。
- 免费试用限制 user ID、email、OAuth provider ID、IP、设备指纹。
- 上传文件限制类型、大小、尺寸。
- 用户只能访问自己的任务和文件。

### 14.2 内部接口

- cron endpoint 必须校验 secret。
- Cloud Run callback 必须校验 secret 或签名。
- Creem webhook 必须校验签名。
- Creem Moderation 必须由服务端调用，不能从前端直接暴露 API Key。
- 管理员 API 必须校验角色。

### 14.3 API Key

- API Key 加密存储。
- 后台不展示完整 Key。
- Key 可设置状态：active / paused / exhausted / error。
- 每次调用记录使用的 key ID，但不记录 key 明文。

### 14.4 滥用控制

记录：

- 高频上传。
- 高频邮件登录请求。
- 被 Creem Moderation 拒绝或标记的 prompt。
- 免费试用滥用。
- 同 IP 多账号。
- 高失败率用户。
- 内容安全拦截。

## 15. 管理后台技术要求

后台不是装饰性 dashboard，必须能排查问题。

MVP 后台应支持：

- 用户列表和详情。
- 任务列表和详情。
- 片段详情。
- 模型调用日志。
- 状态流转日志。
- Post-QA 抽帧质检结果。
- 点数流水。
- Creem Prompt Moderation 结果。
- 订单列表。
- 模板管理。
- provider/key 管理。
- 异常任务队列。
- 管理员操作日志。

管理员敏感操作必须写 `admin_audit_logs`：

- 手动重试。
- 手动退款。
- 点数调整。
- 封禁/解封用户。
- 修改模板状态。
- 修改模型路由。
- 修改 provider key 状态。

## 16. 监控与告警

MVP 至少需要后台可见指标：

- 今日任务数。
- 生成成功率。
- 质检通过率。
- Post-QA 模式分布。
- Post-QA 平均成本。
- 平均重试次数。
- 片段失败率。
- 拼接失败率。
- 模型调用成本。
- 点数收入。
- 毛利估算。
- 供应商错误率。
- 卡死任务数量。

后续可接入：

- Vercel 日志。
- Cloud Run 日志。
- 数据库错误统计。
- provider 错误率告警。
- 异常任务邮件/Slack/飞书通知。

## 17. MVP 不做事项

- 不在 Vercel Function 内跑 ffmpeg。
- 不支持自由时长。
- 不开放 4K 公开售卖。
- 不默认生成音频。
- 不允许普通用户关闭 Post-QA 质检。
- 不把 APIMart PixVerse V6 放入公开自动 fallback。
- 不绕过 Creem Prompt Moderation 直接提交图片/视频生成。
- 不让用户选择具体供应商模型。
- 不把模板写死为前端常量。
- 不做密码登录。
- 不做团队协作和企业套餐。
- 不做批量 SKU 自动生成。

## 18. 已确认默认技术决策

- ORM/数据库访问：Drizzle。
- R2 上传方式：signed URL 直传。
- 视觉模型：provider 可配置，默认低成本 GPT 视觉模型，必须真实接入。
- Cloud Run 触发方式：Next.js/worker tick 创建 stitch job 并触发 Cloud Run。
- cron-job.org 触发频率：MVP 每 1 分钟。
- 后台角色：`admin` 和 `operator`。
- Creem 和大模型：真实接入，不做 mock 成功链路。

## 19. 实现前仍需确认

- better-auth 具体 adapter。
- 视觉模型实际 provider 和模型 ID。
- EvoLink `veo3.1-pro-beta` 的实测时长、价格、失败率。
- Post-QA 抽帧时间点、每种模式的帧数和模型成本上限。
- Creem webhook 事件类型与测试流程。
- Creem Moderation 生产 key、sandbox/production 验证流程、flag/deny 测试用例。
- 管理员后台首批需要的筛选字段。
