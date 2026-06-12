# 付费闭环与失败补偿验收 SPEC

日期：2026-06-12

## 目标

把当前 MVP 从“代码与试用链路基本可跑”推进到“后台/API 阻断项有真实证据通过”。本 SPEC 只解决两个上线前硬阻断：

1. 至少一个真实付费任务完成交付，证明 `reserve -> capture -> deliverable` 成立。
2. 至少一个真实付费任务进入失败补偿，证明 `reserve -> release/refund -> failed_released/failed_refunded` 成立。

验收完成后，`npm run verify:blockers` 必须返回通过。

## 当前基线

根据 2026-06-12 本地检查：

- `npm run typecheck` 通过。
- `npm test` 通过，`116` 个 test files、`425` 个 tests。
- `npm run build` 通过。
- `npm run verify:blockers -- --json` 未通过。

当前未通过项：

- `paid_delivery`：真实库没有 `credit_cost > 0` 且 `deliverable` 的任务证据。
- `failure_compensation`：真实库没有 `credit_cost > 0` 且 `failed_released/failed_refunded` 的补偿证据。

当前已通过项：

- `audit_evidence`：真实库已有 `credits:admin_adjust` 和 `job:reopen_post_qa` 审计证据。

## 范围

### 必须完成

- 创建或选择一个测试用户，并通过合法后台补点方式发放足够点数。
- 创建一个非试用付费任务，确保 `video_jobs.credit_cost > 0`。
- 让该任务走完生成、拼接、Post-QA、交付链路。
- 对该任务运行 `npm run smoke:backend -- --job-id <paid-job-id>`。
- 确认该任务同时具备：
  - `video_jobs.status = deliverable`
  - `credit_ledger.type` 包含 `reserve`
  - `credit_ledger.type` 包含 `capture`
  - `video_jobs.final_video_key` 不为空
  - `post_qa_results.frame_keys` 至少 1 张
- 创建第二个非试用付费任务，确保已经产生 `reserve`。
- 通过真实系统路径触发失败补偿，优先使用 Post-QA failed resolve 或管理员标记不可交付路径。
- 确认失败补偿任务同时具备：
  - `video_jobs.status in ('failed_released', 'failed_refunded')`
  - `credit_ledger.type` 包含 `release` 或 `refund`
  - `job_state_events` 有对应状态流转
- 更新验收文档，记录真实 job id、命令、结果摘要。

### 可以做

- 如果现有脚本不方便定位问题，可以增强脚本输出，但不得降低断言。
- 如果真实链路暴露 bug，可以修复相关代码并补测试。
- 如果 `verify:blockers` 的错误信息不够可操作，可以增强错误报告，但不得放宽通过标准。

### 不做

- 不做 UI 大改。
- 不新增营销页。
- 不把 `credit_cost = 0` 的试用任务当付费闭环证据。
- 不用 mock Creem 支付成功证明购买链路。
- 不手动改数据库伪造 `deliverable`、`capture`、`release` 或 `refund`。
- 不绕过 Creem Prompt Moderation。
- 不在 Vercel Function 内执行 ffmpeg。

## 推荐验证路径

### 付费成功路径

1. 用 `scripts/admin-adjust-credits.mjs` 给测试用户补点。
2. 通过前台工作台或 API 创建非试用任务。
3. 上传真实测试服装素材，创建 `assets` 和 `video_job_assets`。
4. 执行素材分析、模板选择、分镜生成、分镜确认。
5. 确认后应产生 `credit_ledger.reserve`。
6. 等待或推进片段生成、Cloud Run 拼接、Post-QA。
7. Post-QA passed 后应产生 `credit_ledger.capture`，任务进入 `deliverable`。
8. 运行 backend smoke 和 blocker verification。

### 失败补偿路径

优先使用单独的付费任务，不要复用已经成功交付的 paid delivery 样本。

允许两种方式：

1. Post-QA failed resolve：在任务已 reserve 后，调用 `POST /api/internal/post-qa/resolve`，传入 `status = failed`，由系统服务执行 release 与状态流转。
2. 管理员标记不可交付：在后台对已 reserve 的付费任务执行“标记不可交付”，由系统服务执行 release 与审计。

两种方式都必须通过应用服务或 API 执行，不能直接 SQL 更新状态或账本。

## 验收命令

基础验证：

```bash
npm run typecheck
npm test
npm run build
```

付费成功样本：

```bash
npm run smoke:backend -- --job-id <paid-deliverable-job-id>
```

阻断项总验收：

```bash
npm run verify:blockers -- --json
```

期望：

- `passed = true`
- `paid_delivery.passed = true`
- `failure_compensation.passed = true`
- `audit_evidence.passed = true`

## 证据记录格式

完成后更新 `docs/API_TEST_STATUS.md`，新增一个 dated section，至少包含：

```markdown
## 2026-06-12 Paid Closure Verification

- Paid delivery job id:
- Paid delivery smoke command:
- Paid delivery smoke result:
- Failure compensation job id:
- Failure compensation trigger:
- Failure compensation result:
- `npm run verify:blockers -- --json` result:
- Known residual risks:
```

## 风险与审视

这里最大的坑是把“脚本能跑”误当“商业闭环可上线”。`verify:blockers` 只证明后台/API 有关键证据，不证明 Creem 真实支付 review、真实用户转化、供应商成本和大规模稳定性已经完成。

另一个坑是为了尽快绿灯而制造假证据。别干这种蠢事。你要的是能上线收钱的系统，不是能糊弄自己的报告。任何直接改库伪造状态的行为都必须视为验收失败。

