# Creem 支付与入账设计

## 目标

真实接入 Creem checkout 和 webhook，让用户购买点数包后通过 webhook 幂等入账。本阶段只实现服务端支付入口、订单记录、webhook 验签和 `credit_ledger.purchase` 入账，不实现账单 UI、后台订单页和生产端到端人工验收。

## 外部接口判断

- Checkout 创建使用 Creem `POST /v1/checkouts`。
- test mode 使用 `https://test-api.creem.io`，production 可使用 `https://api.creem.io`。
- webhook 使用 raw body 校验 `creem-signature`，算法为 HMAC-SHA256。
- 以 `checkout.completed` 作为 MVP 充值事件。
- 订单、产品、客户和 metadata 从 webhook payload 提取，无法识别的产品不入账。

## 本地边界

- `src/lib/credits/packages.ts` 定义 Starter/Creator/Studio 点数包。
- `src/lib/providers/creem/client.ts` 创建 checkout，不在本地伪造支付成功。
- `src/lib/providers/creem/webhook.ts` 解析和校验 webhook。
- `src/server/billing/orders.ts` 负责本地订单 upsert 和 paid 入账编排。
- `src/app/api/billing/checkout/route.ts` 要求登录，只返回 Creem checkout URL。
- `src/app/api/webhooks/creem/route.ts` 不要求用户 session，只信任 webhook 签名。

## 入账规则

- 本地 checkout 创建订单状态为 `created`。
- webhook 签名失败返回 401，不入账。
- 只有 `checkout.completed` 入账，其他事件返回 ignored。
- 重复 webhook 使用 `purchase:creem:{externalOrderId}` 作为账本 idempotency key，不能重复充值。
- webhook payload 中的 `metadata.userId` 与本地订单 user ID 不一致时拒绝入账。
- webhook product code 必须匹配点数包配置，金额和币种必须匹配点数包配置。
- 入账使用现有 `purchaseCredits`，写 `credit_ledger.purchase`。

## 暂不做

- 不做 Creem 生产配置实测。
- 不做账单页和后台订单管理页。
- 不做退款 webhook 自动处理。
- 不做税务、优惠券、订阅。

## 验收

- checkout API 未登录返回 401。
- checkout API 对未知点数包返回 400。
- checkout API 创建本地订单并返回 checkout URL。
- webhook 签名错误返回 401。
- webhook 重放不重复充值。
- webhook 金额/币种/product 不匹配不入账。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 通过。
