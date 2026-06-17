# Public MVP Trial Readiness Design

版本：设计待确认稿  
日期：2026-06-17  
关联文档：[PRD.md](../../PRD.md)、[IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md)、[DEVELOPMENT_SPEC.md](../../DEVELOPMENT_SPEC.md)、[STYLE_PRESET_DESIGN.md](../../STYLE_PRESET_DESIGN.md)

## 1. 目标

本 SPEC 定义 `Public MVP Trial Readiness` 的产品与工程边界。目标不是继续堆后台能力，而是让项目具备交给 20-50 个真实服装卖家小规模试用的条件：

- 用户能从公开页面进入登录、试用和生成工作台。
- 用户不用理解镜头模板，也能通过 Style Preset 完成一次 8 秒试用。
- 试用完成后有清晰的付费升级入口。
- 运营侧能看到漏斗、失败、成本和异常任务。
- 管理员能对失败任务做基本补救和复盘。

本 SPEC 只覆盖 P1-P4：

- P1：试用漏斗产品化。
- P2：公开页面信任建设。
- P3：漏斗事件追踪。
- P4：后台运营与异常处理补强。

不覆盖真实 staging/production 部署、Creem 生产收款验收、Cloud Run 生产配置和 20-50 用户邀约执行。这些应在本功能完成后作为部署验收和 beta 运营项目单独执行。

## 2. 设计原则

1. 先闭环，再精装。Landing、Pricing 和后台统计都必须服务试用闭环，不做泛泛的 AI 营销页。
2. 用户主路径是 `Landing/Pricing -> Login -> Workspace trial -> Job detail -> Upgrade/Billing`。
3. 普通用户默认选择 Style Preset，不要求理解模板 ID。
4. 试用规则必须清楚：每个新用户 1 次 8 秒、低分辨率、无音频、带水印、低风险模板。
5. 前台只展示用户能理解的结果和下一步，不暴露 provider、内部 prompt、供应商错误码或风控 reason codes。
6. 后台必须能看到真实原因：trial eligibility、job status、ledger、moderation、provider logs、post-qa 和 admin action。
7. 埋点先做服务端可审计事件，不引入第三方 analytics SDK，避免 cookie/隐私合规扩大。
8. 页面文案先做中文 MVP。英文、多语言和 SEO 深度优化后置。

## 3. 范围拆分

### Phase 1：Trial Funnel

目标：修顺试用进入、试用状态、试用生成和试用后升级路径。

包含：

- `/login?next=/workspace?mode=trial&preset=minimal_studio` 保持已完成逻辑，并补全端到端测试。
- Workspace 显示当前试用状态：
  - 试用可用。
  - 已使用试用。
  - 风控或邮箱验证导致试用不可用。
- 生成控制区域区分：
  - 免费试用按钮。
  - 付费生成按钮。
- 试用完成后在任务详情页显示升级入口：
  - 购买点数。
  - 重新生成高分辨率无水印版本。
- 试用失败时展示统一、可理解文案，内部原因只进入后台和审计。

不包含：

- 新的订阅模式。
- 多次试用券。
- 邀请码系统。
- 复杂优惠券和折扣。

### Phase 2：Public Site

目标：公开页面能支撑真实用户试用，而不是工程占位。

包含：

- Landing：
  - 首屏明确产品：服装商品图生成短视频。
  - 展示试用 CTA。
  - 展示 3 个 Style Preset 的用户语言解释。
  - 展示素材规则：无背面图不生成背面，无细节图不生成细节。
  - 展示真实样例区域。MVP 可先使用内部生成样例的封面或视频链接；若暂无真实素材，则显示可配置空状态，不伪造案例。
- Pricing：
  - 试用说明。
  - 8/16/24 秒点数消耗。
  - Starter、Creator、Studio 点数包。
  - 失败、质检、退款说明。
- Privacy：
  - 上传图片和生成视频如何存储。
  - 模型调用会使用图片和 prompt。
  - R2 保存周期。
  - 删除与账号数据处理。
- Terms：
  - 禁止内容。
  - 生成失败、退款、试用限制。
  - 用户上传素材授权。
  - 商用责任边界。
- FAQ：
  - 需要上传什么图片。
  - 为什么不能背面/转身/细节。
  - 多久生成。
  - 试用和付费的区别。
  - 水印和音频说明。

不包含：

- 完整法务审查版文本。
- 多语言切换。
- SEO 内容矩阵。
- 博客、案例库、联盟营销页。

### Phase 3：Funnel Analytics

目标：能看见用户从访问到下载、付费的关键路径。

建议新增 `funnel_events` 或复用已有审计事件时新增独立封装。推荐新增专用事件表，避免把产品漏斗事件混进后台审计日志。

事件字段：

```text
id
user_id nullable
anonymous_id nullable
session_id nullable
event_name
source
path
metadata jsonb
created_at
```

事件名：

```text
landing_viewed
trial_cta_clicked
pricing_viewed
login_viewed
login_completed
workspace_entered
trial_status_viewed
asset_uploaded
job_created
asset_analysis_passed
asset_analysis_failed
storyboard_generated
storyboard_confirmed
trial_generation_started
paid_generation_started
generation_deliverable
generation_failed
video_downloaded
upgrade_cta_clicked
checkout_started
payment_succeeded
```

记录原则：

- 关键服务端动作必须由服务端记录，例如 job 创建、分镜确认、生成成功、支付成功。
- 页面浏览和 CTA 点击可使用轻量 API 记录。
- metadata 只保存结构化上下文，例如 `presetId`、`durationSeconds`、`billingMode`、`jobId`、`sourcePage`。
- 不在 funnel event 中保存完整用户 prompt、完整供应商响应、API Key、signed URL、邮箱明文或敏感风控 hash。
- 对未登录用户使用匿名 ID，MVP 可用本地生成的 `anonymous_id`，不要引入第三方 cookie SDK。

后台统计：

- 注册/登录后进入 workspace 数。
- workspace 到上传转化。
- 上传到 job 创建转化。
- job 创建到分镜生成转化。
- 分镜到确认转化。
- 生成到 deliverable 转化。
- deliverable 到下载转化。
- 试用到 Pricing/Checkout 转化。
- 每个 preset 的 job 数、成功数、失败数、下载数。

### Phase 4：Admin Ops

目标：真实试用期间，后台能定位失败、处理点数、沉淀原因。

包含：

- 失败任务队列：
  - job id。
  - 用户。
  - billing mode。
  - preset。
  - 当前状态。
  - failure reason。
  - 是否已扣点/冻结点数。
  - 最近状态变化时间。
- 任务列表筛选增强：
  - status。
  - billing mode。
  - preset id。
  - is_test。
  - created date。
- 任务详情失败摘要：
  - 当前用户可见状态。
  - 后台真实状态。
  - 最近错误。
  - 是否有 reserved ledger。
  - 是否需要 release/refund。
  - segment、stitch、post-qa 的最新状态。
- 管理员备注：
  - `admin_job_notes` 或复用审计表中的 note event。
  - 备注写入审计，不影响用户可见状态。
- 敏感操作入口：
  - 释放冻结点数。
  - 任务备注。
  - 后续可接片段重试，但本 SPEC 不强制新增复杂重试 UI。
- Funnel dashboard：
  - 只做 MVP 统计卡片和简表，不做复杂图表系统。

不包含：

- 全功能 BI。
- 客服工单系统。
- 用户封禁/申诉工作流。
- 模板自动降级系统。

## 4. 用户主流程

```text
Landing
  -> 点击免费试用
  -> /login?next=/workspace?mode=trial&preset=minimal_studio
  -> 登录完成
  -> /workspace?mode=trial&preset=minimal_studio
  -> 显示试用可用状态
  -> 上传服装正面图
  -> 系统分析素材
  -> 按 preset 自动选择模板
  -> 点击免费试用生成
  -> 任务详情页查看进度
  -> 生成成功
  -> 下载带水印试用视频
  -> 点击升级 CTA
  -> Pricing/Billing/Checkout
```

试用不可用流程：

```text
Workspace
  -> 显示试用不可用统一文案
  -> 保留付费生成入口
  -> 可跳转 Pricing 或 Billing
```

生成失败流程：

```text
Job detail
  -> 用户看到可理解失败原因
  -> 如果点数冻结则提示已释放或待处理
  -> 后台失败队列出现该任务
  -> 管理员查看内部原因和账务状态
```

## 5. 页面与组件建议

### Public 页面

建议文件：

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
```

Landing 首屏不做大段 AI 说明。首屏必须回答：

- 这是给谁的。
- 上传什么。
- 生成什么。
- 能不能免费试一次。

### Workspace

建议文件：

```text
src/components/workspace/workspace-app.tsx
src/components/workspace/trial-status-panel.tsx
src/server/trial/status.ts
src/app/api/trial/status/route.ts
```

Workspace 应显示：

- 当前模式：试用/付费。
- 免费试用是否可用。
- 试用限制：8 秒、低分辨率、无音频、带水印。
- 如果不可用，显示统一原因，不显示内部风控细节。

### Job detail

建议文件：

```text
src/components/jobs/job-detail.tsx
src/components/jobs/job-upgrade-panel.tsx
```

Job detail 应显示：

- 试用成片的下载。
- 水印/低分辨率说明。
- 升级 CTA。
- paid job 不显示试用升级文案，而显示继续生成或购买点数。

### Admin

建议文件：

```text
src/app/admin/jobs/page.tsx
src/app/admin/jobs/[id]/page.tsx
src/app/admin/funnel/page.tsx
src/components/admin/job-failure-summary.tsx
src/components/admin/funnel-dashboard.tsx
src/server/admin/funnel.ts
src/server/admin/jobs.ts
```

## 6. 数据模型建议

### funnel_events

新增表：

```text
funnel_events
```

字段：

```text
id uuid primary key
user_id text nullable
anonymous_id text nullable
session_id text nullable
event_name text not null
source text not null
path text nullable
metadata jsonb not null default {}
created_at timestamptz not null default now()
```

索引：

```text
created_at
event_name
user_id
anonymous_id
```

### admin_job_notes

如果现有审计表不足以承载备注，新增：

```text
admin_job_notes
```

字段：

```text
id uuid primary key
job_id uuid not null
admin_user_id text not null
note text not null
created_at timestamptz not null default now()
```

备注必须同时写 `admin_audit_logs`，方便追踪敏感操作上下文。

## 7. API 建议

```text
GET /api/trial/status
POST /api/funnel/events
GET /api/admin/funnel/summary
POST /api/admin/jobs/[id]/notes
POST /api/admin/jobs/[id]/release-credits
```

说明：

- `GET /api/trial/status` 返回用户可见试用状态，不返回内部 hash、risk score 或 reason codes。
- `POST /api/funnel/events` 只接收白名单事件名和安全 metadata。
- 管理员 API 必须校验 admin/operator 权限，并写审计日志。
- 点数释放 API 必须幂等，不能重复 release。

## 8. 文案口径

试用可用：

```text
你有 1 次免费试用，可生成 8 秒带水印视频。
```

试用已用：

```text
你的免费试用已使用。可以购买点数生成高清无水印视频。
```

试用暂不可用：

```text
当前账号暂时无法使用免费试用，可以购买点数继续生成。
```

试用规格：

```text
免费试用：8 秒、低分辨率、无音频、带水印，仅开放低风险镜头。
```

升级 CTA：

```text
生成高清无水印版本
```

## 9. 验收标准

### Phase 1 验收

- 从 Landing CTA 登录后进入 `/workspace?mode=trial&preset=minimal_studio`。
- Workspace 显示试用状态。
- 试用按钮只在 8 秒模式下可用。
- 试用不可用时显示统一文案，并保留付费入口。
- 试用任务详情显示升级入口。
- 相关测试覆盖 login next、trial status、workspace CTA 和 job upgrade panel。

### Phase 2 验收

- Landing、Pricing、Privacy、Terms、FAQ 页面存在且可访问。
- Public 页面 CTA 均使用安全试用入口。
- Pricing 清楚展示点数包、时长、试用限制和失败退款说明。
- Privacy/Terms 不承诺模型输出 100% 正确。
- 不使用虚假成功案例；样例为空时有合理空状态。

### Phase 3 验收

- `funnel_events` 迁移可执行。
- 服务端关键事件可写入。
- 前台 CTA 点击可写入白名单事件。
- 后台 funnel summary 能返回核心统计。
- 不记录完整 prompt、signed URL、API Key、供应商原始响应或敏感风控细节。

### Phase 4 验收

- Admin jobs 支持 status、billing mode、preset、is_test 筛选。
- Admin 有失败任务视图或筛选入口。
- Job detail 有失败摘要。
- 管理员备注可写入并审计。
- 点数释放/退款相关操作必须幂等并写审计。

### 全局验收

至少运行：

```bash
pnpm run typecheck
pnpm test
pnpm run build
```

涉及账务和真实生成前，不强制跑 production smoke；准备给真实用户试用前必须再跑：

```bash
pnpm run verify:blockers
```

## 10. 明确不做

- 不做英文版和语言切换。
- 不做第三方 analytics SDK。
- 不做复杂营销 CMS。
- 不做优惠券。
- 不做订阅。
- 不做自动邮件营销。
- 不做模板自动降级。
- 不做客服工单系统。
- 不在本阶段扩大视频生成模型路由能力。

## 11. 风险与提醒

- 如果没有真实样例，Landing 转化会很弱。可以先放内部真实生成样例，但不能伪造效果。
- 如果只做埋点不做后台统计，数据会变成数据库垃圾。
- 如果后台释放/退款不做幂等，会直接制造账务事故。
- 如果试用不可用原因暴露太细，会帮助薅试用用户绕过风控。
- 如果 P1-P4 做成一个巨大提交，验收会很痛苦。必须分 Phase 提交。
