# 视觉素材分析与 Provider 调用设计

## 目标

建立真实视觉 provider 调用、调用审计、模型 JSON 解析、分析保存和模板推荐衔接服务。本阶段已接入素材分析触发 API 与 asset-analysis worker tick；仍不接前台 UI、DeepSeek 和视频生成。

## 设计

- `src/lib/providers/vision/client.ts` 使用 OpenAI-compatible `chat/completions` 调用视觉模型，按 `lite`、`standard`、`strict` 选择模型环境变量，并把图片作为 `image_url` input 传入。
- `src/lib/providers/log-call.ts` 提供 `provider_call_logs` 写入 store，记录 provider、model、purpose、请求摘要、响应摘要、耗时、状态和错误。
- `src/server/assets/analysis-schema.ts` 解析视觉模型 JSON，要求包含 `asset_role`、`garment_category`、`view_angle`、`human_present`、`visible_details`、`not_visible_details`、`quality`、`confidence`、`risk_flags`。
- `src/server/assets/classify-role.ts` 将一条或多条分析转换为模板规则引擎需要的素材完整度。
- `src/server/assets/analyze.ts` 编排视觉调用、审计日志、`asset_analyses` 保存，判断素材是否可继续生成，并输出模板推荐结果。
- `src/server/assets/job-analysis.ts` 从 `video_job_assets` 读取当前 job 绑定素材，生成 R2 signed URL 后逐张分析，并聚合模板推荐。
- `POST /api/jobs/[id]/analyze` 只接受当前登录用户自己的 job，不信任请求体传入的 assetId 列表。

## 规则

- 视觉模型只输出观察结果，不直接决定模板权限。
- `quality.is_garment`、`quality.is_clear`、`quality.is_safe` 任一为 false 时，素材不可继续生成。
- 多图推荐使用所有可接受分析结果聚合素材完整度。
- 不合格素材仍保存分析结果，但返回空可用模板。
- Lite 调用日志 purpose 为 `lite_asset_check`。
- Standard 调用日志 purpose 为 `standard_asset_analysis`。
- Strict 调用日志 purpose 为 `strict_asset_review`。
- provider 网络/API 错误写入 failed 日志，不保存分析结果。
- provider 返回 JSON schema 不合格时，用真实 provider/model 写入 failed 日志，不保存分析结果。
- `asset_analyses.provider_call_log_id` 必须关联成功调用日志。
- 审计日志不保存 R2 signed URL 原文，只保存 assetId、图片数量和 mode。

## 暂不做

- 不更新 `assets.status`。
- 不做前台展示。
- 不接 Post-QA 抽帧复用。
- 不实现 Lite 预检 worker；当前 cron tick 只处理 `asset_analysis_queued`。

## 验收

- 无效 JSON 被拒绝。
- 正面/背面/细节/场景/模特信息可转换为素材完整度。
- 不合格素材不会输出可用模板。
- 多张素材可聚合后推荐背面和细节模板。
- 图片以 image input 传入视觉 provider。
- 每次视觉 provider 调用写入 `provider_call_logs`。
- provider 失败不会伪造素材分析成功。
- 持久化失败不会被错误归因为 provider 失败。
- job 素材分析只分析已绑定到 `video_job_assets` 且属于当前用户的素材。
- asset-analysis worker tick 可以处理 `asset_analysis_queued`，但 Lite 预检仍待单独实现。
