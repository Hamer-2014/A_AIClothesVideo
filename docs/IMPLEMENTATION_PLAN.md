# 服装短视频工具站实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分阶段实现 PRD 中定义的服装商品图生成宣传短视频 MVP。

**Architecture:** Next.js 部署在 Vercel，负责前台、后台、API 和短任务推进；Neon Postgres 保存状态机、点数账本、模型路由和审计日志；Cloud Run `stitch-worker` 负责 ffmpeg 拼接与抽帧；Cloudflare R2 存储图片和视频；模型调用通过可配置 provider/router 执行。

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Radix UI, Neon Postgres, better-auth, Resend, Creem, Cloudflare R2, cron-job.org, Cloud Run, ffmpeg, DeepSeek, GPT vision model, APIMart PixVerse V6.

详细执行 SPEC 见：[DEVELOPMENT_SPEC.md](DEVELOPMENT_SPEC.md)

---

## 当前真实进度快照（2026-06-13）

> 下面快照优先级高于历史 checkbox。历史任务列表保留原始路线图用途；后续应逐步把 checkbox 同步为真实状态，避免“文档未勾选但代码已完成”的误判。

### 已通过验证

- 项目基础、数据库 schema、Drizzle 迁移、R2 上传、认证骨架、点数账本、Creem checkout/webhook 代码、Creem Prompt Moderation、模板规则、素材分析、DeepSeek 分镜、APIMart PixVerse V6 片段生成、worker tick、Cloud Run stitch-worker、Post-QA、前台工作台、任务页、账单页和管理员后台均已有代码落地。
- 2026-06-13 本地验证通过：
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
- 2026-06-13 SPEC Acceptance Follow-up 定点验证通过：
  - `npx vitest run src/server/abuse/hash.test.ts src/server/abuse/trial-eligibility.test.ts src/server/jobs/create-job.test.ts`
  - `npx vitest run workers/stitch-worker/src/ffmpeg.test.ts workers/stitch-worker/src/stitch.test.ts`
  - `npx vitest run src/server/providers/model-route-resolver.test.ts src/server/video/segments.test.ts src/lib/providers/log-call.test.ts`
- `npm run verify:blockers -- --json` 当前仍需按 env-only 口径重新验收：paid delivery 应检查 `video_segments.provider/model` 与 `provider_call_logs.provider/model`，不再要求 `provider_call_logs.model_route_id` / `route_snapshot`。
- `verify:blockers` 当前要求：
  - 至少一个 `credit_cost > 0` 的 paid deliverable 任务有 `reserve`、`capture`、final video、QA frames。
  - paid delivery 的 `video_segments.provider/model` 必须包含 `apimart` / `pixverse-v6`。
  - paid delivery 的 `provider_call_logs.provider/model` 必须包含 `apimart` / `pixverse-v6`，不再要求 route snapshot。
  - 至少一个付费失败补偿任务有 `release` 或 `refund`。
  - 至少一个敏感后台操作写入 `admin_audit_logs`。
- 开发者本地已生成 10+ 个视频，当前判断 APIMart PixVerse V6 链路稳定。

### 本轮已收敛

- MVP 产品口径改为：免费试用低分辨率、无音频、带水印；付费默认高分辨率、无水印、包含音频，用户侧不暴露供应商具体分辨率。
- Cloud Run stitch payload 增加 `postQaMode`，主应用从 `video_jobs.post_qa_mode` 传递给 worker。
- stitch-worker 抽帧已分级：现有 8/16/24 秒保持 `off = 0`、`lite = 3`、`standard = 5`、`strict = 6`；40 秒 Standard 为 24 帧、Strict 为 34 帧，并保留片段/转场位置。
- 2026-06-13 风险收敛子项目 A：免费试用判断新增 `trial_abuse_signals`，接入 user/email/device/IP/user-agent 多信号、HMAC hash、生产缺 `ABUSE_HASH_SECRET` fail closed、普通用户统一拒绝文案、管理员任务详情展示 trial eligibility snapshot。
- 2026-06-13 Env-only Video Generation Config：公开视频 `video_generation` 的 provider/model/key 改为只读取环境变量；health check 检查 `VIDEO_GENERATION_PROVIDER`、`VIDEO_GENERATION_MODEL` 和当前 provider 对应的 `APIMART_API_KEY` / `EVOLINK_API_KEY`，不再要求 `PROVIDER_KEY_ENCRYPTION_SECRET` 才能生成视频。
- 2026-06-13 风险收敛子项目 C：Cloud Run `stitch-worker` 在 final mp4 后抽取 `jobs/{jobId}/covers/cover.webp`，封面生成失败只写 warning 且不阻断 final video / QA frames / callback；前台任务详情优先显示封面、无封面时回退视频预览，任务列表通过内部 cover API 的 R2 signed URL 展示可用封面缩略图。

### 仍未完成或仍需生产验收

- Creem 真实生产支付、税务配置和平台 review 仍需单独验收；不能用本地账务闭环替代真实收款闭环。
- 公开视频 `video_generation` 不再使用 DB `model_routes/provider_keys` 决定 provider/model/key；生产发布前必须确认对应环境变量已配置，旧 route snapshot 验收口径不再适用。
- storyboard、vision、post_qa、moderation 暂未迁移到同一 resolver，避免一次性扩大运行时风险。
- Cloud Run 封面生成已覆盖抽帧失败和上传失败降级；仍需使用部署后的新任务确认 R2 中实际出现 `jobs/{jobId}/covers/cover.webp`，并确认 `video_jobs.cover_key` / `stitch_jobs.cover_key` 随 callback 写入真实库。
- 免费试用防滥用已从单一 userId rolling 24h 升级为多信号判断；OAuth account 信号服务层已支持，但用户 API route 仍需后续从 better-auth accounts 稳定读取 provider/account id 后传入。
- 本地 10+ 视频稳定不等于用户验证完成；仍需 20-50 个目标卖家、100-300 个真实 SKU 的小规模公开 MVP 数据。

## 0. 实现边界

本计划是 MVP 实现路线图，不是单次编码任务。项目包含多个独立子系统，后续执行时应按阶段拆分，每个阶段完成后再进入下一阶段。

严禁一开始就做：

- 完整批量 SKU 生成。
- 360 展示和复杂真人走秀。
- 公开 4K 售卖。
- 用户选择具体模型。
- 在 Vercel Function 内跑 ffmpeg。
- 绕过 Creem Prompt Moderation。
- 直接扣点而不写账本流水。
- 用 mock 伪造 Creem、大模型或视频生成的成功链路。

必须采用：

- Drizzle 作为数据库访问/ORM。
- R2 signed URL 直传。
- Creem 和大模型真实接入。
- 测试任务标记 `is_test = true`。
- 未配置真实 API Key 时功能显示不可用，不伪造成功结果。

## 1. 代码与文档基线

**目标：** 初始化项目并建立工程边界。

**文档：**

- [PRD.md](PRD.md)
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)

**任务：**

- [ ] 初始化 Next.js + TypeScript 项目。
- [ ] 接入 Tailwind CSS。
- [ ] 接入 Radix UI 基础组件。
- [ ] 配置 ESLint、TypeScript、基础格式化。
- [ ] 建立基础目录结构：
  - `src/app`
  - `src/components`
  - `src/lib`
  - `src/server`
- [ ] 建立环境变量模板。
- [ ] 建立健康检查页面或 API。
- [ ] 配置 Vercel 部署。

**验收：**

- [ ] 本地开发服务器可启动。
- [ ] Vercel 可部署。
- [ ] 基础页面可访问。
- [ ] lint/typecheck/build 可通过。

## 2. 数据库与基础数据模型

**目标：** 建立 Neon Postgres 连接和 MVP 核心表。

**建议文件：**

- `src/lib/db`
- `src/lib/db/schema`
- `src/lib/db/migrations`

**任务：**

- [ ] 使用 Drizzle 建立数据库访问层。
- [ ] 建立 Neon 连接。
- [ ] 创建 better-auth 所需认证表。
- [ ] 创建用户业务表：
  - `user_profiles`
  - `admin_roles`
- [ ] 创建素材与任务表：
  - `assets`
  - `asset_analyses`
  - `video_jobs`
  - `video_job_assets`
  - `storyboards`
  - `video_segments`
  - `stitch_jobs`
  - `post_qa_results`
- [ ] 创建模板表：
  - `shot_templates`
  - `shot_template_metrics`
- [ ] 创建点数与订单表：
  - `credit_wallets`
  - `credit_ledger`
  - `orders`
- [ ] 创建模型与供应商表：
  - `model_providers`
  - `provider_call_logs`
  - `prompt_moderation_results`
- [ ] 创建审计与风控表：
  - `job_state_events`
  - `admin_audit_logs`
  - `abuse_events`

**验收：**

- [ ] 数据库迁移可在空库执行。
- [ ] 核心表存在。
- [ ] 所有账务、模型调用、状态变化都有对应记录表。
- [ ] API Key 字段不以明文暴露给前台。

## 3. 认证与用户体系

**目标：** 完成用户登录、管理员白名单和免费试用发放前置条件。

**任务：**

- [ ] 接入 better-auth。
- [ ] 支持 Google OAuth。
- [ ] 支持 Resend Email OTP/Magic Link。
- [ ] 禁用传统密码登录。
- [ ] 首次登录创建 `user_profiles`。
- [ ] 建立管理员白名单。
- [ ] 建立 `admin` 和 `operator` 权限。
- [ ] 登录邮件发送记录保存成功/失败和 provider message ID。
- [ ] 邮箱验证完成后才允许发放免费试用。

**验收：**

- [ ] Google 登录可用。
- [ ] Email OTP/Magic Link 可用。
- [ ] 非管理员无法进入后台。
- [ ] 密码登录入口不存在。
- [ ] 登录邮件有限频。

## 4. 支付、点数和免费试用

**目标：** 实现 Creem 支付和点数账本。

**任务：**

- [ ] 创建点数包配置：
  - Starter: 9.99 USD / 100 点。
  - Creator: 29.99 USD / 360 点。
  - Studio: 79.99 USD / 1100 点。
- [ ] 接入 Creem checkout。
- [ ] 接入 Creem webhook。
- [ ] 使用真实 Creem 测试/生产配置，不做支付成功 mock。
- [ ] webhook 校验签名。
- [ ] webhook 幂等处理。
- [ ] 支付成功写 `orders`。
- [ ] 支付成功写 `credit_ledger.purchase`。
- [ ] 实现钱包余额更新。
- [ ] 实现免费试用发放。
- [ ] 实现 `reserve`、`capture`、`release`、`refund`、`admin_adjust`。
- [ ] 实现点数账单页。
- [ ] 实现后台手动调整点数，必须写原因。

**验收：**

- [ ] 支付成功只充值一次。
- [ ] 点数变化都有流水。
- [ ] 用户余额和流水可对账。
- [ ] 用户确认分镜后冻结点数。
- [ ] 质检通过后才正式扣除点数。

## 5. R2 存储与素材上传

**目标：** 实现用户图片上传、signed URL、文件生命周期基础。

**任务：**

- [ ] 配置 Cloudflare R2。
- [ ] 实现 R2 服务端客户端。
- [ ] 实现上传授权 API。
- [ ] 用户上传原图到 R2。
- [ ] 创建 `assets` 记录。
- [ ] 生成或保存缩略图。
- [ ] 实现用户文件访问权限校验。
- [ ] 下载和模型访问都使用 signed URL。
- [ ] 实现删除标记 `deleted_at`。
- [ ] 预留异步清理任务。

**验收：**

- [ ] 用户只能访问自己的素材。
- [ ] R2 bucket 不公开。
- [ ] signed URL 有效期可配置。
- [ ] 删除不会在用户请求中同步阻塞。

### 5.1 素材授权与侵权删除合规

**目标：** 让真人模特和普通商品素材进入生成链路前具备可审计的授权证据，并提供人工核验的侵权删除流程。

**任务：**

- [x] 所有服务端图片上传强制主动接受 `image_rights_v1`，未接受或版本过期时拒绝上传。
- [x] 事务保存声明、`pending_upload` 资产和关联记录，`/api/uploads/complete` 是唯一完成入口。
- [x] 历史资产支持补签，Preflight 和任务创建再次门禁，任务保存声明快照。
- [x] 声明明确真人肖像和商业宣传授权；儿童真人素材必须有监护人授权。
- [x] 提供 `/takedown` 与公开 API；公开提交只建案件，不自动删除内容。
- [x] 后台提供权利删除案件队列，`operator` 只分诊，`admin` 才能结案，状态迁移写审计日志。
- [x] 提供三年去标识化 retention endpoint，以 `CRON_JOB_SECRET` Bearer 鉴权。
- [ ] 在 cron-job.org 配置每日调用 `/api/internal/compliance/retention`。

**验收：**

- [x] staging/production 缺少法律联系邮箱、Resend 配置或摘要密钥时 `/api/health` 为 `ready=false`。
- [x] 投诉邮件失败不会丢失已受理案件。
- [x] 未补签资产不能进入任务生成。
- [ ] 生产环境完成真实投诉邮件、后台结案和三年到期样本演练。

## 6. 镜头模板库与规则引擎

**目标：** 实现 17 个 MVP/付费 Beta 模板和可用性判断。

**任务：**

- [x] 写入 17 个 MVP/付费 Beta 模板：
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
  - `scene_lifestyle_showcase`
  - `minimal_studio`
  - `product_quarter_rotation`
  - `product_half_rotation`
  - `model_quarter_turn`
  - `model_half_turn`
- [x] 商品旋转模板仅允许 `product` 主体、同款多视角一致性通过、付费和高级调整明确选择。
- [x] 商品旋转模板不进入 Preset 自动编排，确认时强制 Strict QA，并按 front/side/back 顺序写素材快照。
- [x] 商品旋转 Prompt 禁止生成真人、手、身体、模特或虚拟穿衣结果；180° 模板禁止继续到 360°。
- [x] 真人模特转身模板只接受 `human_model` 多视角素材，并要求同服装、同模特任务内一致性均通过。
- [x] 单张真人正面图继续允许 `model_front_pose`，但不能启用轻侧身或 180° 转身。
- [x] 真人模特转身模板为付费 Beta、Advanced-only、禁止 Preset 自动选择，并强制 Strict QA。
- [x] 模特转身 Prompt 固定同一可见人物、服装和自然人体，禁止换脸、体型/发型漂移及 360°；Post-QA 检查人物连续性和人体异常。
- [x] 商品图不隐式造人；虚拟穿衣留作未来独立上游模块，输出仍需重新通过任务内一致性校验。
- [ ] 每个模板包含素材要求、风险等级、禁用条件、试用权限、质检点。
- [ ] 实现模板状态：draft / beta / active / paused。
- [ ] 实现模板版本。
- [ ] 实现素材完整度到模板可用性的规则引擎。
- [ ] 输出推荐模板、可选模板、不可用模板。
- [ ] 不可用模板输出原因。
- [ ] 中高风险模板输出风险提示。

**验收：**

- [ ] 没有背面图时背面和正背切换模板不可用。
- [ ] 没有细节图时细节模板不可用。
- [ ] 免费试用只能使用低风险模板。
- [ ] DeepSeek 只能引用 active/beta 且当前任务可用的模板 ID。
- [x] 缺商品侧面图时轻旋转不可用；缺商品背面图时 180° 不可用；一致性 unknown/fail 时两者均不可用。
- [x] 缺模特侧面/背面、模特不一致或模特视角服装不一致时，真人转身模板不可用并展示具体原因。

## 7. Creem Prompt Moderation

**目标：** 接入 Creem NSFW/prompt moderation 合规门禁。

**任务：**

- [ ] 实现 Creem `POST /v1/moderation/prompt` 客户端。
- [ ] 使用真实 Creem Moderation 配置，不做 moderation 成功 mock。
- [ ] 对用户自由文本、卖点、场景描述过审。
- [ ] 对 DeepSeek 生成的最终视频 prompt 过审。
- [ ] `allow` 才继续。
- [ ] `flag` 按 `deny` 处理。
- [ ] `deny` 阻止生成。
- [ ] 超时、网络错误、5xx 时 fail closed。
- [ ] 保存 `prompt_moderation_results`。
- [ ] 后台展示 moderation 结果。

**验收：**

- [ ] 未通过 moderation 的任务不会冻结点数。
- [ ] 未通过 moderation 的 prompt 不会进入视频模型。
- [ ] 审核失败时不会绕过继续生成。
- [ ] moderation 结果可供后台审计。

## 8. 模型路由与调用日志

**目标：** 建立可配置模型 provider/router。

**任务：**

- [ ] MVP 视频生成 provider/model/key 使用 env-only 配置，不做后台 provider/key 管理和 model route 热切换。
- [ ] 每个 deployment environment 在平台环境变量中配置不同厂商 key。
- [ ] 如果未来需要 provider/key 成本上限、并发上限、失败暂停或 fallback，另开企业级多 provider 路由设计，不在本 MVP 中保留半生效入口。
- [ ] 接入 DeepSeek `deepseek-v4-flash`。
- [ ] 接入默认 GPT 视觉模型。
- [ ] 接入 APIMart `pixverse-v6`。
- [ ] 预留 EvoLink `veo3.1-fast-beta` 备用/对照路由。
- [ ] 所有模型使用真实 provider 调用，不做“假成功”返回。
- [ ] 未配置 key 的模型路线显示不可用。
- [ ] 每次模型调用写 `provider_call_logs`。
- [ ] 实现 primary/fallback。
- [ ] fallback 前检查毛利阈值。
- [ ] 实验模型不进入公开自动 fallback。

**验收：**

- [ ] 每次模型调用有 provider、model、purpose、耗时、成本、结果。
- [ ] fallback 原因可见。
- [ ] 低于 45% 毛利的路线不会自动 fallback。
- [ ] 普通用户不能选择具体模型。

## 9. 素材识别与推荐流程

**目标：** 实现上传后素材分析和模板推荐。

**任务：**

- [ ] 对上传素材执行内容安全检查。
- [ ] 执行 Lite 视觉预检。
- [ ] 执行 Standard 素材分析。
- [ ] 保存 `asset_analysis_json`。
- [ ] 识别素材角色：front / back / side / detail / scene / unknown。
- [ ] 识别服装类别、可见细节、不可见细节、人体存在、质量风险。
- [ ] 调用模板规则引擎。
- [ ] 前台展示推荐/可选/不可用模板。
- [ ] 展示素材缺口清单。

**验收：**

- [ ] 素材不合格时不能进入生成。
- [ ] 系统不会因为一张正面图推荐背面展示。
- [ ] 用户能看到为什么某个模板不可用。

## 10. 分镜生成与确认

**目标：** 用户选模板后生成可确认分镜。

**任务：**

- [x] 用户选择 8/16/24 秒，服务端开关开放时可选择 40 秒付费 Beta。
- [ ] 用户选择比例 9:16 / 1:1 / 16:9。
- [ ] 用户选择模板。
- [ ] 服务端校验模板数量：
  - 8 秒 1 个模板。
  - 16 秒 2 个模板。
  - 24 秒 3 个模板。
  - 40 秒 5 个有序槽位，至少 3 种模板并限制重复和高风险镜头。
- [ ] 调用 DeepSeek 生成 storyboard JSON。
- [ ] 校验 JSON schema。
- [ ] 追加系统硬约束。
- [ ] 保存 `storyboards`。
- [ ] 展示每个 8 秒片段摘要。
- [ ] 用户确认分镜和点数消耗。

**验收：**

- [ ] DeepSeek 不能生成不存在的模板 ID。
- [ ] 用户确认前不冻结点数。
- [ ] 分镜可复现、可审计。

## 11. 任务状态机与 worker tick

**目标：** 实现异步任务推进，不依赖长请求。

**任务：**

- [ ] 实现 `video_jobs` 状态流转。
- [ ] 实现 `video_segments` 状态流转。
- [ ] 每次状态变化写 `job_state_events`。
- [ ] 实现 `locked_until`。
- [ ] 实现任务领取。
- [ ] 实现卡死任务恢复。
- [ ] 实现 `/api/internal/worker/tick`。
- [ ] cron-job.org 调用 worker tick。
- [ ] worker tick 校验 secret。
- [ ] worker tick 单次只处理有限任务。

**验收：**

- [ ] 重复 tick 不会重复扣费。
- [ ] 重复 tick 不会重复提交同一个片段生成。
- [ ] 卡死任务能恢复。
- [ ] 状态流转可审计。

## 12. 视频生成片段流程

**目标：** 使用 APIMart PixVerse V6 生成 8 秒片段。

**任务：**

- [ ] 根据 storyboard 创建 `video_segments`。
- [ ] 每个 segment 生成最终 prompt。
- [ ] 通过 Creem Moderation 后冻结点数。
- [ ] 提交 APIMart PixVerse 异步任务。
- [ ] 保存 provider task ID。
- [ ] 轮询任务状态。
- [ ] 成功后下载供应商视频。
- [ ] 转存到 R2。
- [ ] 更新 segment 状态。
- [ ] 失败时按片段重试。

**验收：**

- [ ] 16/24/40 秒不会因为某段生成失败整单重跑。
- [ ] 供应商返回链接不会过期丢失，必须转存 R2。
- [ ] 每个片段有 prompt、模板、输入素材快照和成本记录。

## 13. Cloud Run 拼接与抽帧

**目标：** 实现独立拼接 worker。

**任务：**

- [ ] 创建 Cloud Run `stitch-worker`。
- [ ] Next.js/worker tick 创建 `stitch_job`。
- [ ] 主应用通过内部受保护请求触发 Cloud Run 执行具体 job。
- [ ] Cloud Run 执行完成后回写主应用 callback 或受保护状态更新 API。
- [ ] 下载 R2 片段视频。
- [ ] ffmpeg 拼接/转码。
- [ ] 生成封面。
- [ ] 根据 `post_qa_mode` 抽帧。
- [ ] 上传最终视频、封面、抽帧图到 R2。
- [ ] 更新 `stitch_jobs`。
- [ ] 更新 `video_jobs` 到 `post_qa_queued`。
- [ ] 清理临时文件。

**验收：**

- [ ] Vercel 不执行 ffmpeg。
- [ ] 片段拼接成一个最终视频。
- [ ] 抽帧在 Cloud Run worker 内完成。
- [ ] 拼接失败可重试。

## 14. Post-QA 质检

**目标：** 对最终成片抽帧做质量检查。

**任务：**

- [ ] 支持 `post_qa_mode`: off / lite / standard / strict。
- [ ] 普通用户不能选择 off。
- [ ] 免费试用和低风险 8 秒默认 lite。
- [x] 16/24/40 秒付费默认 standard；严格模板仍升级为 strict。
- [ ] 真人、背面、正背切换、中高风险模板强制 strict。
- [ ] 调用视觉模型分析抽帧图。
- [ ] 保存 `post_qa_results`。
- [ ] 通过后执行 `credit_ledger.capture`。
- [ ] 失败后进入重试、人工审核、释放或退款。

**验收：**

- [ ] 质检通过前用户不能下载。
- [ ] 质检通过前不能正式扣点。
- [ ] `off` 只能用于管理员/内测。
- [ ] 前台不承诺 100% 无异常。

### 14.1 40 秒分段质检与局部重试

- [x] Standard 40 秒抽取 24 帧，Strict 抽取 34 帧。
- [x] QA 帧使用片段和转场语义文件名，不再依赖无位置的数字编号。
- [x] 视觉模型按 5 个片段批次加 1 个转场批次调用，并聚合一次终态结果。
- [x] 单个精确定位的片段失败自动重试一次，期间不释放冻结点数。
- [x] 多段失败、转场失败、provider/schema 异常和重试耗尽沿用失败释放流程。
- [x] 真人转身模板的 Strict Post-QA 追加同一可见人物、自然人体、服装 front/side/back 一致性和禁止 360° 检查。

## 15. 前台工作台

**目标：** 完成用户生成体验。

**页面：**

- Landing。
- 生成工作台。
- 生成进度/任务详情。
- 任务历史。
- 点数账单。

**任务：**

- [ ] 未登录用户看到 Landing。
- [ ] 已登录用户进入生成工作台。
- [ ] 支持素材上传。
- [ ] 支持规格选择。
- [ ] 支持比例选择。
- [ ] 展示素材识别结果。
- [ ] 展示推荐/可选/不可用模板。
- [ ] 支持用户二次选择模板。
- [ ] 展示分镜确认。
- [ ] 展示点数消耗和风险提示。
- [ ] 展示生成进度。
- [ ] 任务列表只显示完整视频任务。
- [ ] 任务详情播放完整视频。
- [ ] 支持下载完整视频。

**验收：**

- [ ] 用户侧不默认显示每个 8 秒片段视频。
- [ ] 用户能看到进度，例如“片段 2/3 生成中”或“片段 4/5 生成中”。
- [ ] 失败原因可理解。
- [ ] 点数冻结、扣除、退款状态清楚。

## 16. 管理员后台

**目标：** 实现审计、成本控制和异常处理能力。

**模块：**

- Dashboard。
- 用户管理。
- 任务管理。
- 异常任务队列。
- 模型调用日志。
- Prompt Moderation 结果。
- 供应商与 Key 管理。
- 镜头模板管理。
- 点数与订单管理。
- 内容安全与滥用控制。

**任务：**

- [ ] 任务详情展示上传素材。
- [ ] 展示素材识别 JSON。
- [ ] 展示推荐/可选/禁用模板。
- [ ] 展示用户选择模板。
- [ ] 展示 DeepSeek 分镜 JSON。
- [ ] 展示每个 8 秒片段状态。
- [ ] 展示每段 prompt。
- [ ] 展示供应商任务 ID。
- [ ] 展示拼接结果。
- [ ] 展示 Post-QA 结果。
- [ ] 支持手动重试片段。
- [ ] 支持对已失败任务释放冻结点数或按退款流程处理。
- [ ] 支持模板状态调整。
- [ ] 支持 provider/key 状态调整。
- [ ] 所有敏感操作写 `admin_audit_logs`。

**验收：**

- [ ] 管理员能定位任务失败在哪个步骤。
- [ ] 管理员能看到成本和模型调用链路。
- [ ] 手动退款和点数调整都有审计原因。

## 17. 上线前验证

**目标：** MVP 小规模真实验证。

**任务：**

- [ ] 准备 20-50 个目标用户试用。
- [ ] 准备 100-300 个真实 SKU 测试目标。
- [ ] 所有内部测试任务标记 `is_test = true`。
- [ ] 管理后台支持筛选测试任务和正式任务。
- [ ] 统计模板成功率。
- [ ] 统计质检通过率。
- [ ] 统计平均重试次数。
- [ ] 统计单任务成本和毛利。
- [ ] 验证 Creem 支付和 moderation review 要求。
- [ ] 演练供应商失败。
- [ ] 演练点数释放/退款。
- [ ] 演练 Cloud Run 拼接失败。
- [ ] 演练 R2 文件清理。

**验收：**

- [ ] 默认毛利目标 60%+ 有数据支持。
- [ ] 低于 45% 毛利的模型路线不会自动启用。
- [ ] 找到最稳定的 5-8 个模板。
- [ ] 免费试用不会被轻易滥用。

## 18. 推荐实施顺序

建议分 5 个里程碑：

1. **基础设施里程碑**
   - 项目初始化、数据库、认证、R2、后台骨架。
2. **账务与合规里程碑**
   - Creem、点数账本、免费试用、Creem Moderation。
3. **模板与模型里程碑**
   - 模板库、视觉识别、DeepSeek 分镜、模型路由日志。
4. **视频生成里程碑**
   - APIMart PixVerse 片段生成、worker tick、Cloud Run 拼接、Post-QA。
5. **产品闭环里程碑**
   - 前台工作台、任务历史、管理员后台、上线验证。

每个里程碑完成后都应跑一次端到端手工验收，不要等全部写完才发现状态机或账本设计有问题。
