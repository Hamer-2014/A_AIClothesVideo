# 数据库与 Drizzle 里程碑设计

## 范围

本阶段实现 `DEVELOPMENT_SPEC.md` 第 3 章：Drizzle + Neon Postgres 数据访问层、MVP 核心表 schema、迁移配置和 schema 基础测试。

本阶段不接入 better-auth 登录流程、不执行 Creem/R2/模型业务，也不伪造任何外部调用成功。认证表只建立数据库结构，为下一阶段 better-auth adapter 对接预留。

## 架构

数据库 schema 按职责拆分：

- `auth.ts`：better-auth 基础表。
- `users.ts`：用户资料和后台角色。
- `assets.ts`：素材与素材分析。
- `templates.ts`：镜头模板与模板指标。
- `jobs.ts`：视频任务、分镜、片段、拼接、Post-QA、状态事件。
- `credits.ts`：钱包、流水和订单。
- `providers.ts`：provider、key、model route、调用日志、prompt moderation。
- `audit.ts`：管理员审计和滥用事件。
- `index.ts`：集中导出，供 Drizzle Kit 和 app client 使用。

运行时数据库客户端使用 `@neondatabase/serverless` + `drizzle-orm/neon-http`，适配 Vercel serverless 短请求。迁移使用 `drizzle-kit generate` 和 `drizzle-kit migrate`，schema 输出到 `drizzle/`。

## 数据模型原则

所有业务表包含 `id`、`created_at`、`updated_at`。涉及软删除或暂停的业务资产使用 `deleted_at` 或 `status`。

任务相关表必须包含可恢复字段：`status`、`is_test`、`locked_by`、`locked_until`、`attempt_count`、`last_error`、`next_retry_at`。`video_segments` 独立成表，不塞进 `video_jobs` JSON。

点数变化只通过 `credit_ledger` 记录，钱包余额是派生/冗余状态。模型调用全部写 `provider_call_logs`。Prompt moderation 单独写 `prompt_moderation_results`，方便 Creem review 和申诉。

API Key 存储字段命名为 `encrypted_key`，本阶段只建表，不实现加密逻辑；下一阶段 provider/key 管理必须写入加密值，不能保存明文。

## 测试

本阶段用 Vitest 做 schema smoke test：

- 核心表必须全部导出。
- 关键表必须存在关键字段，例如 `video_segments`、`credit_ledger`、`provider_call_logs`、`job_state_events`。
- 枚举包含 SPEC 要求的任务状态、账本类型和 provider purpose。

迁移 SQL 由 Drizzle Kit 生成。若未连接真实 Neon，本阶段只验证生成迁移文件；执行迁移留到有确认数据库后运行。

## 风险

better-auth 的具体 adapter 表结构可能在认证阶段微调。本阶段先建立常见基础表，后续若 adapter 要求不同，需要以真实 adapter 为准调整 migration，不能在代码里硬凑。

Postgres enum 一旦生成生产迁移，删除/重命名会有成本。因此本阶段尽量按 SPEC 全量列出 MVP 状态，少做临时枚举名。
