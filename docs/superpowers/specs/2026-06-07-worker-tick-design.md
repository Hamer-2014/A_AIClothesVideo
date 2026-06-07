# 任务状态机与 Worker Tick 设计

## 目标

建立可审计、可恢复、有限处理的任务推进基础。当前阶段只把 `asset_analysis_queued` 接入真实 worker tick；Lite 预检、视频 segment、stitch 和 Post-QA 后续单独接入，避免在状态机基础未稳定时假装全链路完成。

## 设计

- `src/server/jobs/state-machine.ts` 定义 job 状态流转规则，所有状态变化写 `job_state_events`。
- `src/server/jobs/locks.ts` 提供任务领取锁，支持 `locked_until` 过期恢复和 `attempt_count` 递增。
- `src/server/workers/tick.ts` 单次处理有限数量任务，领取后复查真实状态，防止旧锁或重复 tick 重复处理已完成任务。
- `src/app/api/internal/worker/tick/route.ts` 校验 `CRON_JOB_SECRET`，授权后运行 worker tick。
- `src/app/api/jobs/[id]/analyze/route.ts` 允许用户手动触发自己 job 的素材分析。

## 规则

- cron secret 缺失时返回 `cron_not_configured`，不能默认放行。
- secret 错误返回 `unauthorized`。
- tick 不泄露内部错误细节。
- worker tick 必须有处理上限。
- 当前默认 tick 只处理 `asset_analysis_queued`。
- `analyzeVideoJobAssets` 可由 API 自己管理状态，也可由 worker tick 统一管理状态，避免双重流转。
- 失败状态写 `last_error` 和 `job_state_events`。

## 暂不做

- 不实现 Lite 视觉预检 worker。
- 不实现 `video_segments` 状态推进。
- 不实现 DeepSeek、EvoLink、Cloud Run stitch、Post-QA。
- 不做前台工作台 UI。

## 验收

- 合法状态流转写审计事件。
- 非法状态流转被拒绝。
- 锁未过期时不会重复领取。
- 锁过期后可恢复领取。
- 重复 tick 不会重复处理已完成 job。
- cron endpoint 必须校验 `CRON_JOB_SECRET`。
