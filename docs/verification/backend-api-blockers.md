# Backend/API Blocker Verification

**目的：** 用可重复命令验证后台/API 阻断项，避免把 0 成本试用任务、自动化单测或口头描述误当成真实商业闭环。

## 验证命令

```bash
npm run verify:blockers
```

机器可读输出：

```bash
npm run verify:blockers -- --json
```

命令退出规则：

- 所有阻断项通过：exit `0`
- 任一阻断项缺证据：exit `1`

## 当前检查项

## 最近一次通过证据

- Date: 2026-06-12
- Paid delivery job id: `5bb8f149-8e20-4d7f-b2b6-82d9db7ceb06`
- Failure compensation job id: `b207d897-04dd-41cc-b1a8-02b56a6cc3a1`
- Verification command: `npm run verify:blockers -- --json`
- Result: `passed = true`

## 2026-06-13 更新

- `verify:blockers` 的 paid delivery 检查已加上公开视频 provider/model 断言。
- 付费交付样本必须同时证明 `video_segments.provider` 包含 `apimart`，且 `video_segments.model` 包含 `pixverse-v6`。
- 这一步防止环境变量误配导致任务走错视频模型时仍被误判为商业闭环通过。

### 1. Paid Delivery

必须存在至少一个真实数据库任务满足：

- `video_jobs.credit_cost > 0`
- `video_jobs.status = deliverable`
- `credit_ledger` 中有该 job 的 `reserve`
- `credit_ledger` 中有该 job 的 `capture`
- `video_jobs.final_video_key` 不为空
- `post_qa_results.frame_keys` 至少 1 张
- `video_segments.provider` 包含 `apimart`
- `video_segments.model` 包含 `pixverse-v6`

补齐方式：

1. 用后台补点或测试钱包给测试用户发放点数，不要使用 Creem mock 支付。
2. 创建非试用任务，例如 8 秒付费任务，确保 `credit_cost = 70`。
3. 完成上传、素材分析、分镜、确认、segment 生成、stitch、Post-QA。
4. 运行：

```bash
npm run smoke:backend -- --job-id <paid-job-id>
npm run verify:blockers
```

### 2. Failure Compensation

必须存在至少一个真实数据库任务满足：

- `video_jobs.credit_cost > 0`
- `video_jobs.status in ('failed_released', 'failed_refunded')`
- `credit_ledger` 中有该 job 的 `release` 或 `refund`
- `job_state_events` 中有该 job 的状态事件

补齐方式：

1. 准备一个 `credit_cost > 0` 且已经 reserve 的测试任务。
2. 让 provider、stitch 或 Post-QA 进入失败路径。
3. 使用系统自动 resolve 或后台标记不可交付释放点数。
4. 运行：

```bash
node scripts/job-debug.mjs <failed-paid-job-id>
npm run verify:blockers
```

### 3. Audit Evidence

必须存在至少一个敏感后台操作审计：

- `provider_key:create`
- `provider_key:rotate`
- `credits:admin_adjust`
- `job:mark_undeliverable`
- `job:retry_segment`
- `job:reopen_post_qa`

补齐方式：

1. 在后台执行一次敏感操作，并填写 reason。
2. 打开 `/admin/audit-logs` 或查询数据库确认记录。
3. 运行：

```bash
npm run verify:blockers
```

## 不接受的“通过”方式

- 不接受 `credit_cost = 0` 的试用任务替代 paid delivery。
- 不接受只看 `npm test` 通过替代真实 smoke。
- 不接受手动改数据库伪造 `deliverable`、`capture` 或 `release`。
- 不接受 Creem mock 支付成功来证明购买链路。
- 不接受 Post-QA 未通过前开放下载。
