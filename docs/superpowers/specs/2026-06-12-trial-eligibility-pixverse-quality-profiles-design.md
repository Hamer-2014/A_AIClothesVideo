# 免费试用资格与 PixVerse 生成档位设计

## 目标

修正当前“所有 8 秒任务都被当成免费试用”的粗暴逻辑，并为 APIMart PixVerse V6 建立明确的试用/付费生成档位：

- 免费试用不再等于“所有 8 秒任务免费”。
- 是否免费试用必须由服务端判定，前端不能决定。
- 免费试用使用 APIMart PixVerse V6：`540p`、带水印、无音频。
- 付费默认使用 APIMart PixVerse V6：`720p + audio`。
- `1080p + audio` 仅作为未来高价档预留，本次不开放给普通用户。
- 记录用户访问 IP，供管理员做风控和异常排查。

## 当前问题

当前前端把 `durationSeconds === 8` 当作试用，并向后端发送 `isTrial=true`。
后端创建任务时也接受客户端传入的 `isTrial`。

这等于让客户端决定任务是否免费，商业逻辑不安全。它还会阻塞正常的付费 8 秒 SKU：用户用完免费试用后，8 秒任务应该按 70 点收费。

另一个问题是 APIMart PixVerse 提交参数当前固定为 `540p`，且没有传 `audio` 参数。现在产品需要按试用/付费任务使用不同的生成参数。

## 产品规则

### 免费试用资格

- 每个用户滚动 24 小时内最多 1 次免费试用。
- 免费试用必须登录。
- 当 auth 层能稳定提供邮箱验证状态时，免费试用应要求邮箱已验证。
- 免费试用只适用于 8 秒任务。
- 免费试用只允许低风险模板，且模板必须满足 `isTrialAllowed = true`。
- 免费试用任务消耗 0 点。
- 免费试用任务不冻结点数，不正式扣点。
- 免费试用任务使用 `lite` Post-QA。
- 免费试用任务必须带水印。
- 免费试用任务使用 APIMart PixVerse V6：
  - `resolution = 540p`
  - `audio = false`

### 付费生成

- 付费 8 秒任务消耗 70 点。
- 付费 16 秒任务消耗 130 点。
- 付费 24 秒任务消耗 190 点。
- 付费任务在 prompt moderation 通过后冻结点数，Post-QA 通过后才正式扣点。
- 付费任务使用 APIMart PixVerse V6：
  - `resolution = 720p`
  - `audio = true`
- `1080p + audio` 本次不能开放给普通用户。等 APIMart 真实成本、失败率、重试率有样本后，再作为更高价格档单独设计。

## 数据模型

不要再从时长或点数反推是否试用。需要显式保存 billing/generation profile。

### `video_jobs`

新增字段：

- `billing_mode`：text 或 enum，取值：
  - `free_trial`
  - `paid`
- `generation_profile`：text 或 enum，取值：
  - `trial_540p_watermarked`
  - `paid_720p_audio`
  - 未来预留：`paid_1080p_audio`
- `watermark_enabled`：boolean
- `trial_eligibility_snapshot`：JSON，可空

`trial_eligibility_snapshot` 保存创建任务时的判定输入，例如：

```json
{
  "decision": "granted",
  "window": "rolling_24h",
  "previousTrialCount": 0,
  "checkedAt": "2026-06-12T00:00:00.000Z"
}
```

### `video_segments`

新增片段级生成参数。因为真正提交给供应商的是 segment，不是 job：

- `generation_profile`
- `resolution`
- `audio_enabled`
- `watermark_enabled`

这些字段在创建 segment 时从 job/profile 复制。这样即使未来 job 级默认配置变化，也能审计每个 segment 当时到底用了什么参数。

### `free_trial_usages`

新增表，显式记录免费试用使用情况：

- `id`
- `user_id`
- `video_job_id`
- `used_at`
- `duration_seconds`
- `generation_profile`
- `resolution`
- `watermark_enabled`
- `provider`
- `model`
- `created_at`
- `updated_at`

资格判断：

```text
同一 user_id 在 used_at >= now - 24 hours 的窗口内没有 free_trial_usages 记录。
```

该记录应和试用 job 在同一个事务中创建；如果实现上做不到，也必须在任务进入生成前创建，避免重复请求并发拿到多个免费试用。

### `user_access_events`

新增轻量访问记录表：

- `id`
- `user_id`，未登录时可空
- `event_type`，例如：
  - `job_create`
  - `trial_eligibility_check`
  - `trial_granted`
  - `trial_denied`
  - `checkout_start`
- `ip_address`，明文 IP
- `user_agent`
- `path`
- `metadata`
- `created_at`

访问限制：

- `ip_address` 只能管理员查看。
- operator、普通用户、公开 API 响应、用户侧页面都不能看到明文 IP。
- 普通产品 UI、营销文案、任务详情页不需要特别提示“系统会采集 IP”。
- 这不等于隐私政策可以隐瞒 IP 处理。隐私政策/服务条款里的必要披露不属于本 SPEC 的 UI 范围，不能为了转化率绕开合规披露。

保留策略：

- 初始目标保留 90 天。
- 本次可以不实现自动清理任务，但表结构要独立，方便后续加清理脚本。

## 服务端流程

### 创建任务

创建任务 API 不再信任客户端传入的 `isTrial`。

请求输入只应包含：

- `assetIds`
- `durationSeconds`
- `aspectRatio`
- 可选：`useFreeTrialIfAvailable`

服务端计算：

1. 是否 8 秒任务？
2. 用户过去 24 小时内是否已经使用过免费试用？
3. 当前请求是否满足试用资格？
4. 如果满足资格，且用户选择优先使用免费试用，则设置：
   - `billing_mode = free_trial`
   - `credit_cost = 0`
   - `generation_profile = trial_540p_watermarked`
   - `watermark_enabled = true`
   - `post_qa_mode = lite`
5. 否则设置：
   - `billing_mode = paid`
   - `credit_cost = 70/130/190`
   - `generation_profile = paid_720p_audio`
   - `watermark_enabled = false`
   - `post_qa_mode = standard`

如果 `useFreeTrialIfAvailable` 省略，使用产品默认：

- 8 秒任务：如果免费试用可用，则使用免费试用。
- 16/24 秒任务：始终付费。

### 模板与分镜

试用状态必须来自 `video_jobs.billing_mode`，不能来自 query 参数或客户端请求体。

免费试用任务：

- 只推荐/允许低风险试用模板。
- 如果确认分镜时模板已经不再满足试用资格，必须拒绝确认。

付费任务：

- 使用正常付费模板规则。

### 确认分镜

创建 segment 前：

- 如果 `billing_mode = free_trial`，再次校验试用资格。
- 如果创建任务到确认分镜之间试用资格已经被其他任务占用，只有在 UI 明确支持“转为付费”的情况下才允许转换；否则返回清晰错误，让用户重新以付费模式创建。
- 创建 segment 时复制 job 的生成档位参数。

付费任务在 Creem prompt moderation 通过后冻结点数。
免费试用任务跳过点数冻结。

### 提交 Segment

扩展视频生成输入：

- `resolution`
- `audio`
- `watermarkEnabled`
- `generationProfile`

APIMart PixVerse V6 请求体示例：

```json
{
  "model": "pixverse-v6",
  "prompt": "...",
  "duration": 8,
  "resolution": "540p or 720p",
  "audio": true,
  "size": "9:16"
}
```

不要假设 APIMart 会自动加产品水印。只有在 APIMart 文档和真实调用确认支持水印参数后，才能把水印交给供应商处理。否则必须在 stitch/后处理阶段加水印，试用任务不能在无水印状态下进入 `deliverable`。

### 成本记录

APIMart 返回成本信息时，不能继续把 provider cost 记为 0。

轮询 APIMart task 时解析这些可能字段：

- `data.cost`
- `cost`
- `usage.cost`

写入：

- `provider_call_logs.cost_estimate`
- `video_segments.cost_estimate`

如果供应商没有返回成本字段，系统可以继续运行，但后台必须显示为 unknown，不能静默当成 0 成本。

## IP 访问记录

记录 job/trial 相关操作的明文 IP。

IP 提取顺序沿用管理员审计日志：

1. `x-forwarded-for` 的第一个值
2. `x-real-ip`
3. 没有则为 null

至少记录：

- 创建任务
- 试用资格检查
- 试用发放
- 试用拒绝
- 发起 checkout

MVP 阶段这不是硬性反滥用拦截。第一版只记录证据，让管理员能够排查异常模式。本次不拦截多邮箱行为。

访问控制要求：

- 明文 IP 只能通过管理员权限查看。
- 不在普通用户 API 返回明文 IP。
- 不在 operator 级后台页面显示明文 IP。
- 不在用户侧页面、任务详情页、充值页、工作台里特别提示 IP 采集。
- 管理员查看 IP 的操作如后续做导出或批量查询，应写入管理员审计日志。

## API/UI 行为

### Workspace

UI 不再把 8 秒固定展示为免费。

状态：

- 试用可用：8 秒选项展示免费试用。
- 试用不可用：8 秒选项展示 70 点。
- 16/24 秒始终展示付费点数。

UI 不发送 `isTrial`。

### 用户任务详情

用户侧可以展示：

- 是否免费试用/付费
- 点数消耗
- 是否带水印
- 是否带音频

用户侧不展示：

- 明文 IP
- 风控访问记录
- trial eligibility snapshot 的内部判定细节

### 管理员后台

管理员任务详情应展示 segment 级：

- provider/model
- resolution
- audio enabled
- watermark enabled
- generation profile
- cost estimate

管理员可以查看用户访问记录中的明文 IP，用于排查重复试用、异常注册、支付争议和成本攻击。

operator 不查看明文 IP；如果现有 operator 权限需要排障，只能看脱敏信息，例如 `has_ip = true` 或 IP 前缀/哈希，不能看完整 IP。

## 错误处理

- 如果数据库不可用导致试用资格无法检查，免费试用应 fail closed，返回可重试错误。不要静默创建付费任务，除非用户明确选择付费。
- 如果 APIMart 拒绝 `audio` 或某个分辨率，走现有 provider failure 路径；付费任务必须释放冻结点数。
- 如果试用任务水印处理失败，任务不能进入 `deliverable`。

## 测试要求

必须覆盖：

- 8 秒任务且过去 24 小时无试用记录时，创建 `free_trial`，`credit_cost = 0`，`generation_profile = trial_540p_watermarked`。
- 8 秒任务但过去 24 小时已有试用记录时，创建付费任务，`credit_cost = 70`。
- 16/24 秒任务始终付费。
- 客户端传 `isTrial=true` 不能强制免费。
- 免费试用确认分镜时拒绝非试用模板。
- 免费试用 segment 创建时复制 `540p`、`audio=false`、`watermark=true`。
- 付费 segment 创建时复制 `720p`、`audio=true`、`watermark=false`。
- APIMart 请求体包含 `resolution` 和 `audio`。
- APIMart poll 返回成本时能写入成本字段。
- 创建任务/试用检查/试用发放/试用拒绝时记录明文 IP 和 user agent。
- 普通用户 API 不返回明文 IP。
- operator 不能查看明文 IP。
- admin 可以查看明文 IP。

## 非目标

- 本次不实现多邮箱注册拦截。
- 本次不做设备指纹。
- 本次不要求手机号验证。
- 本次不向普通用户开放 `1080p + audio`。
- 本次不做完整风控 dashboard。
- 本次不依赖前端逻辑决定是否收费。
- 本次不在产品 UI 中专门提示 IP 采集。

## 已确认决策

- 免费试用：每用户滚动 24 小时 1 次，8 秒，`540p`，带水印，无音频。
- 付费默认：`720p + audio`。
- 明文 IP 记录用于 MVP 运营/风控排查。
- 明文 IP 只有管理员可见。
- 普通产品 UI 不特别说明 IP 采集。
