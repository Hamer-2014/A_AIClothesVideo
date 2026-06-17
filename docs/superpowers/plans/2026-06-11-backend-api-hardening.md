# Backend/API Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成后台/API 上线前加固：付费账务闭环、失败补偿验收、审计查询、Provider key 轮换、点数包可见化、Creem 代码审查和关键权限幂等测试。

**Architecture:** 基于现有 Next.js App Router、Drizzle、Neon、R2、Cloud Run worker、admin service 层增量增强。数据库仍是状态机、账本和审计的唯一事实来源；后台只做排障和运维，不绕过 Post-QA、Creem Moderation 或账本。

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Drizzle, Neon Postgres, better-auth, Creem, Cloudflare R2, Cloud Run, Vitest.

---

## 执行前必读

- `docs/superpowers/specs/2026-06-11-backend-api-hardening-spec.md`
- `docs/PRD.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/API_FLOW.md`
- `docs/API_TEST_STATUS.md`
- `docs/superpowers/specs/2026-06-11-admin-ops-closure-spec.md`

Creem 真实支付验证后置；但 checkout/webhook/moderation 的代码审查、签名、幂等、fail closed 不后置。

---

## Task 1: 当前基线确认

**Files:**
- Check: `docs/API_TEST_STATUS.md`
- Check: `docs/API_FLOW.md`
- Check: `src/server/admin/providers.ts`
- Check: `src/server/admin/billing.ts`
- Check: `src/server/admin/audit.ts`
- Check: `scripts/backend-smoke.mjs`
- Check: `scripts/lib/backend-smoke-utils.mjs`

- [ ] **Step 1: 确认工作区状态**

Run:

```bash
git status --short
```

Expected:

- 没有未知的业务改动。
- 如果存在用户改动，记录文件名，后续不要覆盖。

- [ ] **Step 2: 跑基础验证**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected:

- `typecheck` 通过。
- `test` 通过。
- `build` 通过。

- [ ] **Step 3: 记录基线**

更新 `docs/API_TEST_STATUS.md`，新增一段 “Backend/API Hardening 起点”：

```markdown
## Backend/API Hardening 起点

- 日期：2026-06-11
- 基础验证：
  - `npm run typecheck`: pass/fail
  - `npm test`: pass/fail
  - `npm run build`: pass/fail
- 当前已知缺口：
  - 付费任务 `credit_cost > 0` full smoke 未验收
  - 失败补偿路径未真实留痕
  - audit logs 缺后台查询
  - provider key 缺新增/轮换
  - Creem 真实支付验证 pending Creem approval
```

- [ ] **Step 4: 提交基线文档**

Run:

```bash
git add docs/API_TEST_STATUS.md
git commit -m "docs: record backend api hardening baseline"
```

---

## Task 2: 加强付费任务 smoke 断言

**Files:**
- Modify: `scripts/lib/backend-smoke-utils.mjs`
- Modify: `scripts/lib/backend-smoke-utils.test.ts`
- Modify: `scripts/backend-smoke.mjs`
- Modify: `docs/API_TEST_STATUS.md`

- [ ] **Step 1: 阅读现有 smoke utils**

Run:

```bash
Get-Content -Raw scripts\lib\backend-smoke-utils.mjs
Get-Content -Raw scripts\lib\backend-smoke-utils.test.ts
```

Expected:

- 找到 `assertSmokeCreditLedger`。
- 确认现有逻辑已区分 `credit_cost = 0` 和 `credit_cost > 0`。

- [ ] **Step 2: 写付费任务断言测试**

在 `scripts/lib/backend-smoke-utils.test.ts` 增加测试：

```ts
it("requires reserve and capture for paid full smoke jobs", () => {
  expect(() =>
    assertSmokeCreditLedger({
      mode: "full",
      job: { id: "job-paid", credit_cost: 70 },
      ledger: [
        { type: "reserve", amount: 70 },
        { type: "capture", amount: 70 },
      ],
    }),
  ).not.toThrow();
});

it("fails paid full smoke jobs without reserve", () => {
  expect(() =>
    assertSmokeCreditLedger({
      mode: "full",
      job: { id: "job-paid", credit_cost: 70 },
      ledger: [{ type: "capture", amount: 70 }],
    }),
  ).toThrow(/reserve/i);
});

it("fails paid full smoke jobs without capture", () => {
  expect(() =>
    assertSmokeCreditLedger({
      mode: "full",
      job: { id: "job-paid", credit_cost: 70 },
      ledger: [{ type: "reserve", amount: 70 }],
    }),
  ).toThrow(/capture/i);
});

it("allows zero cost full smoke jobs without ledger entries", () => {
  expect(() =>
    assertSmokeCreditLedger({
      mode: "full",
      job: { id: "job-trial", credit_cost: 0 },
      ledger: [],
    }),
  ).not.toThrow();
});
```

如果当前测试数据字段是 `creditCost` 而不是 `credit_cost`，按现有 helper 的实际字段名调整，保持生产脚本和测试一致。

- [ ] **Step 3: 跑测试确认失败或通过**

Run:

```bash
npm test -- scripts/lib/backend-smoke-utils.test.ts
```

Expected:

- 如果 helper 已满足要求，测试通过。
- 如果缺 `reserve` 检查，应失败。

- [ ] **Step 4: 修正 helper**

在 `assertSmokeCreditLedger` 中确保：

```js
if (mode !== "full") {
  return;
}

if (job.credit_cost === undefined || job.credit_cost === null) {
  throw new Error("Full backend smoke requires video_jobs.credit_cost.");
}

const creditCost = Number(job.credit_cost);
if (creditCost <= 0) {
  return;
}

const types = new Set(ledger.map((entry) => entry.type));
if (!types.has("reserve")) {
  throw new Error("Paid full backend smoke requires credit_ledger.reserve.");
}
if (!types.has("capture")) {
  throw new Error("Paid full backend smoke requires credit_ledger.capture.");
}
```

- [ ] **Step 5: 跑 smoke utils 测试**

Run:

```bash
npm test -- scripts/lib/backend-smoke-utils.test.ts
```

Expected:

- 测试通过。

- [ ] **Step 6: 更新验收文档**

在 `docs/API_TEST_STATUS.md` 记录：

```markdown
### Paid smoke 断言

- full smoke 下 `credit_cost > 0` 必须同时存在 `reserve` 和 `capture`
- full smoke 下 `credit_cost = 0` 不要求 capture
- full smoke 缺少 `credit_cost` 直接失败
```

- [ ] **Step 7: 提交**

Run:

```bash
git add scripts/lib/backend-smoke-utils.mjs scripts/lib/backend-smoke-utils.test.ts docs/API_TEST_STATUS.md
git commit -m "test: require paid smoke reserve and capture"
```

---

## Task 3: 失败补偿路径服务层复核

**Files:**
- Modify: `src/server/post-qa/resolve.test.ts`
- Modify: `src/server/post-qa/resolve.ts`
- Modify: `src/server/admin/job-actions.test.ts`
- Modify: `src/server/admin/job-actions.ts`
- Modify: `src/server/jobs/state-machine.test.ts`
- Modify: `docs/API_TEST_STATUS.md`

- [ ] **Step 1: 阅读现有补偿实现**

Run:

```bash
Get-Content -Raw src\server\post-qa\resolve.ts
Get-Content -Raw src\server\post-qa\resolve.test.ts
Get-Content -Raw src\server\admin\job-actions.ts
Get-Content -Raw src\server\admin\job-actions.test.ts
```

Expected:

- 找到 Post-QA failed 到 release/refund 的实现。
- 找到 admin release-credits 的 release 实现。

- [ ] **Step 2: 增加 Post-QA 失败不 capture 测试**

在 `src/server/post-qa/resolve.test.ts` 增加测试，断言：

```ts
it("releases reserved credits instead of capturing when post-qa fails", async () => {
  const store = createInMemoryPostQaResolveStore({
    job: {
      id: "job-paid",
      userId: "user-1",
      status: "post_qa_running",
      creditCost: 70,
      reservedLedgerId: "ledger-reserve",
    },
    ledger: [{ type: "reserve", amount: 70 }],
  });

  const result = await resolvePostQaResult({
    store,
    jobId: "job-paid",
    status: "failed",
    failureCategory: "garment_drift",
    resultJson: { reason: "color drift" },
  });

  expect(result.job.status).toBe("failed_released");
  expect(store.listLedger().map((entry) => entry.type)).toContain("release");
  expect(store.listLedger().map((entry) => entry.type)).not.toContain("capture");
});
```

按当前测试 helper 的实际函数名调整，不要创建重复 store。

- [ ] **Step 3: 增加 admin 不可交付释放测试**

在 `src/server/admin/job-actions.test.ts` 增加测试：

```ts
it("releases credits for a reserved failed job and writes release plus audit", async () => {
  const auditStore = createInMemoryAdminAuditStore();
  const store = createInMemoryAdminJobActionStore({
    jobs: [
      {
        id: "job-paid",
        userId: "user-1",
        status: "post_qa_failed",
        creditCost: 70,
        reservedLedgerId: "ledger-reserve",
      },
    ],
    ledger: [{ type: "reserve", amount: 70, relatedJobId: "job-paid" }],
  });

  await releaseJobCreditsByAdmin({
    store,
    auditStore,
    actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
    jobId: "job-paid",
    reason: "QA failed and cannot deliver",
  });

  expect(store.findJob("job-paid")?.status).toBe("failed_released");
  expect(store.listLedger().map((entry) => entry.type)).toContain("release");
  expect(auditStore.listAuditLogs()).toHaveLength(1);
});
```

按现有测试 helper 调整字段名。

- [ ] **Step 4: 跑相关测试**

Run:

```bash
npm test -- src/server/post-qa/resolve.test.ts src/server/admin/job-actions.test.ts src/server/jobs/state-machine.test.ts
```

Expected:

- 失败路径测试通过。

- [ ] **Step 5: 修正实现**

如测试失败，修正实现：

- Post-QA failed 不得调用 capture。
- 失败后如果有 reserved credits，必须 release 或 refund。
- `job_state_events` 写入失败原因。
- 重复 resolve 不得重复 release。

- [ ] **Step 6: 更新文档**

在 `docs/API_TEST_STATUS.md` 增加：

```markdown
### 失败补偿自动化覆盖

- Post-QA failed 不 capture
- Post-QA failed 释放冻结点数
- Admin release-credits 写 release 和 audit
- 重复 resolve 不重复释放
```

- [ ] **Step 7: 提交**

Run:

```bash
git add src/server/post-qa/resolve.ts src/server/post-qa/resolve.test.ts src/server/admin/job-actions.ts src/server/admin/job-actions.test.ts src/server/jobs/state-machine.test.ts docs/API_TEST_STATUS.md
git commit -m "test: cover failed job credit release paths"
```

---

## Task 4: Admin audit logs API 和页面

**Files:**
- Modify: `src/server/admin/audit.ts`
- Modify: `src/server/admin/audit.test.ts`
- Create: `src/app/api/admin/audit-logs/route.ts`
- Create: `src/app/api/admin/audit-logs/route.test.ts`
- Create: `src/app/admin/audit-logs/page.tsx`
- Modify: `src/components/admin/admin-shell.tsx`

- [ ] **Step 1: 给 audit store 增加查询接口测试**

在 `src/server/admin/audit.test.ts` 增加：

```ts
it("filters audit logs by action target and actor", async () => {
  const store = createInMemoryAdminAuditStore();
  await store.createAuditLog({
    actorEmail: "admin@example.com",
    action: "provider_key:create",
    targetType: "provider_key",
    targetId: "key-1",
    reason: "rotate key",
  });
  await store.createAuditLog({
    actorEmail: "ops@example.com",
    action: "segments:retry",
    targetType: "segment",
    targetId: "segment-1",
    reason: "retry failed segment",
  });

  const rows = await listAdminAuditLogs({
    store,
    filters: {
      actorEmail: "admin@example.com",
      action: "provider_key:create",
      targetType: "provider_key",
      targetId: "key-1",
    },
  });

  expect(rows).toHaveLength(1);
  expect(rows[0]?.action).toBe("provider_key:create");
});
```

- [ ] **Step 2: 实现查询类型和函数**

在 `src/server/admin/audit.ts` 增加：

```ts
export interface AdminAuditFilters {
  actorEmail?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  limit?: number;
}

export interface AdminAuditQueryStore extends AdminAuditStore {
  listAuditLogs(filters: Required<Pick<AdminAuditFilters, "limit">> & Omit<AdminAuditFilters, "limit">): Promise<AdminAuditRecord[]>;
}

export async function listAdminAuditLogs({
  store,
  filters = {},
}: {
  store: AdminAuditQueryStore;
  filters?: AdminAuditFilters;
}) {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  return store.listAuditLogs({
    actorEmail: filters.actorEmail,
    action: filters.action,
    targetType: filters.targetType,
    targetId: filters.targetId,
    limit,
  });
}
```

同时扩展 in-memory 和 Drizzle store。Drizzle 查询可先按 `createdAt desc limit` 后服务层过滤，但数据量增长后应迁移到 SQL where。

- [ ] **Step 3: 增加 route 测试**

创建 `src/app/api/admin/audit-logs/route.test.ts`，覆盖：

```ts
it("rejects non-admin users", async () => {
  const response = await GET(new Request("http://localhost/api/admin/audit-logs"));
  expect(response.status).toBe(401);
});

it("returns audit logs for admin users", async () => {
  const response = await GET(
    new Request("http://localhost/api/admin/audit-logs?action=provider_key:create"),
  );
  expect(response.status).toBe(200);
});
```

按项目现有 route test 的 session mock 方式实现，不要发真实 HTTP。

- [ ] **Step 4: 实现 route**

创建 `src/app/api/admin/audit-logs/route.ts`：

```ts
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/server/auth/admin-session";
import {
  createDrizzleAdminAuditStore,
  listAdminAuditLogs,
} from "@/server/admin/audit";

export async function GET(request: Request) {
  const session = await requireAdminSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const rows = await listAdminAuditLogs({
    store: createDrizzleAdminAuditStore(),
    filters: {
      actorEmail: url.searchParams.get("actorEmail") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      targetType: url.searchParams.get("targetType") ?? undefined,
      targetId: url.searchParams.get("targetId") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50),
    },
  });

  return NextResponse.json({ auditLogs: rows });
}
```

按项目实际 admin session API 调整函数名。

- [ ] **Step 5: 创建页面**

创建 `src/app/admin/audit-logs/page.tsx`，页面包含：

- 筛选表单：actorEmail、action、targetType、targetId。
- 表格：createdAt、actorEmail、action、targetType、targetId、reason、ipAddress。
- before/after snapshot 摘要，使用 `JSON.stringify(value).slice(0, 240)`，不要展开完整大 JSON。

- [ ] **Step 6: 更新后台导航**

修改 `src/components/admin/admin-shell.tsx`，增加 `/admin/audit-logs` 导航项。

- [ ] **Step 7: 验证**

Run:

```bash
npm test -- src/server/admin/audit.test.ts src/app/api/admin/audit-logs/route.test.ts
npm run typecheck
```

Expected:

- 测试通过。
- typecheck 通过。

- [ ] **Step 8: 提交**

Run:

```bash
git add src/server/admin/audit.ts src/server/admin/audit.test.ts src/app/api/admin/audit-logs src/app/admin/audit-logs src/components/admin/admin-shell.tsx
git commit -m "feat: add admin audit log viewer"
```

---

## Task 5: Provider key 新增和轮换

**Files:**
- Create: `src/server/admin/provider-key-crypto.ts`
- Create: `src/server/admin/provider-key-crypto.test.ts`
- Modify: `src/server/admin/providers.ts`
- Modify: `src/server/admin/providers.test.ts`
- Create: `src/app/api/admin/provider-keys/route.ts`
- Create: `src/app/api/admin/provider-keys/route.test.ts`
- Create: `src/app/api/admin/provider-keys/[id]/rotate/route.ts`
- Create: `src/app/api/admin/provider-keys/[id]/rotate/route.test.ts`
- Modify: `src/components/admin/provider-table.tsx`
- Modify: `src/app/admin/providers/page.tsx`

- [ ] **Step 1: 实现 key preview 和加密测试**

创建 `src/server/admin/provider-key-crypto.test.ts`：

```ts
import { describe, expect, it } from "vitest";

import {
  createProviderKeyPreview,
  decryptProviderKey,
  encryptProviderKey,
} from "./provider-key-crypto";

describe("provider key crypto", () => {
  it("creates a masked key preview", () => {
    expect(createProviderKeyPreview("sk-live-1234567890abcdef")).toBe("sk-l...cdef");
  });

  it("encrypts and decrypts provider keys", () => {
    const secret = "12345678901234567890123456789012";
    const encrypted = encryptProviderKey("sk-test-secret", secret);
    expect(encrypted).not.toContain("sk-test-secret");
    expect(decryptProviderKey(encrypted, secret)).toBe("sk-test-secret");
  });
});
```

- [ ] **Step 2: 创建 crypto helper**

创建 `src/server/admin/provider-key-crypto.ts`：

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function createProviderKeyPreview(plainKey: string) {
  const trimmed = plainKey.trim();
  if (trimmed.length <= 8) {
    return "****";
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function normalizeSecret(secret: string) {
  const value = secret.trim();
  if (value.length < 32) {
    throw new Error("PROVIDER_KEY_ENCRYPTION_SECRET must be at least 32 characters.");
  }
  return Buffer.from(value.slice(0, 32), "utf8");
}

export function encryptProviderKey(plainKey: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeSecret(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainKey.trim(), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderKey(encrypted: string, secret: string) {
  const [ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");
  if (!ivRaw || !tagRaw || !ciphertextRaw) {
    throw new Error("Invalid encrypted provider key payload.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    normalizeSecret(secret),
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
```

- [ ] **Step 3: 跑 crypto 测试**

Run:

```bash
npm test -- src/server/admin/provider-key-crypto.test.ts
```

Expected:

- 测试通过。

- [ ] **Step 4: 增加 provider service 测试**

在 `src/server/admin/providers.test.ts` 增加：

```ts
it("allows admin to create provider keys without returning secrets", async () => {
  const auditStore = createInMemoryAdminAuditStore();
  const store = createInMemoryProviderOpsStore({
    providers: [{ id: "provider-1", name: "evolink", displayName: "EvoLink", status: "active", baseUrl: null }],
    keys: [],
    routes: [],
  });

  const key = await createProviderKey({
    store,
    auditStore,
    actor: { userId: "admin-1", email: "admin@example.com", role: "admin" },
    input: {
      providerId: "provider-1",
      label: "EvoLink staging",
      environment: "staging",
      plainKey: "sk-test-1234567890",
      dailyCostLimit: "20.00",
      concurrentLimit: 1,
      status: "paused",
      reason: "initial staging key",
    },
    encryptionSecret: "12345678901234567890123456789012",
  });

  expect(key.keyPreview).toBe("sk-t...7890");
  expect(JSON.stringify(key)).not.toContain("sk-test-1234567890");
  expect(auditStore.listAuditLogs()[0]?.action).toBe("provider_key:create");
});

it("rejects operator provider key creation", async () => {
  await expect(
    createProviderKey({
      store: createInMemoryProviderOpsStore({ providers: [], keys: [], routes: [] }),
      auditStore: createInMemoryAdminAuditStore(),
      actor: { userId: "op-1", email: "op@example.com", role: "operator" },
      input: {
        providerId: "provider-1",
        label: "bad",
        environment: "staging",
        plainKey: "sk-test",
        dailyCostLimit: "20.00",
        concurrentLimit: 1,
        status: "paused",
        reason: "operator attempt",
      },
      encryptionSecret: "12345678901234567890123456789012",
    }),
  ).rejects.toThrow(/cannot/i);
});
```

- [ ] **Step 5: 扩展 ProviderOpsStore**

在 `src/server/admin/providers.ts` 增加 store 方法：

```ts
createKey(input: {
  providerId: string;
  label: string;
  environment: string;
  status: ProviderStatus;
  encryptedKey: string;
  keyPreview: string;
  dailyCostLimit: string;
  concurrentLimit: number;
}): Promise<ProviderOpsKey>;

rotateKey(input: {
  keyId: string;
  encryptedKey: string;
  keyPreview: string;
}): Promise<ProviderOpsKey>;
```

新增服务函数：

```ts
export async function createProviderKey(...) { ... }
export async function rotateProviderKey(...) { ... }
```

要求：

- 只有 admin 可执行。
- `reason` 使用 `normalizeAdminReason`。
- `plainKey.trim()` 不能为空。
- `encryptionSecret` 缺失时报错。
- 返回对象不包含 `encryptedKey`。
- 写 audit：`provider_key:create` / `provider_key:rotate`。

- [ ] **Step 6: 实现 Drizzle store**

在 `createDrizzleProviderOpsStore` 中实现：

- insert `providerKeys`。
- update `providerKeys.encryptedKey/keyPreview`。
- returning 只返回安全字段。

- [ ] **Step 7: 创建 API route 测试**

创建：

- `src/app/api/admin/provider-keys/route.test.ts`
- `src/app/api/admin/provider-keys/[id]/rotate/route.test.ts`

覆盖：

- admin 成功。
- operator 403。
- reason 少于 6 字符 400。
- 响应不包含 plain/encrypted key。

- [ ] **Step 8: 实现 API routes**

创建：

```text
src/app/api/admin/provider-keys/route.ts
src/app/api/admin/provider-keys/[id]/rotate/route.ts
```

实现：

- 解析 JSON。
- 校验 admin session。
- 调用 service。
- 返回安全字段。

- [ ] **Step 9: 更新 Provider 页面**

修改 `src/app/admin/providers/page.tsx` 和 `src/components/admin/provider-table.tsx`：

- 显示新增 key 表单。
- 显示 rotate 表单。
- 两者都要求 reason。
- helper text：`完整 key 只会提交一次，服务端加密保存，页面不会回显。`

- [ ] **Step 10: 验证**

Run:

```bash
npm test -- src/server/admin/provider-key-crypto.test.ts src/server/admin/providers.test.ts src/app/api/admin/provider-keys/route.test.ts src/app/api/admin/provider-keys/[id]/rotate/route.test.ts
npm run typecheck
```

Expected:

- 测试通过。
- typecheck 通过。

- [ ] **Step 11: 提交**

Run:

```bash
git add src/server/admin/provider-key-crypto.ts src/server/admin/provider-key-crypto.test.ts src/server/admin/providers.ts src/server/admin/providers.test.ts src/app/api/admin/provider-keys src/app/admin/providers/page.tsx src/components/admin/provider-table.tsx
git commit -m "feat: add provider key creation and rotation"
```

---

## Task 6: Billing 点数包可见化

**Files:**
- Modify: `src/server/admin/billing.ts`
- Modify: `src/server/admin/billing.test.ts`
- Modify: `src/app/api/admin/billing/route.ts`
- Modify: `src/app/api/admin/billing/route.test.ts`
- Modify: `src/components/admin/billing-table.tsx`
- Modify: `src/app/admin/billing/page.tsx`

- [ ] **Step 1: 增加 billing service 测试**

在 `src/server/admin/billing.test.ts` 增加：

```ts
it("includes configured credit packages in billing ops overview", async () => {
  const overview = await getBillingOpsOverview({
    store: createInMemoryBillingOpsStore({
      wallets: [],
      orders: [],
      ledger: [],
    }),
  });

  expect(overview.creditPackages.map((item) => item.code)).toEqual([
    "starter",
    "creator",
    "studio",
  ]);
  expect(overview.creditPackages[0]).toMatchObject({
    amountCents: 999,
    currency: "USD",
    credits: 100,
  });
});
```

- [ ] **Step 2: 修改 billing service**

在 `src/server/admin/billing.ts` 引入：

```ts
import { creditPackages } from "@/lib/credits/packages";
```

让 `getBillingOpsOverview` 返回：

```ts
return {
  wallets,
  orders: orderRecords,
  ledger: ledgerRecords,
  creditPackages,
  pricingSource: "code",
  creemVerificationStatus: "pending_creem_approval",
};
```

- [ ] **Step 3: 更新 admin billing API 测试**

在 `src/app/api/admin/billing/route.test.ts` 断言响应包含：

```ts
expect(body.creditPackages).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ code: "starter", credits: 100 }),
  ]),
);
expect(body.pricingSource).toBe("code");
expect(body.creemVerificationStatus).toBe("pending_creem_approval");
```

- [ ] **Step 4: 更新页面**

修改 `src/components/admin/billing-table.tsx` 或 `src/app/admin/billing/page.tsx`：

- 新增 “Credit Packages” 区块。
- 展示 code、name、amount、currency、credits、creemProductId。
- 展示提示：`当前点数包来自代码配置；Creem 产品 ID 和真实 checkout 待 Creem 账号通过后复核。`

- [ ] **Step 5: 验证**

Run:

```bash
npm test -- src/server/admin/billing.test.ts src/app/api/admin/billing/route.test.ts
npm run typecheck
```

Expected:

- 测试通过。
- typecheck 通过。

- [ ] **Step 6: 提交**

Run:

```bash
git add src/server/admin/billing.ts src/server/admin/billing.test.ts src/app/api/admin/billing/route.ts src/app/api/admin/billing/route.test.ts src/components/admin/billing-table.tsx src/app/admin/billing/page.tsx
git commit -m "feat: show credit package configuration in admin billing"
```

---

## Task 7: Creem checkout/webhook 代码审查测试

**Files:**
- Modify: `src/app/api/billing/checkout/route.test.ts`
- Modify: `src/app/api/billing/checkout/route.ts`
- Modify: `src/app/api/webhooks/creem/route.test.ts`
- Modify: `src/app/api/webhooks/creem/route.ts`
- Modify: `src/lib/providers/creem/webhook.test.ts`
- Modify: `src/lib/providers/creem/webhook.ts`
- Modify: `docs/API_TEST_STATUS.md`

- [ ] **Step 1: 复核 checkout tests**

Run:

```bash
Get-Content -Raw src\app\api\billing\checkout\route.test.ts
Get-Content -Raw src\app\api\billing\checkout\route.ts
```

- [ ] **Step 2: 增加 checkout 安全测试**

在 `src/app/api/billing/checkout/route.test.ts` 覆盖：

```ts
it("rejects arbitrary amount and credits from client input", async () => {
  const response = await POST(
    new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({
        packageCode: "starter",
        amountCents: 1,
        credits: 999999,
      }),
    }),
  );

  expect(response.status).not.toBe(200);
});

it("does not create fake checkout urls when Creem is unavailable", async () => {
  vi.stubEnv("CREEM_API_KEY", "");
  const response = await POST(
    new Request("http://localhost/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ packageCode: "starter" }),
    }),
  );

  expect(response.status).toBe(503);
  const body = await response.json();
  expect(JSON.stringify(body)).not.toContain("checkout.creem");
});
```

按现有 route test session mock 调整。

- [ ] **Step 3: 修正 checkout route**

确保：

- 只读取 `packageCode`。
- 通过 `getCreditPackage(packageCode)` 找配置。
- 前端传 `amountCents` 或 `credits` 直接 400。
- 未配置 Creem key 返回 503。
- 不伪造 checkout URL。

- [ ] **Step 4: 增加 webhook 幂等测试**

在 `src/app/api/webhooks/creem/route.test.ts` 或 `src/lib/providers/creem/webhook.test.ts` 覆盖：

```ts
it("rejects missing webhook signature", async () => {
  const response = await POST(
    new Request("http://localhost/api/webhooks/creem", {
      method: "POST",
      body: JSON.stringify({ id: "evt_1" }),
    }),
  );

  expect(response.status).toBe(401);
});

it("does not grant credits twice for replayed paid webhook events", async () => {
  const first = await handleCreemWebhookEvent({
    eventId: "evt_paid_1",
    externalOrderId: "order_1",
    status: "paid",
    productCode: "starter",
    userId: "user-1",
  });
  const second = await handleCreemWebhookEvent({
    eventId: "evt_paid_1",
    externalOrderId: "order_1",
    status: "paid",
    productCode: "starter",
    userId: "user-1",
  });

  expect(first.grantedCredits).toBe(100);
  expect(second.grantedCredits).toBe(0);
});
```

按现有 webhook service API 调整。

- [ ] **Step 5: 跑测试**

Run:

```bash
npm test -- src/app/api/billing/checkout/route.test.ts src/app/api/webhooks/creem/route.test.ts src/lib/providers/creem/webhook.test.ts
```

Expected:

- 测试通过。

- [ ] **Step 6: 更新文档**

在 `docs/API_TEST_STATUS.md` 增加：

```markdown
### Creem 代码审查状态

- checkout 不接受任意金额：已覆盖
- checkout 未配置 key 不伪造 URL：已覆盖
- webhook 缺签名拒绝：已覆盖
- webhook 重放不重复充值：已覆盖
- 真实 Creem checkout/webhook 验证：pending Creem approval
```

- [ ] **Step 7: 提交**

Run:

```bash
git add src/app/api/billing/checkout/route.ts src/app/api/billing/checkout/route.test.ts src/app/api/webhooks/creem/route.ts src/app/api/webhooks/creem/route.test.ts src/lib/providers/creem/webhook.ts src/lib/providers/creem/webhook.test.ts docs/API_TEST_STATUS.md
git commit -m "test: harden creem checkout and webhook boundaries"
```

---

## Task 8: 用户/API 权限与幂等复核

**Files:**
- Modify: `src/app/api/jobs/[id]/route.test.ts`
- Modify: `src/app/api/jobs/[id]/progress/route.test.ts`
- Modify: `src/app/api/jobs/[id]/download/route.test.ts`
- Modify: `src/app/api/files/signed-url/route.test.ts`
- Modify: `src/app/api/billing/overview/route.test.ts`
- Modify: `src/app/api/internal/post-qa/resolve/route.test.ts`
- Modify as needed: corresponding route files

- [ ] **Step 1: 用户 owner 权限测试**

补齐测试：

```ts
it("rejects reading another user's job", async () => {
  const response = await GET(
    new Request("http://localhost/api/jobs/job-other"),
    { params: Promise.resolve({ id: "job-other" }) },
  );

  expect(response.status).toBe(404);
});
```

同类覆盖：

- job detail。
- progress。
- download。
- file signed URL。
- billing overview。

按现有 route test mock session/store 写法实现。

- [ ] **Step 2: 下载状态测试**

在 `src/app/api/jobs/[id]/download/route.test.ts` 增加：

```ts
it("rejects download before job is deliverable", async () => {
  const response = await GET(
    new Request("http://localhost/api/jobs/job-generating/download"),
    { params: Promise.resolve({ id: "job-generating" }) },
  );

  expect(response.status).toBe(409);
});
```

- [ ] **Step 3: internal API secret 测试**

确认以下测试存在，不存在则补：

- `/api/internal/worker/tick`
- `/api/internal/segments/[id]/submit`
- `/api/internal/segments/[id]/poll`
- `/api/internal/stitch/jobs`
- `/api/internal/stitch/callback`
- `/api/internal/post-qa/resolve`

每个至少覆盖：

```ts
it("rejects requests without internal secret", async () => {
  const response = await POST(new Request("http://localhost/api/internal/..."));
  expect(response.status).toBe(401);
});
```

- [ ] **Step 4: post-QA resolve 幂等测试**

在 `src/app/api/internal/post-qa/resolve/route.test.ts` 或服务层测试里覆盖：

```ts
it("does not capture credits twice when post-qa resolve is replayed", async () => {
  await resolvePostQaResult({ jobId: "job-paid", status: "passed" });
  await resolvePostQaResult({ jobId: "job-paid", status: "passed" });

  expect(store.listLedger().filter((entry) => entry.type === "capture")).toHaveLength(1);
});
```

- [ ] **Step 5: 修正实现**

如测试失败，修正对应 route/service：

- 非 owner 返回 404 或 403，优先 404 防枚举。
- 未 deliverable 下载返回 409。
- internal secret 缺失返回 401。
- post-QA resolve 使用 idempotency key 防重复 capture/release。

- [ ] **Step 6: 验证**

Run:

```bash
npm test -- src/app/api/jobs/[id]/route.test.ts src/app/api/jobs/[id]/progress/route.test.ts src/app/api/jobs/[id]/download/route.test.ts src/app/api/files/signed-url/route.test.ts src/app/api/billing/overview/route.test.ts src/app/api/internal/post-qa/resolve/route.test.ts
npm run typecheck
```

Expected:

- 测试通过。
- typecheck 通过。

- [ ] **Step 7: 提交**

Run:

```bash
git add src/app/api/jobs src/app/api/files src/app/api/billing src/app/api/internal
git commit -m "test: harden user api ownership and internal idempotency"
```

---

## Task 9: Health check 和文档更新

**Files:**
- Modify: `src/server/ops/health.ts`
- Modify: `src/server/ops/health.test.ts`
- Modify: `src/app/api/health/route.test.ts`
- Modify: `docs/API_FLOW.md`
- Modify: `docs/API_TEST_STATUS.md`
- Check: `.env.example`

- [ ] **Step 1: 增加 health 测试**

在 `src/server/ops/health.test.ts` 覆盖：

```ts
it("reports creem payment pending separately from moderation readiness", () => {
  const health = buildHealthSnapshot({
    env: {
      DATABASE_URL: "postgres://ok",
      BETTER_AUTH_SECRET: "secret",
      CLOUDFLARE_R2_BUCKET: "bucket",
      INTERNAL_WORKER_SECRET: "secret",
      CREEM_API_KEY: "",
      CREEM_MODERATION_API_KEY: "moderation-key",
    },
  });

  expect(health.modules.creemPayment.status).toBe("pending");
  expect(health.modules.moderation.configured).toBe(true);
});

it("marks app not ready when moderation is missing", () => {
  const health = buildHealthSnapshot({
    env: {
      DATABASE_URL: "postgres://ok",
      BETTER_AUTH_SECRET: "secret",
      CLOUDFLARE_R2_BUCKET: "bucket",
      INTERNAL_WORKER_SECRET: "secret",
      CREEM_MODERATION_API_KEY: "",
    },
  });

  expect(health.ready).toBe(false);
  expect(health.modules.moderation.configured).toBe(false);
});
```

按现有 health function 名称调整。

- [ ] **Step 2: 修改 health 实现**

确保 health 区分：

- `billing`
- `creemPayment`
- `moderation`

规则：

- Creem payment key 缺失可显示 `pending`。
- Moderation key 缺失必须让生成链路不可 ready。
- response 中列出缺失 env 名称，但不要输出 env value。

- [ ] **Step 3: 更新 `.env.example`**

确认存在：

```env
PROVIDER_KEY_ENCRYPTION_SECRET=
CREEM_API_KEY=
CREEM_WEBHOOK_SECRET=
CREEM_MODERATION_API_KEY=
```

如果项目实际只使用 `CREEM_API_KEY` 兼作 moderation，文档中要明确。

- [ ] **Step 4: 更新 `docs/API_FLOW.md`**

修正过时描述：

- 如果管理台 UI 已存在，不要继续写“管理台 UI 还没做”。
- 增加 audit logs、provider key create/rotate、credit packages 可见化。
- 保留 Creem 真实支付 pending 说明。

- [ ] **Step 5: 更新 `docs/API_TEST_STATUS.md`**

记录本轮：

- health check 结果。
- Creem payment pending。
- moderation 是否 configured。
- provider key encryption secret 是否配置。

- [ ] **Step 6: 验证**

Run:

```bash
npm test -- src/server/ops/health.test.ts src/app/api/health/route.test.ts
npm run typecheck
```

Expected:

- 测试通过。
- typecheck 通过。

- [ ] **Step 7: 提交**

Run:

```bash
git add src/server/ops/health.ts src/server/ops/health.test.ts src/app/api/health/route.test.ts .env.example docs/API_FLOW.md docs/API_TEST_STATUS.md
git commit -m "docs: clarify health readiness and api flow"
```

---

## Task 10: 真实付费 smoke 和最终验收记录

**Files:**
- Modify: `docs/API_TEST_STATUS.md`
- Check: `scripts/backend-smoke.mjs`
- Check: `scripts/stitch-smoke.mjs`
- Check: `scripts/job-debug.mjs`

- [ ] **Step 1: 跑全量本地验证**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected:

- 全部通过。

- [ ] **Step 2: 准备付费任务**

用后台补点或测试钱包准备 `credit_cost > 0` 任务。

要求：

- 不通过 Creem mock 支付造余额。
- 可以使用 admin credit adjustment。
- 任务必须是测试任务或 staging 用户任务。
- 记录 job id。

- [ ] **Step 3: 跑 stitch smoke**

Run:

```bash
npm run smoke:stitch
```

Expected:

- Cloud Run health 成功。
- final mp4 存在。
- QA frames 存在。

- [ ] **Step 4: 跑付费 full smoke**

Run:

```bash
npm run smoke:backend -- --job-id <credit_cost_gt_0_job_id>
```

Expected:

- `video_jobs.status = deliverable`。
- `credit_cost > 0`。
- `credit_ledger.reserve` 存在。
- `credit_ledger.capture` 存在。
- final video R2 key 存在。
- QA frames 存在。

- [ ] **Step 5: 如失败，运行 job debug**

Run:

```bash
node scripts/job-debug.mjs <credit_cost_gt_0_job_id>
```

Expected:

- 输出 JOB、EVENTS、STORYBOARDS、SEGMENTS、STITCH、POSTQA、MODERATION、PROVIDERLOGS。
- 根据卡点修复，不要手动改数据库伪造通过。

- [ ] **Step 6: 记录最终验收**

更新 `docs/API_TEST_STATUS.md`：

```markdown
## Backend/API Hardening 最终验收

- 日期：2026-06-11
- 命令：
  - `npm run typecheck`: pass/fail
  - `npm test`: pass/fail
  - `npm run build`: pass/fail
  - `npm run smoke:stitch`: pass/fail
  - `npm run smoke:backend -- --job-id ...`: pass/fail
- 付费 job id：
- duration：
- aspect ratio：
- credit_cost：
- final status：
- final video key：
- QA frame keys：
- credit ledger：
  - reserve：
  - capture：
  - release/refund：
- Creem 真实支付：pending Creem approval
- Creem 代码审查：pass/fail
- Provider key create/rotate：pass/fail
- Audit logs viewer：pass/fail
- 已知遗留风险：
```

- [ ] **Step 7: 提交最终记录**

Run:

```bash
git add docs/API_TEST_STATUS.md
git commit -m "docs: record backend api hardening verification"
```

---

## 最终 Review Checklist

交付前逐项确认：

- [ ] `npm run typecheck` 通过。
- [ ] `npm test` 通过。
- [ ] `npm run build` 通过。
- [ ] `npm run smoke:stitch` 成功或记录明确阻塞。
- [ ] 至少一个 `credit_cost > 0` job full smoke 成功或记录明确阻塞。
- [ ] 付费任务存在 `reserve` 和 `capture`。
- [ ] 失败补偿路径有测试覆盖。
- [ ] Post-QA 未通过前不能下载。
- [ ] audit logs 可在后台查询。
- [ ] Provider key 新增/轮换不返回明文。
- [ ] operator 不能新增/轮换 provider key。
- [ ] Billing 后台展示点数包配置。
- [ ] checkout 不接受任意金额。
- [ ] webhook 重放不重复充值。
- [ ] Creem 真实支付验证标记为 pending Creem approval。
- [ ] `docs/API_FLOW.md` 没有明显过时描述。
- [ ] `docs/API_TEST_STATUS.md` 有真实验收记录。

如果任何一项失败，不要说“基本完成”。要么修复，要么把阻塞原因写进 `docs/API_TEST_STATUS.md`。
