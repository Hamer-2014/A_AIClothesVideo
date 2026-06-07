# 点数账本服务层设计

## 目标

建立 Creem 支付、免费试用、任务冻结、质检扣除、失败释放、退款和管理员调整共用的点数账本服务层。该阶段不接 Creem checkout/webhook，只先固定账本领域规则和数据库事务边界。

## 设计

- `src/lib/credits/ledger.ts` 提供领域操作：`purchaseCredits`、`grantTrialCredits`、`reserveCredits`、`captureReservedCredits`、`releaseReservedCredits`、`refundCredits`、`adjustCredits`。
- 每次余额变化必须写 `credit_ledger`，并通过 `idempotencyKey` 保证重放不重复生效。
- `reserve` 从 `availableBalance` 移到 `reservedBalance`。
- `capture` 从 `reservedBalance` 扣除，并累计 `totalCaptured`。
- `release` 从 `reservedBalance` 退回 `availableBalance`。
- `purchase` 和 `trial_grant` 增加可用余额，并分别累计购买/赠送统计。
- `admin_adjust` 必须填写原因。

## 存储边界

- `src/lib/credits/types.ts` 定义账本 store 接口。
- `src/lib/credits/memory-store.ts` 用于纯单元测试，不连接数据库。
- `src/lib/credits/drizzle-store.ts` 通过 Drizzle transaction 同时更新钱包和流水。
- 数据库 client 使用 `drizzle-orm/neon-serverless` + Neon `Pool`，因为 `neon-http` 不支持函数式事务，不适合账本和 worker 状态机。

## 风险控制

- 不允许负数、零、小数点数变更。
- 余额不足时不能 `reserve`。
- 冻结余额不足时不能 `capture` 或 `release`。
- 重复 idempotency key 返回已有 ledger，不二次更新钱包。
- 账本服务不直接处理 Creem webhook 签名和订单状态，下一阶段由支付模块调用本服务。

## 验收

- 账本领域测试覆盖幂等、冻结、扣除、释放、退款、管理员调整。
- DB client 有 transaction 能力测试，防止回退到不支持事务的 driver。
- `npm test -- src/lib/db/client.test.ts src/lib/credits/ledger.test.ts` 通过。
- `npm run typecheck` 通过。
