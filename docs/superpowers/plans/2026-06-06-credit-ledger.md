# 点数账本服务层 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立点数账本服务层，为 Creem webhook、免费试用、分镜确认冻结点数和 Post-QA 扣点提供统一入口。

**Architecture:** 领域规则与存储适配分离。账本操作通过 store 接口执行，生产使用 Drizzle transaction，测试使用 memory store。钱包余额可冗余，但所有变化必须有 `credit_ledger` 流水。

---

### Task 1: 账本领域测试

**Files:**
- Create: `src/lib/credits/ledger.test.ts`
- Create: `src/lib/credits/memory-store.ts`
- Create: `src/lib/credits/types.ts`

- [x] 测试 purchase idempotency。
- [x] 测试 trial grant。
- [x] 测试 reserve/capture/release。
- [x] 测试余额不足时拒绝 reserve/capture。
- [x] 测试 admin adjust 必须有原因。

### Task 2: 账本服务实现

**Files:**
- Create: `src/lib/credits/ledger.ts`

- [x] 实现 purchase/trial grant。
- [x] 实现 reserve/capture/release。
- [x] 实现 refund/admin adjust。
- [x] 所有操作统一写 ledger 快照字段。

### Task 3: Drizzle store 与事务边界

**Files:**
- Create: `src/lib/credits/drizzle-store.ts`
- Modify: `src/lib/db/client.ts`
- Create: `src/lib/db/client.test.ts`

- [x] 实现 Drizzle credit ledger store。
- [x] 将 DB client 切到支持 transaction 的 Neon serverless Pool。
- [x] 增加 transaction 能力防回归测试。

### Task 4: 验证

**Commands:**
- `npm test -- src/lib/db/client.test.ts src/lib/credits/ledger.test.ts`
- `npm run typecheck`
- 后续阶段结束时运行 `npm run lint && npm test && npm run build`

- [x] 阶段针对性测试通过。
- [x] TypeScript 检查通过。
