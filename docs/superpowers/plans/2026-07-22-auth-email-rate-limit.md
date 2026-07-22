# Auth Email Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留 Email OTP 和 Magic Link 两个登录入口，同时阻止误连点、并发重复发信和跨 Vercel 实例的邮箱/IP 滥用。

**Architecture:** 前端使用同步 `useRef` 锁、共享 pending 状态和 60 秒倒计时改善交互，但服务端才是安全边界。服务端复用 `auth_email_events`，在调用 Resend 前通过 PostgreSQL advisory transaction lock 原子写入 `pending` 预占记录，OTP 与 Magic Link 共享邮箱/IP 配额；发信完成后更新为 `sent` 或 `failed`。better-auth 自带限频显式开启，作为进程内第一层突发保护，不承担最终防滥用职责。

**Tech Stack:** Next.js 16 App Router、React 19、better-auth 1.6、Drizzle ORM、PostgreSQL/Neon、Resend、Vitest、Testing Library。

**Execution Note:** 项目级 `AGENTS.md` 默认最多使用一个实现 Subagent，因此执行时优先选择 `superpowers:executing-plans` 在当前任务内分批完成；若使用 Subagent，只分配一个实现 Subagent，不按 Task 重复派发。

---

## 交付边界

- 保留“发送邮箱验证码”和“发送 Magic Link”两个按钮。
- 两个入口共享同一邮箱冷却和小时配额，不能通过切换入口绕过。
- 邮箱维度：60 秒内最多 1 次，60 分钟内最多 5 次。
- IP 维度：10 分钟内最多 10 次，OTP 与 Magic Link 合并计算。
- `pending`、`sent`、`failed` 都计入配额，避免通过并发请求或故意制造 Resend 失败绕过。
- 本 Goal 不引入 Redis/Upstash，不做验证码校验失败次数限制，不调整 Google OAuth。
- 本 Goal 不删除任何邮箱登录方式。

## 文件结构

- Modify: `src/lib/db/schema/auth.ts`：增加 `pending` 邮件事件状态和限频查询索引。
- Create: `drizzle/0017_auth_email_rate_limit.sql`：向已有枚举增加状态并创建索引。
- Create: `src/server/auth/email-rate-limit.ts`：限频策略、请求元数据提取、原子预占和事件状态更新。
- Create: `src/server/auth/email-rate-limit.test.ts`：策略、共享配额、并发和发送结果测试。
- Modify: `src/lib/auth/config.ts`：接入持久化限频，显式开启 better-auth 突发限频。
- Modify: `src/lib/auth/config.test.ts`：验证配置、429 映射及请求上下文传递。
- Modify: `src/app/(auth)/login/login-form.tsx`：同步防连点、共享 pending、倒计时和错误反馈。
- Modify: `src/app/(auth)/login/login-form.test.tsx`：覆盖双击、跨按钮、429、成功和异常。
- Modify: `docs/DEVELOPMENT_SPEC.md`：记录具体限频规则与验收状态。
- Modify: `docs/superpowers/specs/2026-06-06-auth-design.md`：移除“限频延期”描述，记录最终架构。

---

### Task 1: 扩展邮件事件数据模型

**Files:**
- Modify: `src/lib/db/schema/auth.ts:12-86`
- Modify: `src/lib/db/schema/auth.test.ts`
- Create: `drizzle/0017_auth_email_rate_limit.sql`

- [ ] **Step 1: 先写失败的 schema 测试**

在 `src/lib/db/schema/auth.test.ts` 增加：

```ts
import {
  authEmailEvents,
  authEmailEventStatusValues,
  users,
  verifications,
} from "./auth";

it("supports reserving an auth email before provider delivery", () => {
  expect(authEmailEventStatusValues).toEqual(["pending", "sent", "failed"]);
  expect(authEmailEvents.status.hasDefault).toBe(false);
});
```

- [ ] **Step 2: 运行测试并确认先失败**

Run:

```powershell
pnpm vitest run src/lib/db/schema/auth.test.ts --reporter=dot
```

Expected: FAIL，`authEmailEventStatusValues` 尚不包含 `pending`。

- [ ] **Step 3: 修改 Drizzle schema**

将 `src/lib/db/schema/auth.ts` 的相关定义改为：

```ts
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const authEmailEventStatusValues = [
  "pending",
  "sent",
  "failed",
] as const;

export const authEmailEvents = pgTable(
  "auth_email_events",
  {
    ...id,
    userId: text("user_id"),
    email: text("email").notNull(),
    type: authEmailEventTypeEnum("type").notNull(),
    status: authEmailEventStatusEnum("status").notNull(),
    provider: text("provider").notNull().default("resend"),
    providerMessageId: text("provider_message_id"),
    errorMessage: text("error_message"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("auth_email_events_email_created_at_idx").on(
      table.email,
      table.createdAt,
    ),
    index("auth_email_events_ip_created_at_idx").on(
      table.ipAddress,
      table.createdAt,
    ),
  ],
);
```

- [ ] **Step 4: 新增 forward migration**

创建 `drizzle/0017_auth_email_rate_limit.sql`：

```sql
ALTER TYPE "public"."auth_email_event_status" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'sent';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_events_email_created_at_idx" ON "auth_email_events" USING btree ("email", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_email_events_ip_created_at_idx" ON "auth_email_events" USING btree ("ip_address", "created_at");
```

同时在 `drizzle/meta/_journal.json` 的 `entries` 末尾追加以下 journal entry。不要改写或删除已有 migration。

```json
{
  "idx": 17,
  "version": "7",
  "when": 1784649600000,
  "tag": "0017_auth_email_rate_limit",
  "breakpoints": true
}
```

- [ ] **Step 5: 运行 schema focused test**

Run:

```powershell
pnpm vitest run src/lib/db/schema/auth.test.ts src/lib/db/schema/index.test.ts --reporter=dot
```

Expected: PASS。

- [ ] **Step 6: 提交数据模型变更**

```powershell
git add src/lib/db/schema/auth.ts src/lib/db/schema/auth.test.ts drizzle/0017_auth_email_rate_limit.sql drizzle/meta/_journal.json
git commit -m "feat: add auth email reservation state"
```

---

### Task 2: 实现原子邮箱/IP限频

**Files:**
- Create: `src/server/auth/email-rate-limit.ts`
- Create: `src/server/auth/email-rate-limit.test.ts`

- [ ] **Step 1: 写策略和请求元数据失败测试**

`src/server/auth/email-rate-limit.test.ts` 先覆盖以下行为：

```ts
import { describe, expect, it } from "vitest";

import {
  evaluateAuthEmailRateLimit,
  getAuthEmailRequestMeta,
  normalizeAuthEmail,
} from "./email-rate-limit";

describe("auth email rate limit policy", () => {
  const now = new Date("2026-07-22T00:10:00.000Z");

  it("normalizes email before sharing OTP and Magic Link quotas", () => {
    expect(normalizeAuthEmail(" Seller@Example.COM ")).toBe(
      "seller@example.com",
    );
  });

  it("blocks the same email for 60 seconds regardless of delivery type", () => {
    const result = evaluateAuthEmailRateLimit({
      email: "seller@example.com",
      ipAddress: "203.0.113.10",
      now,
      attempts: [
        {
          email: "seller@example.com",
          ipAddress: "203.0.113.10",
          createdAt: new Date("2026-07-22T00:09:30.000Z"),
        },
      ],
    });

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 30 });
  });

  it("blocks the sixth email attempt within one hour", () => {
    const attempts = Array.from({ length: 5 }, (_, index) => ({
      email: "seller@example.com",
      ipAddress: `203.0.113.${index + 1}`,
      createdAt: new Date(`2026-07-22T00:0${index}:00.000Z`),
    }));

    expect(
      evaluateAuthEmailRateLimit({
        email: "seller@example.com",
        ipAddress: "203.0.113.99",
        now,
        attempts,
      }).allowed,
    ).toBe(false);
  });

  it("blocks the eleventh IP attempt within ten minutes", () => {
    const attempts = Array.from({ length: 10 }, (_, index) => ({
      email: `seller-${index}@example.com`,
      ipAddress: "203.0.113.10",
      createdAt: new Date(`2026-07-22T00:0${index}:30.000Z`),
    }));

    expect(
      evaluateAuthEmailRateLimit({
        email: "next@example.com",
        ipAddress: "203.0.113.10",
        now,
        attempts,
      }).allowed,
    ).toBe(false);
  });

  it("uses the first forwarded IP and captures the user agent", () => {
    const request = new Request("https://app.example/api/auth", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "user-agent": "Vitest Browser",
      },
    });

    expect(getAuthEmailRequestMeta(request)).toEqual({
      ipAddress: "203.0.113.10",
      userAgent: "Vitest Browser",
    });
  });
});
```

- [ ] **Step 2: 运行测试并确认先失败**

```powershell
pnpm vitest run src/server/auth/email-rate-limit.test.ts --reporter=dot
```

Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 实现纯策略和错误类型**

在 `src/server/auth/email-rate-limit.ts` 定义：

```ts
export const AUTH_EMAIL_RATE_LIMIT = {
  emailCooldownSeconds: 60,
  emailHourlyMax: 5,
  ipWindowSeconds: 10 * 60,
  ipWindowMax: 10,
} as const;

export interface AuthEmailAttemptSnapshot {
  email: string;
  ipAddress: string | null;
  createdAt: Date;
}

export type AuthEmailRateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export class AuthEmailRateLimitError extends Error {
  readonly code = "AUTH_EMAIL_RATE_LIMITED";

  constructor(readonly retryAfterSeconds: number) {
    super("auth_email_rate_limited");
  }
}

export function normalizeAuthEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getAuthEmailRequestMeta(request?: Request) {
  const forwardedFor = request?.headers.get("x-forwarded-for");
  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || null,
    userAgent: request?.headers.get("user-agent")?.slice(0, 500) || null,
  };
}

function retryAfter(createdAt: Date, windowSeconds: number, now: Date) {
  return Math.max(
    1,
    Math.ceil(
      (createdAt.getTime() + windowSeconds * 1000 - now.getTime()) / 1000,
    ),
  );
}

export function evaluateAuthEmailRateLimit(input: {
  email: string;
  ipAddress: string | null;
  now: Date;
  attempts: AuthEmailAttemptSnapshot[];
}): AuthEmailRateLimitDecision {
  const emailAttempts = input.attempts
    .filter((attempt) => attempt.email === input.email)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestEmailAttempt = emailAttempts[0];

  if (
    latestEmailAttempt &&
    latestEmailAttempt.createdAt.getTime() >
      input.now.getTime() - AUTH_EMAIL_RATE_LIMIT.emailCooldownSeconds * 1000
  ) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfter(
        latestEmailAttempt.createdAt,
        AUTH_EMAIL_RATE_LIMIT.emailCooldownSeconds,
        input.now,
      ),
    };
  }

  const hourlyEmailAttempts = emailAttempts.filter(
    (attempt) =>
      attempt.createdAt.getTime() > input.now.getTime() - 60 * 60 * 1000,
  );
  if (hourlyEmailAttempts.length >= AUTH_EMAIL_RATE_LIMIT.emailHourlyMax) {
    const thresholdAttempt =
      hourlyEmailAttempts[AUTH_EMAIL_RATE_LIMIT.emailHourlyMax - 1];
    return {
      allowed: false,
      retryAfterSeconds: retryAfter(thresholdAttempt.createdAt, 60 * 60, input.now),
    };
  }

  if (input.ipAddress) {
    const ipAttempts = input.attempts
      .filter(
        (attempt) =>
          attempt.ipAddress === input.ipAddress &&
          attempt.createdAt.getTime() >
            input.now.getTime() - AUTH_EMAIL_RATE_LIMIT.ipWindowSeconds * 1000,
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (ipAttempts.length >= AUTH_EMAIL_RATE_LIMIT.ipWindowMax) {
      const thresholdAttempt =
        ipAttempts[AUTH_EMAIL_RATE_LIMIT.ipWindowMax - 1];
      return {
        allowed: false,
        retryAfterSeconds: retryAfter(
          thresholdAttempt.createdAt,
          AUTH_EMAIL_RATE_LIMIT.ipWindowSeconds,
          input.now,
        ),
      };
    }
  }

  return { allowed: true };
}
```

- [ ] **Step 4: 写原子预占和发信状态失败测试**

先把 Vitest import 补充为 `import { describe, expect, it, vi } from "vitest";`，再继续增加一个 `AuthEmailEventStore` fake，要求：

```ts
it("allows only one provider call for concurrent OTP and Magic Link attempts", async () => {
  const store = createInMemoryAuthEmailEventStore();
  const send = vi.fn(async () => ({
    provider: "resend" as const,
    providerMessageId: "email-1",
  }));

  const results = await Promise.allSettled([
    deliverRateLimitedAuthEmail({
      store,
      email: "seller@example.com",
      type: "sign_in_otp",
      content: { subject: "otp", html: "otp", text: "otp" },
      request: new Request("https://app.example", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      send,
    }),
    deliverRateLimitedAuthEmail({
      store,
      email: "seller@example.com",
      type: "magic_link",
      content: { subject: "magic", html: "magic", text: "magic" },
      request: new Request("https://app.example", {
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
      send,
    }),
  ]);

  expect(send).toHaveBeenCalledTimes(1);
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
});

it("records provider failures and still counts the reservation", async () => {
  const store = createInMemoryAuthEmailEventStore();
  const send = vi.fn().mockRejectedValue(new Error("resend unavailable"));

  await expect(
    deliverRateLimitedAuthEmail({
      store,
      email: "seller@example.com",
      type: "sign_in_otp",
      content: { subject: "otp", html: "otp", text: "otp" },
      request: new Request("https://app.example"),
      send,
    }),
  ).rejects.toThrow("resend unavailable");

  expect(store.listEvents()[0]).toMatchObject({
    status: "failed",
    errorMessage: "resend unavailable",
  });
});
```

- [ ] **Step 5: 实现 Store 接口、内存 fake 和 Drizzle 原子预占**

在 `email-rate-limit.ts` 增加明确接口：

```ts
export interface AuthEmailEventStore {
  reserve(input: {
    email: string;
    type: "sign_in_otp" | "magic_link" | "email_verification";
    ipAddress: string | null;
    userAgent: string | null;
    now: Date;
  }): Promise<{ id: string }>;
  markSent(input: { id: string; providerMessageId: string | null }): Promise<void>;
  markFailed(input: { id: string; errorMessage: string }): Promise<void>;
}
```

`createDrizzleAuthEmailEventStore()` 的 `reserve()` 必须在同一事务中完成以下操作：

```ts
import { randomUUID } from "node:crypto";
import { and, eq, gte, or, sql } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { authEmailEvents } from "@/lib/db/schema";
import {
  sendAuthEmail,
  type AuthEmailContent,
} from "@/lib/auth/email";

type DbClient = ReturnType<typeof getDb>;
```

创建 `createDrizzleAuthEmailEventStore(db: DbClient = getDb()): AuthEmailEventStore`，返回对象中的 `reserve()` 使用以下完整 transaction body，`markSent()` 与 `markFailed()` 紧随其后：

```ts
return db.transaction(async (tx) => {
  const lockKeys = [
    `auth-email:email:${input.email}`,
    ...(input.ipAddress ? [`auth-email:ip:${input.ipAddress}`] : []),
  ].sort();

  for (const key of lockKeys) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${key}))`,
    );
  }

  const since = new Date(input.now.getTime() - 60 * 60 * 1000);
  const matchEmailOrIp = input.ipAddress
    ? or(
        eq(authEmailEvents.email, input.email),
        eq(authEmailEvents.ipAddress, input.ipAddress),
      )
    : eq(authEmailEvents.email, input.email);
  const attempts = await tx
    .select({
      email: authEmailEvents.email,
      ipAddress: authEmailEvents.ipAddress,
      createdAt: authEmailEvents.createdAt,
    })
    .from(authEmailEvents)
    .where(and(gte(authEmailEvents.createdAt, since), matchEmailOrIp));

  const decision = evaluateAuthEmailRateLimit({
    email: input.email,
    ipAddress: input.ipAddress,
    now: input.now,
    attempts,
  });
  if (!decision.allowed) {
    throw new AuthEmailRateLimitError(decision.retryAfterSeconds);
  }

  const [reservation] = await tx
    .insert(authEmailEvents)
    .values({
      email: input.email,
      type: input.type,
      status: "pending",
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
    .returning({ id: authEmailEvents.id });
  if (!reservation) {
    throw new Error("auth_email_reservation_failed");
  }
  return reservation;
});
```

`markSent()` 和 `markFailed()` 使用以下实现：

```ts
async markSent({ id, providerMessageId }) {
  await db
    .update(authEmailEvents)
    .set({ status: "sent", providerMessageId, errorMessage: null })
    .where(eq(authEmailEvents.id, id));
},
async markFailed({ id, errorMessage }) {
  await db
    .update(authEmailEvents)
    .set({ status: "failed", errorMessage: errorMessage.slice(0, 1000) })
    .where(eq(authEmailEvents.id, id));
},
```

`createInMemoryAuthEmailEventStore()` 用 Promise queue 串行化 `reserve()`，模拟数据库 advisory lock；这不是生产实现，只服务单元测试：

```ts
export function createInMemoryAuthEmailEventStore() {
  const events: Array<{
    id: string;
    email: string;
    type: "sign_in_otp" | "magic_link" | "email_verification";
    status: "pending" | "sent" | "failed";
    ipAddress: string | null;
    userAgent: string | null;
    providerMessageId: string | null;
    errorMessage: string | null;
    createdAt: Date;
  }> = [];
  let queue = Promise.resolve();

  async function serialized<T>(operation: () => T | Promise<T>) {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  return {
    async reserve(input: {
      email: string;
      type: "sign_in_otp" | "magic_link" | "email_verification";
      ipAddress: string | null;
      userAgent: string | null;
      now: Date;
    }) {
      return serialized(() => {
        const decision = evaluateAuthEmailRateLimit({
          email: input.email,
          ipAddress: input.ipAddress,
          now: input.now,
          attempts: events,
        });
        if (!decision.allowed) {
          throw new AuthEmailRateLimitError(decision.retryAfterSeconds);
        }
        const event = {
          id: randomUUID(),
          ...input,
          status: "pending" as const,
          providerMessageId: null,
          errorMessage: null,
          createdAt: input.now,
        };
        events.push(event);
        return { id: event.id };
      });
    },
    async markSent(input: { id: string; providerMessageId: string | null }) {
      const event = events.find((candidate) => candidate.id === input.id);
      if (!event) throw new Error("auth_email_event_not_found");
      event.status = "sent";
      event.providerMessageId = input.providerMessageId;
    },
    async markFailed(input: { id: string; errorMessage: string }) {
      const event = events.find((candidate) => candidate.id === input.id);
      if (!event) throw new Error("auth_email_event_not_found");
      event.status = "failed";
      event.errorMessage = input.errorMessage;
    },
    listEvents: () => events.map((event) => ({ ...event })),
  } satisfies AuthEmailEventStore & {
    listEvents(): Array<(typeof events)[number]>;
  };
}
```

- [ ] **Step 6: 实现限频发信编排**

```ts
export async function deliverRateLimitedAuthEmail(input: {
  store?: AuthEmailEventStore;
  email: string;
  type: "sign_in_otp" | "magic_link" | "email_verification";
  content: AuthEmailContent;
  request?: Request;
  now?: Date;
  send?: typeof sendAuthEmail;
}) {
  const store = input.store ?? createDrizzleAuthEmailEventStore();
  const send = input.send ?? sendAuthEmail;
  const email = normalizeAuthEmail(input.email);
  const meta = getAuthEmailRequestMeta(input.request);
  const reservation = await store.reserve({
    email,
    type: input.type,
    ...meta,
    now: input.now ?? new Date(),
  });

  try {
    const result = await send({ to: email, content: input.content });
    try {
      await store.markSent({
        id: reservation.id,
        providerMessageId: result.providerMessageId,
      });
    } catch (recordingError) {
      console.error("auth_email_success_recording_failed", {
        reservationId: reservation.id,
        recordingError,
      });
    }
    return result;
  } catch (error) {
    try {
      await store.markFailed({
        id: reservation.id,
        errorMessage: error instanceof Error ? error.message : "Unknown email error",
      });
    } catch (recordingError) {
      console.error("auth_email_failure_recording_failed", {
        reservationId: reservation.id,
        recordingError,
      });
    }
    throw error;
  }
}
```

发送成功后的 `markSent` 失败也需要捕获并记录日志，然后仍返回发送成功，避免邮件已经送达但客户端重试导致重复发送；未更新的 `pending` 记录继续计入限频。

- [ ] **Step 7: 运行 focused tests**

```powershell
pnpm vitest run src/server/auth/email-rate-limit.test.ts --reporter=dot
```

Expected: PASS，包括并发场景中 Resend mock 只被调用一次。

- [ ] **Step 8: 提交限频服务**

```powershell
git add src/server/auth/email-rate-limit.ts src/server/auth/email-rate-limit.test.ts
git commit -m "feat: rate limit authentication emails"
```

---

### Task 3: 接入 better-auth 并返回可识别的 429

**Files:**
- Modify: `src/lib/auth/config.ts:1-88`
- Modify: `src/lib/auth/config.test.ts`

- [ ] **Step 1: 写失败的配置测试**

扩展 mocks，验证 `betterAuth()` 收到：

```ts
expect(mocks.betterAuth).toHaveBeenCalledWith(
  expect.objectContaining({
    rateLimit: expect.objectContaining({ enabled: true }),
  }),
);
expect(mocks.emailOTP).toHaveBeenCalledWith(
  expect.objectContaining({
    rateLimit: { window: 60, max: 3 },
  }),
);
expect(mocks.magicLink).toHaveBeenCalledWith(
  expect.objectContaining({
    rateLimit: { window: 60, max: 3 },
  }),
);
```

另写测试直接调用两个 plugin callback，断言都把 `ctx.request` 传给 `deliverRateLimitedAuthEmail`，并将 `AuthEmailRateLimitError(42)` 转为：

```ts
expect(error).toMatchObject({
  status: "TOO_MANY_REQUESTS",
  body: {
    code: "AUTH_EMAIL_RATE_LIMITED",
    retryAfterSeconds: 42,
  },
  headers: { "Retry-After": "42" },
});
```

- [ ] **Step 2: 运行并确认失败**

```powershell
pnpm vitest run src/lib/auth/config.test.ts --reporter=dot
```

Expected: FAIL，尚未接入显式限频和持久化 delivery。

- [ ] **Step 3: 修改认证配置**

在 `src/lib/auth/config.ts`：

```ts
import { APIError } from "better-auth/api";
import {
  AuthEmailRateLimitError,
  deliverRateLimitedAuthEmail,
} from "@/server/auth/email-rate-limit";

async function deliverOrThrowApiError(
  input: Parameters<typeof deliverRateLimitedAuthEmail>[0],
) {
  try {
    return await deliverRateLimitedAuthEmail(input);
  } catch (error) {
    if (error instanceof AuthEmailRateLimitError) {
      throw new APIError(
        "TOO_MANY_REQUESTS",
        {
          code: error.code,
          message: "发送过于频繁，请稍后重试。",
          retryAfterSeconds: error.retryAfterSeconds,
        },
        { "Retry-After": String(error.retryAfterSeconds) },
      );
    }
    throw error;
  }
}
```

在 `betterAuth()` 顶层显式加入：

```ts
rateLimit: {
  enabled: true,
},
```

在两个插件中都加入 `rateLimit: { window: 60, max: 3 }`，并修改 callback：

```ts
async sendVerificationOTP({ email, otp, type }, ctx) {
  const content = buildOtpEmail({
    email,
    otp,
    type: type as OtpEmailType,
  });
  await deliverOrThrowApiError({
    email,
    type: type === "email-verification" ? "email_verification" : "sign_in_otp",
    content,
    request: ctx.request,
  });
}

async sendMagicLink({ email, url }, ctx) {
  const content = buildMagicLinkEmail({ email, url });
  await deliverOrThrowApiError({
    email,
    type: "magic_link",
    content,
    request: ctx.request,
  });
}
```

不要移除 `resendStrategy: "reuse"`；它继续避免重复请求产生不同 OTP，但不能替代限频。

- [ ] **Step 4: 运行认证 focused tests**

```powershell
pnpm vitest run src/lib/auth/config.test.ts 'src/app/api/auth/[...all]/route.test.ts' --reporter=dot
```

Expected: PASS。

- [ ] **Step 5: 提交 better-auth 集成**

```powershell
git add src/lib/auth/config.ts src/lib/auth/config.test.ts
git commit -m "fix: enforce shared auth email limits"
```

---

### Task 4: 修复前端连点和错误反馈

**Files:**
- Modify: `src/app/(auth)/login/login-form.tsx:1-87`
- Modify: `src/app/(auth)/login/login-form.test.tsx`

- [ ] **Step 1: 写快速双击失败测试**

使用 deferred Promise 保持第一个请求 pending，在同一个 act 周期点击两次：

```ts
it("submits only one OTP request for rapid repeated clicks", async () => {
  let resolveRequest!: (value: unknown) => void;
  mocks.sendVerificationOtp.mockReturnValue(
    new Promise((resolve) => {
      resolveRequest = resolve;
    }),
  );
  render(<LoginForm callbackURL="/workspace" />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "seller@example.com" },
  });

  const otpButton = screen.getByRole("button", { name: "发送邮箱验证码" });
  fireEvent.click(otpButton);
  fireEvent.click(otpButton);

  expect(mocks.sendVerificationOtp).toHaveBeenCalledTimes(1);
  expect(otpButton).toBeDisabled();
  expect(screen.getByRole("button", { name: "发送 Magic Link" })).toBeDisabled();

  resolveRequest({ data: { success: true }, error: null });
  await waitFor(() => expect(screen.getByText("验证码已发送，请检查邮箱。")).toBeInTheDocument());
});
```

- [ ] **Step 2: 写共享冷却和错误提示失败测试**

增加三项：

```ts
it("shares the cooldown between OTP and Magic Link", async () => {
  vi.useFakeTimers();
  mocks.sendVerificationOtp.mockResolvedValue({
    data: { success: true },
    error: null,
  });
  render(<LoginForm callbackURL="/workspace" />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "seller@example.com" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));
  });
  expect(mocks.magicLinkSignIn).not.toHaveBeenCalled();
  expect(screen.getAllByText(/60 秒后可重发/)).toHaveLength(2);
  vi.useRealTimers();
});

it("shows rate limit feedback instead of a false success", async () => {
  mocks.magicLinkSignIn.mockResolvedValue({
    data: null,
    error: { status: 429, retryAfterSeconds: 42 },
  });
  render(<LoginForm callbackURL="/workspace" />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "seller@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送 Magic Link" }));
  expect(
    await screen.findByText("发送过于频繁，请在 42 秒后重试。"),
  ).toBeInTheDocument();
  expect(screen.queryByText("登录链接已发送，请检查邮箱。")).not.toBeInTheDocument();
});

it("shows a generic error when the request throws", async () => {
  mocks.sendVerificationOtp.mockRejectedValue(new Error("network unavailable"));
  render(<LoginForm callbackURL="/workspace" />);
  fireEvent.change(screen.getByLabelText("邮箱"), {
    target: { value: "seller@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "发送邮箱验证码" }));
  expect(
    await screen.findByText("发送失败，请稍后重试。"),
  ).toBeInTheDocument();
});
```

测试文件的 Testing Library import 同步增加 `act`：

```ts
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
```

现有 `afterEach` 同时恢复真实计时器，避免某个 fake-timer 断言失败后污染后续用例：

```ts
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
```

- [ ] **Step 3: 运行测试并确认失败**

```powershell
pnpm vitest run 'src/app/(auth)/login/login-form.test.tsx' --reporter=dot
```

Expected: FAIL，当前实现会重复调用且无错误处理。

- [ ] **Step 4: 实现同步锁、pending 和冷却状态**

`login-form.tsx` 的核心状态和 helper：

```tsx
import { useEffect, useRef, useState } from "react";

type EmailAction = "otp" | "magic-link";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const [pendingAction, setPendingAction] = useState<EmailAction | null>(null);
const [cooldownSeconds, setCooldownSeconds] = useState(0);
const emailRequestLock = useRef(false);
const cooldownUntil = useRef(0);

useEffect(() => {
  if (cooldownSeconds <= 0) return;
  const timeout = window.setTimeout(() => {
    setCooldownSeconds((current) => Math.max(0, current - 1));
  }, 1000);
  return () => window.clearTimeout(timeout);
}, [cooldownSeconds]);

const normalizedEmail = email.trim().toLowerCase();
const emailActionsDisabled =
  !EMAIL_PATTERN.test(normalizedEmail) ||
  pendingAction !== null ||
  cooldownSeconds > 0;

function startCooldown(seconds: number) {
  cooldownUntil.current = Date.now() + seconds * 1000;
  setCooldownSeconds(seconds);
}

async function runEmailAction(
  action: EmailAction,
  request: () => Promise<{ error?: { status?: number; retryAfterSeconds?: number } | null }>,
  successMessage: string,
) {
  if (emailRequestLock.current || Date.now() < cooldownUntil.current) return;
  emailRequestLock.current = true;
  setPendingAction(action);
  setMessage(null);

  try {
    const result = await request();
    if (result.error) {
      if (result.error.status === 429) {
        const retryAfter = Math.max(1, result.error.retryAfterSeconds ?? 60);
        startCooldown(retryAfter);
        setMessage(`发送过于频繁，请在 ${retryAfter} 秒后重试。`);
      } else {
        setMessage("发送失败，请稍后重试。");
      }
      return;
    }
    startCooldown(60);
    setMessage(successMessage);
  } catch {
    setMessage("发送失败，请稍后重试。");
  } finally {
    emailRequestLock.current = false;
    setPendingAction(null);
  }
}
```

两个发送函数统一调用 helper，必须使用 `normalizedEmail`：

```tsx
function sendOtp() {
  return runEmailAction(
    "otp",
    () =>
      authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      }),
    "验证码已发送，请检查邮箱。",
  );
}

function sendMagicLink() {
  return runEmailAction(
    "magic-link",
    () => authClient.signIn.magicLink({ email: normalizedEmail, callbackURL }),
    "登录链接已发送，请检查邮箱。",
  );
}
```

两个按钮都使用 `disabled={emailActionsDisabled}`。只有当前 pending action 显示“发送中...”，另一个按钮保留原文但保持 disabled；冷却时分别显示“验证码 N 秒后可重发”和“Magic Link N 秒后可重发”。邮箱输入框在 `pendingAction !== null` 时禁用，防止请求途中更换地址；冷却期间允许编辑邮箱，但两个发送按钮继续共享倒计时。消息容器增加 `aria-live="polite"`，disabled 样式增加明确的 `disabled:cursor-not-allowed disabled:opacity-60`。

- [ ] **Step 5: 运行登录表单 focused tests**

```powershell
pnpm vitest run 'src/app/(auth)/login/login-form.test.tsx' 'src/app/(auth)/login/page.test.tsx' --reporter=dot
```

Expected: PASS；快速点击只调用一次，两个入口仍然存在。

- [ ] **Step 6: 提交前端修复**

```powershell
git add 'src/app/(auth)/login/login-form.tsx' 'src/app/(auth)/login/login-form.test.tsx'
git commit -m "fix: prevent repeated auth email submissions"
```

---

### Task 5: 同步认证文档和部署验收

**Files:**
- Modify: `docs/DEVELOPMENT_SPEC.md:367-384,1068-1074`
- Modify: `docs/superpowers/specs/2026-06-06-auth-design.md:20-43`

- [ ] **Step 1: 更新开发 SPEC**

在认证章节写明：

```markdown
- 登录邮件服务端限频：同一规范化邮箱在 OTP/Magic Link 间共享 60 秒冷却和每小时 5 次配额；同一 IP 共享每 10 分钟 10 次配额。
- 限频必须在调用 Resend 前通过数据库事务原子预占；Vercel 实例内存和前端按钮状态都不能作为安全边界。
- `pending`、`sent`、`failed` 邮件事件均计入配额，成功/失败必须保存 provider message ID 或错误信息。
```

部署验收项“登录邮件限频生效”暂时保持 `[ ]`。只有迁移已应用到 staging，且真实检查 `429`、Resend 发信数量及倒计时后才能改为 `[x]`。

- [ ] **Step 2: 更新认证设计文档**

删除“完整 IP/邮箱限频放到以后”的表述，替换为本计划的数据库预占、共享配额和两层限频架构。明确两个邮箱入口继续保留。

- [ ] **Step 3: 检查文档 diff**

```powershell
git diff --check -- docs/DEVELOPMENT_SPEC.md docs/superpowers/specs/2026-06-06-auth-design.md
```

Expected: 无空白错误。

- [ ] **Step 4: 提交文档**

```powershell
git add docs/DEVELOPMENT_SPEC.md docs/superpowers/specs/2026-06-06-auth-design.md
git commit -m "docs: specify authentication email limits"
```

---

### Task 6: 阶段验证和 staging 验收

**Files:**
- Verify only

- [ ] **Step 1: 运行所有认证 focused tests**

```powershell
pnpm vitest run src/lib/auth src/server/auth 'src/app/(auth)/login' 'src/app/api/auth/[...all]' --reporter=dot
```

Expected: 所有认证相关测试 PASS。

- [ ] **Step 2: 检查改动文件 lint 和类型**

```powershell
pnpm exec eslint src/lib/db/schema/auth.ts src/server/auth/email-rate-limit.ts src/server/auth/email-rate-limit.test.ts src/lib/auth/config.ts src/lib/auth/config.test.ts 'src/app/(auth)/login/login-form.tsx' 'src/app/(auth)/login/login-form.test.tsx'
pnpm typecheck
```

Expected: exit code 0。

- [ ] **Step 3: Goal 结束时运行一次 full suite**

```powershell
pnpm test
```

Expected: 全仓测试 PASS。不要让实现 Agent、reviewer 和 Root 重复执行同一轮 full suite。

- [ ] **Step 4: 运行最终构建验收**

```powershell
pnpm lint
pnpm build
```

Expected: lint 和 production build 均 exit code 0。

- [ ] **Step 5: 在 staging 应用 migration**

```powershell
pnpm db:migrate
```

Expected: `0017_auth_email_rate_limit` 成功应用；`auth_email_event_status` 包含 `pending`，两个索引存在。

- [ ] **Step 6: staging 人工验收**

1. 输入合法邮箱，快速连点 OTP，浏览器 Network 只出现一个请求，Resend 只出现一封邮件。
2. OTP 请求成功后立即点击 Magic Link，按钮仍在共享冷却中，不发第二封邮件。
3. 绕过 UI 直接请求另一入口，服务端返回 `429`，body 包含 `AUTH_EMAIL_RATE_LIMITED` 和 `retryAfterSeconds`。
4. 等待 60 秒后允许重新发送。
5. 一小时内同邮箱第六次请求返回 `429`。
6. 同 IP 在十分钟内对不同邮箱发起第十一次请求返回 `429`。
7. 检查 `auth_email_events`：发送前出现 `pending`，成功为 `sent` 且有 provider message ID，失败为 `failed` 且有错误信息。
8. 确认 OTP 和 Magic Link 两个入口都可正常完成登录。

- [ ] **Step 7: 完成部署验收文档**

只有 Step 6 全部通过后，才把 `docs/DEVELOPMENT_SPEC.md` 中“登录邮件限频生效”改为 `[x]`，并提交验收结果。

---

## 自审结论

- 需求覆盖：保留两个入口、前端防连点、共享冷却、服务端邮箱/IP限频、跨实例持久化、并发原子性、429 反馈、邮件事件审计均有对应任务。
- 未扩大范围：未引入 Redis、验证码尝试限制、验证码输入 UI、Google OAuth 改造或登录方式删减。
- 关键风险：不能采用普通 `count + insert`，必须先按排序后的邮箱/IP key 获取 advisory transaction lock，再查询并插入 `pending`；否则并发测试无法证明真实安全边界。
- 迁移策略：使用新的 forward migration，不修改已有 `0001_add_auth_email_events.sql`。
