# API 测试状态清单

> 目的：把这次真实跑过什么、哪里成功、哪里失败、失败卡在哪，写成可复核记录，避免把“代码写了”误当成“闭环验收完成”。

更新时间：2026-06-11

## 结论先说

- Admin Ops Closure 的代码改动已完成，`/admin/jobs`、`/admin/jobs/[id]`、Provider / Template / Billing 页面和敏感动作 reason / audit 约束都已落地。
- 本轮本地验证已通过：
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- 本轮真实环境验证结论已更新：
  - `npm run smoke:stitch` 成功
  - `npm run smoke:backend -- --job-id 5dff9bea-3bf6-4c14-bf31-18ddc5d4bcd4` 成功
- 之前 `smoke:backend` 失败不是 Cloud Run 或 Post-QA 问题，也不是该样本的 capture 漏扣；根因是该 job 的 `credit_cost = 0`，属于 8 秒免费试用链路，旧 smoke 对 0 成本任务也强制要求 `credit_ledger.capture`，造成误报。
- 已修复 smoke 断言：只有 full smoke 且 `credit_cost > 0` 的付费任务才必须存在 `capture`；同时 full smoke 缺少 `credit_cost` 字段会直接失败，避免付费任务被误当 0 成本而假绿。

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
- full smoke 下只有 `credit_cost > 0` 才要求 `capture`。

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

## 当前仍未完成的真实验收项

下面这些不能假装已经过：

| 项目 | 当前状态 | 说明 |
| --- | --- | --- |
| 0 成本试用任务 deliverable 后 smoke | 已通过 | 样本 job `credit_cost = 0`，不要求 capture |
| 付费任务 deliverable 后 `credit_ledger.capture` | 未验收 | 需要新建或选择 `credit_cost > 0` 的真实任务跑 full smoke |
| `failed_released / failed_refunded` 真实补偿回路 smoke | 未补 | 仍需真实任务演练 |
| 运维动作后的 `admin_audit_logs` 真实库回查 | 未单独留档 | 自动化已覆盖，但缺本轮真实截图/SQL 留痕 |

## 这次记录真正暴露的问题

最大的问题不是后台页面，而是验收口径之前错了：

- 当前真实任务已经 `deliverable`
- Post-QA 已 `passed`
- final video 与 QA frames 都在 R2
- 但该任务 `credit_cost = 0`，旧 smoke 没查 `credit_cost` 却强制要求 `capture`

这意味着如果只看一句 “ledger 没有 capture”，很容易把试用单误判成账务事故；反过来，如果 smoke 没有 `credit_cost` 保护，也可能把付费单误判成试用单而放过真正的漏扣。

下一步不要先去挑页面样式，优先补齐付费任务真实 smoke：必须拿一个 `credit_cost > 0` 的任务跑到 `deliverable`，并看到 `credit_ledger.reserve` 与 `credit_ledger.capture`。
