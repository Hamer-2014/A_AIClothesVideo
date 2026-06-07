# 视觉素材分析服务层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现真实视觉 provider 调用、provider_call_logs 审计、asset analysis 保存和模板推荐衔接。

**Architecture:** 视觉 provider client 负责 OpenAI-compatible 调用和 JSON 响应提取；workflow 服务负责审计日志、schema 解析、分析保存和模板推荐。视觉模型只输出观察结果，模板权限仍由规则引擎决定。

**Tech Stack:** TypeScript, Drizzle, Vitest.

---

### Task 1: Analysis Schema

**Files:**
- Create: `src/server/assets/analysis-schema.ts`
- Create: `src/server/assets/analysis-schema.test.ts`

- [x] 解析必需 JSON 字段。
- [x] 校验 asset role 和 human presence。
- [x] 拒绝缺字段或非法字段。

### Task 2: Completeness Mapping

**Files:**
- Create: `src/server/assets/classify-role.ts`
- Create: `src/server/assets/classify-role.test.ts`

- [x] 将 front/back/side/detail/scene 转换为素材完整度。
- [x] 从 human presence 识别 model front。
- [x] 从 visible details 提取 fabric/neckline/cuff/print。
- [x] 判断素材是否可继续生成。

### Task 3: Analysis Workflow

**Files:**
- Create: `src/server/assets/analyze.ts`
- Create: `src/server/assets/analyze.test.ts`

- [x] 保存 asset analysis。
- [x] 单图分析输出模板推荐。
- [x] 不合格素材返回空可用模板。
- [x] 多图分析聚合后输出模板推荐。

### Task 4: Vision Provider Client

**Files:**
- Create: `src/lib/providers/vision/client.ts`
- Create: `src/lib/providers/vision/client.test.ts`

- [x] 读取 `VISION_PROVIDER`、`VISION_API_KEY`、`VISION_BASE_URL` 和分级模型配置。
- [x] 图片作为 `image_url` input 传入 provider。
- [x] 解析 provider 返回的 JSON content。
- [x] provider 未配置或返回错误时不伪造成功。

### Task 5: Provider Call Logs

**Files:**
- Create: `src/lib/providers/log-call.ts`
- Create: `src/lib/providers/log-call.test.ts`
- Update: `src/server/assets/analyze.ts`
- Update: `src/server/assets/analyze.test.ts`

- [x] 成功视觉调用写入 `provider_call_logs`。
- [x] `asset_analyses.provider_call_log_id` 关联成功调用日志。
- [x] provider/API 失败写 failed 日志且不保存分析。
- [x] provider 返回 schema 错误用真实 provider/model 写 failed 日志。
- [x] 数据库存储失败不误记为 provider failed。

### Task 6: Verification

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] 运行完整验证。
