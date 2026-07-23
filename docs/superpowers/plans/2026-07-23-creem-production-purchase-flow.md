# Creem Production Purchase Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在生产环境完成 Creem 点数包购买闭环，使登录用户可以从价格页发起真实付款，并由可信 webhook 幂等入账、查询结果及处理退款。

**Architecture:** 浏览器只提交固定 `packageCode`，服务端从环境变量映射 Creem Product ID 和价格。服务端先创建本地订单，再用同一个 `request_id` 创建 Creem Checkout；成功跳转只表示“等待确认”，唯一入账依据仍是签名通过的 webhook。生产发布增加 `CREEM_PURCHASES_ENABLED` 开关，支持先部署配置、后开放入口以及异常时快速停止新 Checkout。

**Tech Stack:** Next.js 16 App Router、React 19、TypeScript、Vitest、Testing Library、Drizzle ORM、Neon Postgres、Creem REST API/Webhooks、Vercel Environment Variables

---

## Scope And File Map

**Create:**

- `src/components/billing/purchase-button.tsx`：登录回跳、Checkout 请求、按钮互斥和错误反馈。
- `src/components/billing/purchase-button.test.tsx`：购买按钮 focused tests。
- `src/components/billing/payment-status.tsx`：成功页轮询本地订单状态。
- `src/components/billing/payment-status.test.tsx`：轮询停止条件和错误状态测试。
- `src/app/api/billing/orders/[externalOrderId]/route.ts`：只允许订单所属用户查询付款状态。
- `src/app/api/billing/orders/[externalOrderId]/route.test.ts`：订单越权和状态查询测试。
- `drizzle/0019_purchase_reversal_ledger.sql`：增加支付退款账本类型。

**Modify:**

- `.env.example`：记录生产支付开关和三项 Product ID 配置约束。
- `src/lib/providers/creem/config.ts`：生产支付开关及生产配置判断。
- `src/lib/providers/creem/client.ts`：改用官方 `x-api-key`，规范供应商错误。
- `src/lib/providers/creem/client.test.ts`：锁定官方请求契约。
- `src/server/ops/health.ts`、`src/server/ops/health.test.ts`：开启支付时强制检查三个 Product ID。
- `src/server/billing/orders.ts`、`src/server/billing/orders.test.ts`：订单状态更新、Checkout 快照、退款撤销。
- `src/server/billing/drizzle-orders.ts`：实现订单状态和快照更新。
- `src/app/api/billing/checkout/route.ts`、`route.test.ts`：输入验证、本地订单优先、成功 URL 和错误映射。
- `src/app/pricing/page.tsx`、`page.test.tsx`：三个套餐购买入口。
- `src/app/(dashboard)/billing/page.tsx`：增加返回价格页购买点数入口。
- `src/app/(dashboard)/billing/success/page.tsx`、`page.test.tsx`：显示本地订单真实状态，不根据重定向宣称成功。
- `src/lib/db/schema/credits.ts`、`src/lib/credits/types.ts`、`src/lib/credits/ledger.ts`、相关 tests：支付退款负向账本。
- `src/lib/providers/creem/webhook.ts`、`webhook.test.ts`：解析 `refund.created`。
- `src/app/api/webhooks/creem/route.ts`、`route.test.ts`：分发支付完成与退款事件。
- `docs/DEVELOPMENT_SPEC.md`：完成后更新 Checkout、webhook 和生产验证清单。

**Explicitly not modified:**

- 不把真实 API Key、webhook secret 或 Product ID 写入 Git。
- 不增加 Creem Test Mode 分支；自动化测试继续使用依赖注入的 mock，只验证代码契约，不伪造线上成功。
- 不把 Product ID 暴露为 `NEXT_PUBLIC_*`，也不允许浏览器提交价格、点数或 Product ID。

## Task 1: Lock Production Configuration And Creem Request Contract

**Files:**

- Modify: `.env.example`
- Modify: `src/lib/providers/creem/config.ts`
- Modify: `src/lib/providers/creem/config.test.ts`
- Modify: `src/lib/providers/creem/client.ts`
- Modify: `src/lib/providers/creem/client.test.ts`
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`

- [ ] **Step 1: Write failing tests for the official Checkout header and production gates**

Add assertions with these exact contracts:

```ts
expect(requestInit?.headers).toEqual({
  "x-api-key": "creem_live_api_key",
  "Content-Type": "application/json",
});
expect(JSON.stringify(requestInit?.headers)).not.toContain("Authorization");
```

```ts
expect(
  isCreemPurchasesEnabled({ CREEM_PURCHASES_ENABLED: "true" }),
).toBe(true);
expect(
  isCreemPurchasesEnabled({ CREEM_PURCHASES_ENABLED: "false" }),
).toBe(false);
```

For production health, assert that enabling purchases without any one of the following makes `checks.creemPayment.status` equal `missing`:

```ts
[
  "CREEM_BASE_URL",
  "CREEM_API_KEY",
  "CREEM_WEBHOOK_SECRET",
  "CREEM_PRODUCT_ID_STARTER",
  "CREEM_PRODUCT_ID_CREATOR",
  "CREEM_PRODUCT_ID_STUDIO",
]
```

When `CREEM_PURCHASES_ENABLED=false`, assert payment status is `pending` and does not independently make the whole application unready.

- [ ] **Step 2: Run focused tests and confirm the old implementation fails**

Run:

```powershell
pnpm exec vitest run "src/lib/providers/creem/config.test.ts" "src/lib/providers/creem/client.test.ts" "src/server/ops/health.test.ts"
```

Expected: FAIL because the client currently emits `Authorization: Bearer`, the purchase switch does not exist, and health does not require Product IDs.

- [ ] **Step 3: Implement the production purchase switch**

Add to `src/lib/providers/creem/config.ts`:

```ts
type EnvSource = Record<string, string | undefined>;

export function isCreemPurchasesEnabled(
  env: EnvSource = process.env,
): boolean {
  return env.CREEM_PURCHASES_ENABLED?.trim().toLowerCase() === "true";
}
```

Add to `.env.example` immediately before the Product ID variables:

```dotenv
# Production kill switch. Keep false until products, webhook, and health are verified.
CREEM_PURCHASES_ENABLED=false
```

- [ ] **Step 4: Fix the official Creem authentication header**

Change the Checkout request headers in `src/lib/providers/creem/client.ts` to:

```ts
headers: {
  "x-api-key": config.apiKey,
  "Content-Type": "application/json",
},
```

Introduce a provider-safe error so the API route can return `502` without exposing Creem payloads:

```ts
export class CreemCheckoutError extends Error {
  constructor(readonly status: number) {
    super(`Creem checkout failed with status ${status}.`);
    this.name = "CreemCheckoutError";
  }
}
```

Throw `new CreemCheckoutError(response.status)` for non-2xx responses.

- [ ] **Step 5: Make health readiness enforce the complete production payment contract**

When purchases are enabled, `buildOptionalPaymentCheck` must require all six configuration keys above, require `CREEM_BASE_URL === "https://api.creem.io"`, require a live API key according to the existing `isCreemLiveApiKey`, and require each Product ID to start with `prod_`.

When purchases are disabled, return:

```ts
{
  configured: false,
  missing: [],
  status: "pending",
}
```

- [ ] **Step 6: Run focused tests**

Run the Step 2 command again.

Expected: all selected test files pass with zero failed tests.

- [ ] **Step 7: Commit the configuration and provider contract**

```powershell
git add .env.example src/lib/providers/creem/config.ts src/lib/providers/creem/config.test.ts src/lib/providers/creem/client.ts src/lib/providers/creem/client.test.ts src/server/ops/health.ts src/server/ops/health.test.ts
git commit -m "fix: enforce Creem production checkout config"
```

## Task 2: Make Checkout Creation Recoverable And Fail Closed

**Files:**

- Modify: `src/server/billing/orders.ts`
- Modify: `src/server/billing/orders.test.ts`
- Modify: `src/server/billing/drizzle-orders.ts`
- Modify: `src/app/api/billing/checkout/route.ts`
- Modify: `src/app/api/billing/checkout/route.test.ts`

- [ ] **Step 1: Write failing order lifecycle tests**

Cover these behaviors:

```ts
expect(orderStore.listOrders()[0]).toMatchObject({
  externalOrderId: requestId,
  status: "created",
  checkoutSnapshot: { creemProductId: "prod_creator" },
});
```

Assert the local order exists inside the injected `createCheckout` function, proving database creation precedes the external call. Also assert provider failure marks that order `failed`, and provider success updates `checkoutSnapshot.provider` without storing secret fields.

Add malformed-body cases:

```ts
it.each(["", "null", "[]", "not-json"])(
  "returns 400 for malformed checkout body %s",
  async (body) => {
    const response = await handleBillingCheckoutRequest(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        body,
      }),
      {
        getSession: async () => ({ user: { id: "user-1" } }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "invalid_checkout_request",
    });
  },
);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
pnpm exec vitest run "src/server/billing/orders.test.ts" "src/app/api/billing/checkout/route.test.ts"
```

Expected: FAIL because the current code calls Creem before storing the order and malformed JSON can escape as a server error.

- [ ] **Step 3: Extend the order store with narrow update methods**

Add these methods to `OrderStore` and implement them in both in-memory and Drizzle stores:

```ts
updateCheckoutSnapshot(
  externalOrderId: string,
  checkoutSnapshot: JsonValue,
): Promise<BillingOrder>;

markOrderStatus(
  externalOrderId: string,
  status: Extract<OrderStatus, "failed" | "cancelled" | "refunded">,
  webhook?: { eventId: string; snapshot: JsonValue },
): Promise<BillingOrder>;
```

The Drizzle implementation must update `updatedAt` through the schema timestamp behavior and throw when no order matches.

- [ ] **Step 4: Validate the request before reading fields**

Use a guarded parser in the Checkout route:

```ts
async function readCheckoutBody(request: Request) {
  const value = await request.json().catch(() => null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
```

Return `400 { error: "invalid_checkout_request" }` when parsing fails. Continue rejecting `amountCents`, `credits`, and any client-supplied `productId`.

- [ ] **Step 5: Reorder Checkout creation**

Use this sequence:

```ts
const requestId = randomUUID();
await createCheckoutOrder({
  store: orderStore,
  userId,
  packageCode: selectedPackage.code,
  externalOrderId: requestId,
  checkoutSnapshot: { creemProductId: selectedPackage.creemProductId },
});

try {
  const checkout = await createCheckout({
    productId: selectedPackage.creemProductId,
    requestId,
    successUrl: `${getAppUrl()}/billing/success?order=${encodeURIComponent(requestId)}`,
    metadata: { userId, packageCode: selectedPackage.code },
  });

  await orderStore.updateCheckoutSnapshot(requestId, {
    creemProductId: selectedPackage.creemProductId,
    provider: snapshotProviderCheckout(checkout.raw),
  });

  return NextResponse.json({ checkoutUrl: checkout.checkoutUrl });
} catch (error) {
  await orderStore.markOrderStatus(requestId, "failed");
  // Map known provider errors below; rethrow unknown application errors.
}
```

Check `CREEM_PURCHASES_ENABLED` before creating the local order. Return `503 { error: "billing_disabled" }` when false. Map `CreemUnavailableError` to `503` and `CreemCheckoutError` to `502 { error: "billing_provider_error" }`.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command again.

Expected: all selected tests pass.

- [ ] **Step 7: Commit the recoverable Checkout lifecycle**

```powershell
git add src/server/billing/orders.ts src/server/billing/orders.test.ts src/server/billing/drizzle-orders.ts src/app/api/billing/checkout/route.ts src/app/api/billing/checkout/route.test.ts
git commit -m "fix: create local order before Creem checkout"
```

## Task 3: Add Purchase Controls To Pricing And Billing

**Files:**

- Create: `src/components/billing/purchase-button.tsx`
- Create: `src/components/billing/purchase-button.test.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/pricing/page.test.tsx`
- Modify: `src/app/(dashboard)/billing/page.tsx`

- [ ] **Step 1: Write failing purchase button tests**

Test the following exact behavior:

```ts
expect(
  screen.getByRole("link", { name: "Sign in to buy Starter" }),
).toHaveAttribute(
  "href",
  `/login?next=${encodeURIComponent("/pricing?package=starter#credit-packs")}`,
);
```

For authenticated users, click twice rapidly and assert only one request is sent:

```ts
expect(fetchMock).toHaveBeenCalledTimes(1);
expect(fetchMock).toHaveBeenCalledWith("/api/billing/checkout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ packageCode: "starter" }),
});
```

Assert the button is disabled while pending, redirects only when a valid `checkoutUrl` string is returned, and renders an `aria-live="polite"` error for `401`, `502`, `503`, malformed JSON, and network failure.

- [ ] **Step 2: Run the component and pricing tests to verify they fail**

Run:

```powershell
pnpm exec vitest run "src/components/billing/purchase-button.test.tsx" "src/app/pricing/page.test.tsx"
```

Expected: FAIL because the component and purchase controls do not exist.

- [ ] **Step 3: Implement the client purchase component**

Use this public interface:

```ts
interface PurchaseButtonProps {
  authenticated: boolean;
  packageCode: "starter" | "creator" | "studio";
  packageName: string;
  purchasesEnabled: boolean;
}
```

Anonymous users receive a normal Next.js `Link` to the sanitized existing `next` login flow. Authenticated users receive a `<button type="button">` that posts only `{ packageCode }`. Guard with both React state and a `useRef` lock so rapid clicks cannot send duplicate browser requests. Use `window.location.assign(checkoutUrl)` only after a successful response.

Use these user-facing states:

```ts
const labels = {
  idle: `Buy ${packageName}`,
  pending: "Opening secure checkout...",
  disabled: "Purchases temporarily unavailable",
};
```

Map server failures to concise messages without exposing provider responses.

- [ ] **Step 4: Render one purchase control per pricing card**

Add `id="credit-packs"` to the package grid, read `isCreemPurchasesEnabled()` on the server, and render:

```tsx
<PurchaseButton
  authenticated={Boolean(user)}
  packageCode={item.code}
  packageName={item.name}
  purchasesEnabled={purchasesEnabled}
/>
```

Keep Product IDs on the server. Do not pass `item.creemProductId` into the client component.

- [ ] **Step 5: Add a Billing page purchase entry**

Add one prominent link above `CreditLedger`:

```tsx
<Link href="/pricing#credit-packs">Buy credits</Link>
```

Remove the obsolete “支付申请未开通前” subtitle and replace it with text that accurately describes purchases, orders, and ledger history.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command again and add the Billing page test if one exists or is created during implementation.

Expected: each package has exactly one correct purchase control and all selected tests pass.

- [ ] **Step 7: Commit the purchase UI**

```powershell
git add src/components/billing/purchase-button.tsx src/components/billing/purchase-button.test.tsx src/app/pricing/page.tsx src/app/pricing/page.test.tsx "src/app/(dashboard)/billing/page.tsx"
git commit -m "feat: add Creem purchase controls"
```

## Task 4: Show Authoritative Payment Status After Redirect

**Files:**

- Create: `src/app/api/billing/orders/[externalOrderId]/route.ts`
- Create: `src/app/api/billing/orders/[externalOrderId]/route.test.ts`
- Create: `src/components/billing/payment-status.tsx`
- Create: `src/components/billing/payment-status.test.tsx`
- Modify: `src/app/(dashboard)/billing/success/page.tsx`
- Modify: `src/app/(dashboard)/billing/success/page.test.tsx`

- [ ] **Step 1: Write failing ownership and polling tests**

The order status endpoint must satisfy:

```ts
// No session
expect(response.status).toBe(401);

// Order belongs to another user
expect(response.status).toBe(404);

// Owner reads order
expect(await response.json()).toEqual({
  status: "paid",
  packageCode: "starter",
  creditsGranted: 100,
});
```

The component tests must assert polling continues for `created`, stops for `paid`, `failed`, `cancelled`, or `refunded`, and stops after 60 seconds with a link to `/billing` rather than claiming failure.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```powershell
pnpm exec vitest run "src/app/api/billing/orders/[externalOrderId]/route.test.ts" "src/components/billing/payment-status.test.tsx" "src/app/(dashboard)/billing/success/page.test.tsx"
```

Expected: FAIL because the status endpoint and polling component do not exist.

- [ ] **Step 3: Implement the owner-only status endpoint**

Accept the dynamic `externalOrderId`, load the session, find the order, and return `404` for both nonexistent and cross-user orders. Return only:

```ts
{
  status: order.status,
  packageCode: order.productCode,
  creditsGranted: order.creditsGranted,
}
```

Never return webhook snapshots, Checkout URLs, provider IDs, email, API errors, or another user’s existence.

- [ ] **Step 4: Implement bounded payment polling**

`PaymentStatus` must request:

```ts
`/api/billing/orders/${encodeURIComponent(externalOrderId)}`
```

Poll every two seconds with recursive `setTimeout` so requests never overlap. Stop after 30 attempts. Display:

- `created`: “Payment submitted. Waiting for secure confirmation…”
- `paid`: “Payment confirmed. Credits have been added.”
- `failed` or `cancelled`: “Payment was not completed.”
- `refunded`: “This payment has been refunded.”

- [ ] **Step 5: Make the success page neutral until webhook confirmation**

Read `searchParams.order`. When absent, show “We could not identify this checkout. Check Billing for the latest status.” When present, render `PaymentStatus`. The heading must be “Payment status”, not “Payment received”.

- [ ] **Step 6: Run focused tests**

Run the Step 2 command again.

Expected: all selected tests pass, including cross-user denial.

- [ ] **Step 7: Commit authoritative success status**

```powershell
git add "src/app/api/billing/orders/[externalOrderId]/route.ts" "src/app/api/billing/orders/[externalOrderId]/route.test.ts" src/components/billing/payment-status.tsx src/components/billing/payment-status.test.tsx "src/app/(dashboard)/billing/success/page.tsx" "src/app/(dashboard)/billing/success/page.test.tsx"
git commit -m "feat: confirm Creem payments from local order status"
```

## Task 5: Handle Creem Refunds Without Reusing Generation Refund Semantics

**Files:**

- Create: `drizzle/0019_purchase_reversal_ledger.sql`
- Modify: `src/lib/db/schema/credits.ts`
- Modify: `src/lib/credits/types.ts`
- Modify: `src/lib/credits/ledger.ts`
- Modify: `src/lib/credits/ledger.test.ts`
- Modify: `src/lib/providers/creem/webhook.ts`
- Modify: `src/lib/providers/creem/webhook.test.ts`
- Modify: `src/server/billing/orders.ts`
- Modify: `src/server/billing/orders.test.ts`
- Modify: `src/app/api/webhooks/creem/route.ts`
- Modify: `src/app/api/webhooks/creem/route.test.ts`

- [ ] **Step 1: Write failing refund parsing and idempotency tests**

Use the official `refund.created` payload shape. Require:

```ts
{
  type: "refund.created",
  refundId: object.id,
  externalOrderId: object.checkout.request_id,
  productId: object.order.product,
  amountCents: object.order.amount,
  currency: object.order.currency,
  transactionStatus: object.transaction.status,
  metadata: object.checkout.metadata,
}
```

Test only `object.status === "succeeded"` and `transaction.status === "refunded"` as an automatic full refund. Partial or non-succeeded refunds must fail closed and leave credits/order unchanged.

Test webhook replay twice and assert one `purchase_reversal` ledger entry. Test a user who spent all purchased credits and assert the refund can make `availableBalance` negative, preventing further generation until replenished.

- [ ] **Step 2: Run focused refund tests and verify they fail**

Run:

```powershell
pnpm exec vitest run "src/lib/credits/ledger.test.ts" "src/lib/providers/creem/webhook.test.ts" "src/server/billing/orders.test.ts" "src/app/api/webhooks/creem/route.test.ts"
```

Expected: FAIL because `refund.created` and `purchase_reversal` do not exist.

- [ ] **Step 3: Add an explicit payment reversal ledger type**

Create the forward migration:

```sql
ALTER TYPE "public"."credit_ledger_type" ADD VALUE IF NOT EXISTS 'purchase_reversal';
```

Add `purchase_reversal` to `creditLedgerTypeValues`. Do not reuse the current `refund` type; that type restores credits for failed generation and has the opposite balance direction.

- [ ] **Step 4: Implement negative purchase reversal**

Add:

```ts
export function reversePurchasedCredits(input: CreditOperationInput) {
  return applyCreditOperation({
    input,
    type: "purchase_reversal",
    mutate: (wallet) => ({
      walletChanges: {
        availableBalance: wallet.availableBalance - input.amount,
      },
      amountForLedger: -input.amount,
    }),
  });
}
```

Keep `totalPurchased` as gross purchased credits for auditability. The negative ledger entry represents the reversal.

- [ ] **Step 5: Parse and validate `refund.created`**

Extend `ParsedCreemWebhookEvent` with a typed refund event. Normalize `eventType` exactly as for Checkout events, take metadata from `object.checkout.metadata`, and reject missing request ID, product, amount, currency, refund ID, or non-full refund status.

- [ ] **Step 6: Reverse credits and mark the order refunded**

In `handleCreemRefundCreated`, require the local order to be `paid`, validate Product ID against the saved Checkout snapshot, validate package metadata, amount, and currency, then call:

```ts
await reversePurchasedCredits({
  store: ledgerStore,
  userId: order.userId,
  amount: order.creditsGranted,
  relatedOrderId: order.id,
  reason: `Creem refund ${order.productCode}`,
  idempotencyKey: `purchase-refund:creem:${event.refundId}`,
  metadata: {
    externalOrderId: event.externalOrderId,
    productId: event.productId,
  },
});
```

Then mark the order `refunded` with the refund event ID and raw snapshot. Route `checkout.completed` and `refund.created` explicitly; continue acknowledging unrelated events as ignored.

- [ ] **Step 7: Run focused refund tests**

Run the Step 2 command again.

Expected: all selected tests pass; duplicate refund webhook does not double-debit.

- [ ] **Step 8: Commit refund handling and migration**

```powershell
git add drizzle/0019_purchase_reversal_ledger.sql src/lib/db/schema/credits.ts src/lib/credits/types.ts src/lib/credits/ledger.ts src/lib/credits/ledger.test.ts src/lib/providers/creem/webhook.ts src/lib/providers/creem/webhook.test.ts src/server/billing/orders.ts src/server/billing/orders.test.ts src/app/api/webhooks/creem/route.ts src/app/api/webhooks/creem/route.test.ts
git commit -m "feat: reverse credits for Creem refunds"
```

## Task 6: Configure And Validate The Real Production Flow

**Files:**

- Modify: `docs/DEVELOPMENT_SPEC.md`
- No committed secret/configuration files

- [ ] **Step 1: Create and verify the three production Creem products**

In the Creem production dashboard, create one-time products matching the server constants exactly:

| Package | Amount | Currency | Credits |
|---|---:|---|---:|
| Starter | 999 cents | USD | 100 |
| Creator | 2999 cents | USD | 360 |
| Studio | 7999 cents | USD | 1100 |

Confirm each product is active, one-time rather than recurring, and described as usage credits for AI Clothes Video. Record the three IDs returned by Creem in the password manager or deployment secret inventory, not in Git.

- [ ] **Step 2: Configure Vercel production variables with purchases still disabled**

Set these exact variable names in the Vercel Production environment:

| Variable | Exact value or source |
|---|---|
| `APP_ENV` | Exact value `production` |
| `APP_URL` | Exact value `https://aiclothesvideo.com` |
| `CREEM_BASE_URL` | Exact value `https://api.creem.io` |
| `CREEM_API_KEY` | Creem production dashboard, API Keys section |
| `CREEM_WEBHOOK_SECRET` | Secret generated for the production webhook endpoint |
| `CREEM_PRODUCT_ID_STARTER` | ID returned by the $9.99 Starter product |
| `CREEM_PRODUCT_ID_CREATOR` | ID returned by the $29.99 Creator product |
| `CREEM_PRODUCT_ID_STUDIO` | ID returned by the $79.99 Studio product |
| `CREEM_PURCHASES_ENABLED` | Exact value `false` for the first deployment |

Sensitive values must be pasted directly from Creem into Vercel and must never be written to repository files or command output.

- [ ] **Step 3: Configure the production webhook**

Set the Creem endpoint to:

```text
https://aiclothesvideo.com/api/webhooks/creem
```

Subscribe to at least `checkout.completed` and `refund.created`. Confirm the webhook secret in Creem matches the Vercel Production variable.

- [ ] **Step 4: Deploy schema before enabling purchases**

Run against the production database through the approved deployment environment:

```powershell
pnpm db:migrate
```

Expected: migration `0019_purchase_reversal_ledger.sql` applies once without error.

- [ ] **Step 5: Deploy the application and verify readiness while disabled**

Run:

```powershell
curl.exe -fsS https://aiclothesvideo.com/api/health
```

Expected: the response identifies production, does not expose configuration values, and reports Creem payment as `pending` because the kill switch is false.

- [ ] **Step 6: Enable real purchases and redeploy**

Set `CREEM_PURCHASES_ENABLED=true`, redeploy, then run the health request again.

Expected: `ready=true`, `checks.creemPayment.status="ready"`, and `checks.creemPayment.missing=[]`. Do not proceed to payment while health reports missing configuration.

- [ ] **Step 7: Execute one real Starter purchase**

Using a dedicated production verification account:

1. Open `/pricing` and confirm all three purchase controls are present.
2. Buy only the Starter product first to minimize real-money exposure.
3. Confirm Creem shows a completed production Checkout for `$9.99` plus applicable tax.
4. Confirm `/billing/success` initially waits for webhook and then shows paid.
5. Confirm `/billing` shows one paid Starter order and exactly 100 purchased credits.
6. In the admin billing view, confirm one purchase ledger entry and no duplicate credit grant.

- [ ] **Step 8: Verify webhook replay idempotency**

Use Creem’s webhook dashboard to redeliver the same `checkout.completed` event once.

Expected: endpoint returns success, the order remains paid, and available credits do not increase a second time.

- [ ] **Step 9: Execute one real full refund**

Refund the verification Starter order completely in Creem.

Expected: `refund.created` is delivered, the local order becomes refunded, one `purchase_reversal` entry of `-100` appears, and webhook redelivery does not create another reversal.

- [ ] **Step 10: Update the development checklist with evidence**

Mark Checkout and webhook items complete only after recording the production Checkout ID, webhook event IDs, deployment commit, verification account, timestamp, and refund result in the private operations log. Update public `docs/DEVELOPMENT_SPEC.md` checkboxes without adding IDs, email addresses, or secrets.

## Task 7: Final Review And Repository Verification

**Files:** all files changed in Tasks 1-6

- [ ] **Step 1: Run one merged payment/security review**

The reviewer checks the combined diff once, focusing on:

- Product ID and prices remain server authoritative.
- Cross-user order status returns `404`.
- Checkout redirect never grants credits.
- Webhook uses raw body and validates `creem-signature` before parsing.
- Checkout/refund metadata, Product ID, amount, currency, user and package all match.
- Checkout and refund replay are idempotent.
- No secret or Product ID value is committed or logged.
- A provider/DB failure cannot produce an unmatchable paid Checkout.

Fix Critical and Important findings. Record Minor findings without starting another full review cycle.

- [ ] **Step 2: Run focused payment verification**

```powershell
pnpm exec vitest run "src/lib/providers/creem/config.test.ts" "src/lib/providers/creem/client.test.ts" "src/server/ops/health.test.ts" "src/server/billing/orders.test.ts" "src/lib/credits/ledger.test.ts" "src/lib/providers/creem/webhook.test.ts" "src/app/api/billing/checkout/route.test.ts" "src/app/api/billing/orders/[externalOrderId]/route.test.ts" "src/app/api/webhooks/creem/route.test.ts" "src/components/billing/purchase-button.test.tsx" "src/components/billing/payment-status.test.tsx" "src/app/pricing/page.test.tsx" "src/app/(dashboard)/billing/success/page.test.tsx"
```

Expected: all selected test files pass with zero failures.

- [ ] **Step 3: Run the full repository gate once**

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: every command exits with code `0`. Diagnose failures before claiming completion; do not infer build success from tests.

- [ ] **Step 4: Inspect the final diff and secret boundary**

```powershell
git status --short
git diff --check
git diff --stat
git diff -- .env.example src docs drizzle
```

Expected: no `.env.local`, API key, webhook secret, live Product ID, Checkout URL, customer email, or payment card data is staged.

- [ ] **Step 5: Commit final review fixes and documentation**

```powershell
git add docs/DEVELOPMENT_SPEC.md
git commit -m "docs: record Creem production purchase verification"
```

## Acceptance Criteria

- `/pricing` 为三个点数包各显示一个购买入口。
- 未登录用户保留套餐选择并安全返回登录流程；登录用户只提交 `packageCode`。
- Checkout REST API 使用官方 `x-api-key`。
- 开启支付时，缺失任一 Product ID、生产 API URL、API key 或 webhook secret 都会阻止 readiness 和 Checkout。
- 本地订单在调用 Creem 之前存在，Creem 回调始终可按 `request_id` 匹配。
- 重定向页不会把 URL 跳转当作付款成功；只有 webhook 可入账。
- Checkout webhook 重放不会重复增加点数。
- 全额退款会产生一次负向 `purchase_reversal` 并把订单标为 refunded；重放不会重复扣减。
- 生产支付可以通过 `CREEM_PURCHASES_ENABLED=false` 立即停止新 Checkout。
- 完成一次真实 Starter 购买、webhook 重放和全额退款验证，并且仓库中不存在任何生产密钥或真实 Product ID。

## Official References

- Creem one-time payment: https://docs.creem.io/features/one-time-payment
- Create Checkout API: https://docs.creem.io/api-reference/endpoint/create-checkout
- Creem webhooks: https://docs.creem.io/code/webhooks
- Creem refunds and cancellations: https://docs.creem.io/features/subscriptions/refunds-and-cancellations
