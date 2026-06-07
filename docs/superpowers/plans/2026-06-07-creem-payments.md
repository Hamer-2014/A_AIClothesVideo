# Creem 支付与入账 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Creem checkout 创建、本地订单记录、webhook 签名校验和点数幂等入账。

**Architecture:** 支付成功只以 Creem webhook 为准。checkout route 负责登录校验、点数包校验、创建本地订单和返回 Creem checkout URL；webhook route 使用 raw body + `creem-signature` 验签，校验订单与金额后调用点数账本服务入账。

**Tech Stack:** Next.js App Router, TypeScript, Drizzle, Creem REST API, Vitest.

---

### Task 1: 点数包配置

**Files:**
- Create: `src/lib/credits/packages.ts`
- Create: `src/lib/credits/packages.test.ts`

- [ ] 定义 Starter、Creator、Studio 点数包。
- [ ] 提供 `getCreditPackage`，未知 code 返回 null。
- [ ] 测试金额、币种、点数和 product code。

### Task 2: Creem client

**Files:**
- Create: `src/lib/providers/creem/client.ts`
- Create: `src/lib/providers/creem/client.test.ts`

- [ ] 从环境变量读取 API key 和 base URL。
- [ ] 未配置 key 时抛出不可用错误，不伪造成功。
- [ ] 创建 checkout 时向 `/v1/checkouts` 发送请求。
- [ ] 测试请求 header、body 和错误处理。

### Task 3: Webhook 签名与事件解析

**Files:**
- Create: `src/lib/providers/creem/webhook.ts`
- Create: `src/lib/providers/creem/webhook.test.ts`

- [ ] 校验 `creem-signature` HMAC-SHA256。
- [ ] 解析 `checkout.completed` 所需字段。
- [ ] 不支持事件返回 ignored。
- [ ] 签名错误抛出验签错误。

### Task 4: 订单编排服务

**Files:**
- Create: `src/server/billing/orders.ts`
- Create: `src/server/billing/orders.test.ts`

- [ ] checkout 创建本地订单。
- [ ] webhook paid 事件校验本地订单、产品包、金额、币种、userId。
- [ ] 调用 `purchaseCredits` 幂等入账。
- [ ] 重复 webhook 不重复充值。

### Task 5: API routes

**Files:**
- Create: `src/app/api/billing/checkout/route.ts`
- Create: `src/app/api/billing/checkout/route.test.ts`
- Create: `src/app/api/webhooks/creem/route.ts`
- Create: `src/app/api/webhooks/creem/route.test.ts`

- [ ] checkout 未登录返回 401。
- [ ] checkout 未知 package 返回 400。
- [ ] checkout 成功返回 checkout URL。
- [ ] webhook 签名失败返回 401。
- [ ] webhook paid 成功返回 `{ received: true }`。

### Task 6: 验证

**Commands:**
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

- [ ] 全部通过后汇报。
